// 04.02.2026 Backup

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: "ok",
      message: "Slaps match submission endpoint is live"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}


function getNextMatchId(sheet) {
  if (!sheet) throw new Error('Sheet "matches" not found');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .filter(v => typeof v === 'number');

  return Math.max(...ids, 0) + 1;
}


// ELO Calculations for game input

//Calculates expected score for each player
//This is E_A=1/(1+10^{R_B-R_A}/400)
//R_B-R_A calculated rating difference
//400 is the ELO scaling constant
//The 400 implies that a 400-point difference is a 10x expected difference in strength. Your expected score with 400 points higher is 91%. A smaller constant makes ratings maatter more - a 200 point difference for example could lead to an expected win rate of 91%.
//1/x converts to a probability
//returns 0.5 if probabilities are equal
//returns <0.5 if A is weaker, >0.5 if A is stronger
function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}


function updateElo(data, ratingsSheet) {
  //K Factor can be adjusted here. Higher leads to more volatility, lower to stability.
  //The K factor tells you the maximum value that a rating can change from a match
  // With 32 K the last 12 matches or so are "remembered" by the rating. With 16, it would remember 25.
  const K_64 = 64;
  const K_32 = 32;
  const K_16 = 16;
  const K_8  = 8;
  const STARTING_ELO = 1000;

  //Loads the ratings sheet into memory. getDataRange grabs all rows and columns and getValues make a 2D array
  const values = ratingsSheet.getDataRange().getValues();

  //Declared so they can be used for calculations later. 
  let row1 = null, row2 = null;
  let r1 = null, r2 = null;
  let g1, g2;


  const p1 = data.player1.trim();
  const p2 = data.player2.trim();

  // Find existing players
  for (let i = 1; i < values.length; i++) {
    const name = String(values[i][0]).trim();

    if (name === p1) {
      row1 = i + 1;
      r1 = Number(values[i][1]);
      g1 = Number(values[i][2]) || 0;
    }

    if (name === p2) {
      row2 = i + 1;
      r2 = Number(values[i][1]);
      g2 = Number(values[i][2]) || 0;
    }
  }

  // Add missing players
  if (row1 === null) {
    row1 = ratingsSheet.getLastRow() + 1;
    r1 = STARTING_ELO;
    g1 = 0;
    ratingsSheet.appendRow([p1, r1, g1]);
  }

  if (row2 === null) {
    row2 = ratingsSheet.getLastRow() + 1;
    r2 = STARTING_ELO;
    g2 = 0;
    ratingsSheet.appendRow([p2, r2, g2]);
  }

  // Safety net
  if (!Number.isFinite(r1)) r1 = STARTING_ELO;
  if (!Number.isFinite(r2)) r2 = STARTING_ELO;


  // Determine match result
  let S1, S2;
  if (data.winnername === p1) {
    S1 = 1;
    S2 = 0;
  } else if (data.winnername === p2) {
    S1 = 0;
    S2 = 1;
  } else {
    throw new Error("Winner name does not match either player");
  }

  // Expected scores
  const E1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const E2 = 1 - E1;

  // Which K factor?
  function getK(gamesPlayed) {
    if (gamesPlayed <= 5) return K_64;
    if (gamesPlayed <= 15) return K_32;
    if (gamesPlayed <= 30) return K_16;
    return K_8;
  }

  let K1 = getK(g1);
  let K2 = getK(g2);

  // If opponent has < 6 games, halve K
  if (g2 < 6) K1 = Math.round(K1 / 2);
  if (g1 < 6) K2 = Math.round(K2 / 2);


  // New ratings
  const newR1 = Math.round(r1 + K1 * (S1 - E1));
  const newR2 = Math.round(r2 + K2 * (S2 - E2));
  const newG1 = g1 + 1;
  const newG2 = g2 + 1;


  // Write back to sheet
  ratingsSheet.getRange(row1, 2).setValue(newR1);
  ratingsSheet.getRange(row1, 3).setValue(newG1);

  ratingsSheet.getRange(row2, 2).setValue(newR2);
  ratingsSheet.getRange(row2, 3).setValue(newG2);


  return {
    p1_before: r1,
    p2_before: r2,
    p1_after: newR1,
    p2_after: newR2,
    p1_delta: newR1 - r1,
    p2_delta: newR2 - r2
  };
}


// Processes HTML form

// Runs when the HTML form sends a POST request. e is the event object
function doPost(e) {
  //Stops it from causing matchID or ELO errors by processing multiple games at once.
  const lock = LockService.getScriptLock();
  let hasLock = false;

  try {
    lock.waitLock(5000);
    hasLock = true;
    // e.postData.contents contains the JSON content from the form
    const data = e.parameter;

    [
      "player1games",
      "player2games",
      "player1slaps",
      "player2slaps",
      "player1yellow",
      "player2yellow",
      "player1red",
      "player2red"
    ].forEach(k => data[k] = Number(data[k]));

    // Open the spreadsheet
    const ss = SpreadsheetApp.openById("1dy9WsjStUBM9NySPxijNMcPVNbZq90hOgyoRPXuCzdw");
    const matches = ss.getSheetByName("matches");
    const elo = ss.getSheetByName("ratings");

    // 1️⃣ Generate match ID
    const matchId = getNextMatchId(matches);

    // 3️⃣ Update Elo
    let eloResult = null;
    let eloApplied = false;

    if (data.matchtype !== "friendly") {
      eloResult = updateElo(data, elo);
      eloApplied = true;
    }

    // 2️⃣ Append row with ID first
    matches.appendRow([
      matchId,
      data.date,
      data.player1,
      data.player2,
      data.winnername,
      data.player1games,
      data.player2games,
      data.player1slaps,
      data.player2slaps,
      data.player1yellow,
      data.player2yellow,
      data.player1red,
      data.player2red,
      data.refname,
      data.matchtype,
      data.competitionname,

      // Elo logging
      eloApplied,
      eloResult ? eloResult.p1_before : "",
      eloResult ? eloResult.p2_before : "",
      eloResult ? eloResult.p1_after : "",
      eloResult ? eloResult.p2_after : "",
      eloResult ? eloResult.p1_delta : "",
      eloResult ? eloResult.p2_delta : ""
    ]);

    // Let's the user know if there was a success
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, matchId }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: err.message }))
    .setMimeType(ContentService.MimeType.JSON);
} finally {
  if (hasLock) lock.releaseLock();
}
}


// Sheets display on website

function doGet(e) {
  const action = e.parameter.action;

  if (action === "ratings") {
    return getRatings(e.parameter);
  }

  if (action === "matches") {
    return getMatches(e.parameter);
  }

  // Always return JSON (prevents frontend .json() crashes)
  return ContentService
    .createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}


// Rating table display on website

function getRatings(params) {
  const sheet = SpreadsheetApp.getActive()
    .getSheetByName("ratings");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  let rows = data.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );

  // Sort by Elo descending
  rows.sort((a, b) => b.elo - a.elo);

  // Optional limit (e.g. top 6)
  if (params.limit) {
    rows = rows.slice(0, Number(params.limit));
  }

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}

// Matches display on website
function getMatches(params) {
  const sheet = SpreadsheetApp.getActive()
    .getSheetByName("matches");

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  let rows = data.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );

  // Sort by match_id ascending
  rows.sort((a, b) => a.match_id - b.match_id);

  // Optional limit (e.g. top 6)
  if (params.limit) {
    rows = rows.slice(0, Number(params.limit));
  }

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}




