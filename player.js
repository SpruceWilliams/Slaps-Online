// player.js (schema matches your sheet headers exactly)

function resizeCanvasToDisplaySize(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // CSS pixel size -> real pixel size
  const width = Math.round(rect.width * dpr);
  const height = Math.round(rect.height * dpr);

  // Only resize when necessary (prevents flicker)
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext("2d");
  // Draw in CSS pixels
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, cssW: rect.width, cssH: rect.height };
}


function getPlayerFromURL() {
  const url = new URL(window.location.href);
  return (url.searchParams.get("player") || "").trim();
}

function fetchMatches() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "matches" });
  return fetch(url).then(r => r.json());
}

function fetchRatings() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "ratings" });
  return fetch(url).then(r => r.json());
}

function isTrue(v) {
  return v === true || String(v).toLowerCase() === "true";
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseDateSafe(s) {
  // Accepts ISO-ish strings; falls back to 0 if missing/unparseable
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function opponentOfMatch(m, player) {
  return m.player1 === player ? m.player2 : m.player1;
}

function playerIsP1(m, player) {
  return m.player1 === player;
}

function getPlayerEloBefore(m, player) {
  return playerIsP1(m, player) ? toNum(m.p1_elo_before) : toNum(m.p2_elo_before);
}
function getPlayerEloAfter(m, player) {
  return playerIsP1(m, player) ? toNum(m.p1_elo_after) : toNum(m.p2_elo_after);
}
function getOppEloBefore(m, player) {
  // opponent is the other side
  return playerIsP1(m, player) ? toNum(m.p2_elo_before) : toNum(m.p1_elo_before);
}

function getPlayerDiscipline(m, player) {
  const y = playerIsP1(m, player) ? toNum(m.player1_yellow) : toNum(m.player2_yellow);
  const r = playerIsP1(m, player) ? toNum(m.player1_red) : toNum(m.player2_red);
  return { yellow: y, red: r };
}

function formatDate(value) {
  if (!value) return "";

  const d = new Date(value);
  if (isNaN(d)) return value; // fallback if parsing fails

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}


function renderEloChart(player, ratedMineChrono) {
  const canvas = document.getElementById("eloChart");
  if (!canvas) return;

  const { ctx, cssW: w, cssH: h } = resizeCanvasToDisplaySize(canvas);

  ctx.clearRect(0, 0, w, h);

  if (!ratedMineChrono.length) {
    ctx.font = "14px sans-serif";
    ctx.fillText("No rated matches to plot.", 12, 24);
    return;
  }

  // Build Elo points: start with first "before", then each match "after"
  const points = [];
  points.push(getPlayerEloBefore(ratedMineChrono[0], player));
  for (const m of ratedMineChrono) points.push(getPlayerEloAfter(m, player));

  const minData = Math.min(...points);
  const maxData = Math.max(...points);

  // --- Chart layout ---
  const padL = 55;   // left padding for y labels
  const padR = 15;
  const padT = 25;
  const padB = 45;   // bottom padding for x labels

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  // --- Y ticks every 50 Elo ---
  const stepY = 50;
  const yMinTick = Math.floor(minData / stepY) * stepY;
  const yMaxTick = Math.ceil(maxData / stepY) * stepY;
  const spanY = (yMaxTick - yMinTick) || 1;

  const xMap = (i) => padL + (i / (points.length - 1)) * plotW;
  const yMap = (v) => padT + (1 - (v - yMinTick) / spanY) * plotH;

  // Background
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  // --- Grid + Y axis ticks/labels ---
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#e0e0e0";
  ctx.lineWidth = 1;

  for (let yVal = yMinTick; yVal <= yMaxTick; yVal += stepY) {
    const y = yMap(yVal);

    // gridline
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();

    // tick label
    ctx.fillText(String(yVal), 8, y + 4);
  }

  // --- Axes (dark) ---
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  // y-axis
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, h - padB);
  // x-axis
  ctx.lineTo(w - padR, h - padB);
  ctx.stroke();

  // --- X ticks (match count) ---
  const maxMatches = points.length - 1; // because points includes the starting "before"
  const xTickStep = maxMatches <= 10 ? 1 : (maxMatches <= 40 ? 5 : 10);

  ctx.fillStyle = "#111";
  ctx.strokeStyle = "#777";
  ctx.lineWidth = 1;

  for (let m = 0; m <= maxMatches; m += xTickStep) {
    const x = xMap(m);

    // tick mark
    ctx.beginPath();
    ctx.moveTo(x, h - padB);
    ctx.lineTo(x, h - padB + 5);
    ctx.stroke();

    // tick label
    const label = String(m);
    const labelW = ctx.measureText(label).width;
    ctx.fillText(label, x - labelW / 2, h - padB + 18);
  }

  // --- Axis labels ---
  ctx.font = "13px sans-serif";
  ctx.fillStyle = "#111";

  // x label
  const xLabel = "Rated matches played";
  const xLabelW = ctx.measureText(xLabel).width;
  ctx.fillText(xLabel, padL + (plotW - xLabelW) / 2, h - 10);

  // y label (rotated)
  const yLabel = "Elo";
  ctx.save();
  ctx.translate(15, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, -ctx.measureText(yLabel).width / 2, 0);
  ctx.restore();

  // --- Line ---
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((v, i) => {
    const x = xMap(i);
    const y = yMap(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // --- Points ---
  ctx.fillStyle = "#111";
  points.forEach((v, i) => {
    const x = xMap(i);
    const y = yMap(v);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // Optional: min/max text at top
  ctx.font = "12px sans-serif";
  ctx.fillStyle = "#111";
  ctx.fillText(`Min: ${Math.round(minData)}`, padL, 16);
  const maxText = `Max: ${Math.round(maxData)}`;
  ctx.fillText(maxText, w - padR - ctx.measureText(maxText).width, 16);
}




function computeStats(player, matches, includeFriendlies) {
  // Filter to this player's matches, optionally rated-only
  const mine = matches
    .filter(m => m.player1 === player || m.player2 === player)
    .filter(m => includeFriendlies ? true : isTrue(m.elo_applied));

  const played = mine.length;
  const wins = mine.filter(m => m.winner === player).length;
  const losses = played - wins;

  let gamesFor = 0, gamesAgainst = 0;
  let slapsFor = 0, slapsAgainst = 0;
let yellowTotal = 0, redTotal = 0;

  let bestWin = null;   // { opponent, oppElo, match }
  let worstLoss = null; // { opponent, oppElo, match }

  const eloPoints = [];

  for (const m of mine) {
    const isP1 = m.player1 === player;

    const gFor = isP1 ? toNum(m.player1_games) : toNum(m.player2_games);
    const gAgainst = isP1 ? toNum(m.player2_games) : toNum(m.player1_games);

    const sFor = isP1 ? toNum(m.player1_slaps) : toNum(m.player2_slaps);
    const sAgainst = isP1 ? toNum(m.player2_slaps) : toNum(m.player1_slaps);

    gamesFor += gFor;
    gamesAgainst += gAgainst;
    slapsFor += sFor;
    slapsAgainst += sAgainst;

    // Discipline totals (works for rated + friendlies)
    const d = getPlayerDiscipline(m, player);
    yellowTotal += d.yellow;
    redTotal += d.red;

    // Best win / worst loss should use rated Elo context only
    if (isTrue(m.elo_applied)) {
      const opp = opponentOfMatch(m, player);
      const oppElo = getOppEloBefore(m, player);

      if (m.winner === player) {
        if (!bestWin || oppElo > bestWin.oppElo) bestWin = { opponent: opp, oppElo, match: m };
      } else {
        // player lost
        if (!worstLoss || oppElo < worstLoss.oppElo) worstLoss = { opponent: opp, oppElo, match: m };
      }
    }


    // Elo only makes sense for rated matches (elo_applied=true)
    if (isTrue(m.elo_applied)) {
      if (isP1) {
        eloPoints.push(toNum(m.p1_elo_before));
        eloPoints.push(toNum(m.p1_elo_after));
      } else {
        eloPoints.push(toNum(m.p2_elo_before));
        eloPoints.push(toNum(m.p2_elo_after));
      }
    }
  }

  const gamesTotal = gamesFor + gamesAgainst;
  const slapsTotal = slapsFor + slapsAgainst;

  const pctGamesWon = gamesTotal ? (gamesFor / gamesTotal) : 0;
  const pctSlapsWon = slapsTotal ? (slapsFor / slapsTotal) : 0;

  const avgGamesFor = played ? (gamesFor / played) : 0;
  const avgGamesAgainst = played ? (gamesAgainst / played) : 0;
  const avgSlapsFor = played ? (slapsFor / played) : 0;
  const avgSlapsAgainst = played ? (slapsAgainst / played) : 0;

  // Longest match by total games (player1_games + player2_games)
  let longestMatch = null;
  let longestGames = -1;
  for (const m of mine) {
    const total = toNum(m.player1_games) + toNum(m.player2_games);
    if (total > longestGames) {
      longestGames = total;
      longestMatch = m;
    }
  }

  const eloPeak = eloPoints.length ? Math.max(...eloPoints) : null;
  const eloLow = eloPoints.length ? Math.min(...eloPoints) : null;

  return {
    mine,
    played, wins, losses,
    gamesFor, gamesAgainst,
    slapsFor, slapsAgainst,
    pctGamesWon, pctSlapsWon,
    avgGamesFor, avgGamesAgainst,
    avgSlapsFor, avgSlapsAgainst,
    longestMatch, longestGames,
    yellowTotal,
    redTotal,
    bestWin,
    worstLoss,
    eloPeak, eloLow
  };
}

function render(player, stats, currentElo, includeFriendlies) {
  document.getElementById("playerTitle").textContent = player;

  const summary = document.getElementById("playerSummary");

  // Extras block: best win / worst loss / discipline
  const extras = document.getElementById("playerExtras");
  if (extras) {
    const bw = stats.bestWin
      ? `${stats.bestWin.opponent} (opp Elo ${Math.round(stats.bestWin.oppElo)})`
      : "-";
    const wl = stats.worstLoss
      ? `${stats.worstLoss.opponent} (opp Elo ${Math.round(stats.worstLoss.oppElo)})`
      : "-";

    extras.innerHTML = `
      <div class="card">
        <p><strong>Best win (highest-Elo opponent beaten, rated):</strong> ${bw}</p>
        <p><strong>Worst loss (lowest-Elo opponent lost to, rated):</strong> ${wl}</p>
        <hr>
        <p><strong>Discipline totals:</strong> 🟨 ${stats.yellowTotal} &nbsp;&nbsp; 🟥 ${stats.redTotal}</p>
      </div>
    `;
  }


  const longestText = stats.longestMatch
    ? `${stats.longestMatch.player1} ${toNum(stats.longestMatch.player1_games)}–${toNum(stats.longestMatch.player2_games)} ${stats.longestMatch.player2} (${stats.longestGames} rounds)`
    : "-";

  summary.innerHTML = `
    <div class="card">
      <p><strong>Mode:</strong> ${includeFriendlies ? "Rated + friendlies" : "Rated only"}</p>
      <p><strong>Current Elo:</strong> ${currentElo != null ? Math.round(currentElo) : "-"}</p>

      <p><strong>Matches:</strong> ${stats.played}</p>
      <p><strong>Wins–Losses:</strong> ${stats.wins}–${stats.losses}</p>

      <hr>

      <p><strong>Total rounds (for / against):</strong> ${stats.gamesFor} / ${stats.gamesAgainst}</p>
      <p><strong>% rounds won:</strong> ${(stats.pctGamesWon * 100).toFixed(1)}%</p>
      <p><strong>Avg rounds per match (for / against):</strong> ${stats.avgGamesFor.toFixed(2)} / ${stats.avgGamesAgainst.toFixed(2)}</p>

      <hr>

      <p><strong>Total slaps (for / against):</strong> ${stats.slapsFor} / ${stats.slapsAgainst}</p>
      <p><strong>% slaps won:</strong> ${(stats.pctSlapsWon * 100).toFixed(1)}%</p>
      <p><strong>Avg slaps per match (for / against):</strong> ${stats.avgSlapsFor.toFixed(2)} / ${stats.avgSlapsAgainst.toFixed(2)}</p>

      <hr>

      <p><strong>Longest match (total rounds):</strong> ${longestText}</p>

      <p><strong>Peak Elo (rated):</strong> ${stats.eloPeak != null ? Math.round(stats.eloPeak) : "-"}</p>
      <p><strong>Lowest Elo (rated):</strong> ${stats.eloLow != null ? Math.round(stats.eloLow) : "-"}</p>
      ${includeFriendlies ? `<p style="opacity:.75"><em>Note: Elo peak/low use rated matches only.</em></p>` : ``}
    </div>
  `;

  // All matches table (show rated flag, games/slaps)
  const matchesDiv = document.getElementById("playerMatches");

  // If your API returns matches oldest->newest, reverse for "most recent first"
  const mineMostRecentFirst = stats.mine.slice().reverse();

  const rows = mineMostRecentFirst.map(m => {
    const res = (m.winner === player) ? "W" : "L";
    const ratedMark = isTrue(m.elo_applied) ? "✓" : "";
    return `
      <tr>
        <td>${res}</td>
        <td>${formatDate(m.date)}</td>
        <td>${m.player1}</td>
        <td>${toNum(m.player1_games)}</td>
        <td>${toNum(m.player2_games)}</td>
        <td>${m.player2}</td>
        <td>${toNum(m.player1_slaps)}</td>
        <td>${toNum(m.player2_slaps)}</td>
        <td>${ratedMark}</td>
      </tr>
    `;
  }).join("");

  matchesDiv.innerHTML = `
    <div class="elo-table-wrapper">
      <table class="elo-table">
        <thead>
          <tr>
            <th>R</th>
            <th>Date</th>
            <th>Player 1</th>
            <th>R1</th>
            <th>R2</th>
            <th>Player 2</th>
            <th>S1</th>
            <th>S2</th>
            <th>Rated</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="9">No matches found.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;

    // Elo chart always uses rated matches only
  const ratedMineChrono = stats.mine
    .filter(m => isTrue(m.elo_applied))
    .slice()
    .sort((a, b) => parseDateSafe(a.date) - parseDateSafe(b.date));

  renderEloChart(player, ratedMineChrono);

}

(async function init() {
  const player = getPlayerFromURL();
  const loading = document.getElementById("loadingIndicator");

  if (!player) {
    document.getElementById("playerTitle").textContent = "Player not found";
    if (loading) loading.style.display = "none";
    return;
  }

  try {
    const [matches, ratings] = await Promise.all([
      fetchMatches(),
      fetchRatings()
    ]);

    const ratingRow = Array.isArray(ratings)
      ? ratings.find(r => r.player_name === player)
      : null;

    const currentElo = ratingRow ? Number(ratingRow.elo) : null;

    const toggle = document.getElementById("includeFriendlies");

    function rerender() {
      const includeFriendlies = !!toggle.checked;
      const stats = computeStats(player, matches, includeFriendlies);
      render(player, stats, currentElo, includeFriendlies);
      window.addEventListener("resize", rerender, { passive: true });
    }

    toggle.checked = false;
    toggle.addEventListener("change", rerender);

    rerender();
  } catch (err) {
    console.error(err);
    document.getElementById("playerSummary").innerHTML =
      `<p style="color:red;">Failed to load player data.</p>`;
  } finally {
    if (loading) loading.style.display = "none";
  }
})();

