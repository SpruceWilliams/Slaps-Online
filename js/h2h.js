function isTrue(v) {
  return v === true || String(v).toLowerCase() === "true";
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fetchMatches() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "matches" });
  return fetch(url).then(r => r.json());
}

function fetchPlayers() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "players" });
  return fetch(url).then(r => r.json());
}

function headToHeadMatches(matches, a, b, ratedOnly) {
  return matches
    .filter(m => {
      const involved =
        (m.player1 === a && m.player2 === b) ||
        (m.player1 === b && m.player2 === a);
      if (!involved) return false;
      if (ratedOnly && !isTrue(m.elo_applied)) return false;
      return true;
    })
    .slice()
    .sort((x, y) => new Date(x.date) - new Date(y.date)); // chronological
}

function computeH2HStats(h2h, a, b) {
  const totalMatches = h2h.length;

  let aWins = 0, bWins = 0;
  let aGamesFor = 0, aGamesAgainst = 0, bGamesFor = 0, bGamesAgainst = 0;
  let aSlapsFor = 0, aSlapsAgainst = 0, bSlapsFor = 0, bSlapsAgainst = 0;
  let aYellow = 0, aRed = 0, bYellow = 0, bRed = 0;

  let longest = null;
  let longestGames = -1;

  // Elo changes in the H2H subset (rated matches only)
  let aEloDeltaTotal = 0;
  let bEloDeltaTotal = 0;

  for (const m of h2h) {
    if (m.winner === a) aWins++;
    if (m.winner === b) bWins++;

    // Identify which side A is on in this match
    const aIsP1 = m.player1 === a;

    const aGames = aIsP1 ? toNum(m.player1_games) : toNum(m.player2_games);
    const bGames = aIsP1 ? toNum(m.player2_games) : toNum(m.player1_games);

    const aSlaps = aIsP1 ? toNum(m.player1_slaps) : toNum(m.player2_slaps);
    const bSlaps = aIsP1 ? toNum(m.player2_slaps) : toNum(m.player1_slaps);

    const aY = aIsP1 ? toNum(m.player1_yellow) : toNum(m.player2_yellow);
    const aR = aIsP1 ? toNum(m.player1_red) : toNum(m.player2_red);

    const bY = aIsP1 ? toNum(m.player2_yellow) : toNum(m.player1_yellow);
    const bR = aIsP1 ? toNum(m.player2_red) : toNum(m.player1_red);

    aGamesFor += aGames; aGamesAgainst += bGames;
    bGamesFor += bGames; bGamesAgainst += aGames;

    aSlapsFor += aSlaps; aSlapsAgainst += bSlaps;
    bSlapsFor += bSlaps; bSlapsAgainst += aSlaps;

    aYellow += aY; aRed += aR;
    bYellow += bY; bRed += bR;

    const totalG = toNum(m.player1_games) + toNum(m.player2_games);
    if (totalG > longestGames) {
      longestGames = totalG;
      longest = m;
    }

    if (isTrue(m.elo_applied)) {
      // p1_elo_delta/p2_elo_delta are in your sheet
      const aDelta = aIsP1 ? toNum(m.p1_elo_delta) : toNum(m.p2_elo_delta);
      const bDelta = aIsP1 ? toNum(m.p2_elo_delta) : toNum(m.p1_elo_delta);
      aEloDeltaTotal += aDelta;
      bEloDeltaTotal += bDelta;
    }
  }

  const aGameShare = (aGamesFor + aGamesAgainst) ? (aGamesFor / (aGamesFor + aGamesAgainst)) : 0;
  const bGameShare = (bGamesFor + bGamesAgainst) ? (bGamesFor / (bGamesFor + bGamesAgainst)) : 0;

  const aSlapShare = (aSlapsFor + aSlapsAgainst) ? (aSlapsFor / (aSlapsFor + aSlapsAgainst)) : 0;
  const bSlapShare = (bSlapsFor + bSlapsAgainst) ? (bSlapsFor / (bSlapsFor + bSlapsAgainst)) : 0;

  const aAvgGamesFor = totalMatches ? aGamesFor / totalMatches : 0;
  const bAvgGamesFor = totalMatches ? bGamesFor / totalMatches : 0;

  const aAvgSlapsFor = totalMatches ? aSlapsFor / totalMatches : 0;
  const bAvgSlapsFor = totalMatches ? bSlapsFor / totalMatches : 0;

  return {
    totalMatches, aWins, bWins,
    aGamesFor, aGamesAgainst, bGamesFor, bGamesAgainst,
    aSlapsFor, aSlapsAgainst, bSlapsFor, bSlapsAgainst,
    aYellow, aRed, bYellow, bRed,
    aGameShare, bGameShare, aSlapShare, bSlapShare,
    aAvgGamesFor, bAvgGamesFor, aAvgSlapsFor, bAvgSlapsFor,
    longest, longestGames,
    aEloDeltaTotal, bEloDeltaTotal
  };
}

function renderSummary(a, b, ratedOnly, stats) {
  const el = document.getElementById("h2hSummary");
  if (!el) return;

  const longestText = stats.longest
    ? `${formatDate(stats.longest.date)} — ${stats.longest.player1} ${toNum(stats.longest.player1_games)}–${toNum(stats.longest.player2_games)} ${stats.longest.player2} (${stats.longestGames} games)`
    : "-";

  el.innerHTML = `
    <div class="card">
      <p><strong>${a}</strong> vs <strong>${b}</strong> (${ratedOnly ? "rated only" : "rated + friendlies"})</p>
      <p><strong>Matches:</strong> ${stats.totalMatches} — <strong>${a} wins:</strong> ${stats.aWins} — <strong>${b} wins:</strong> ${stats.bWins}</p>

      <hr>

      <p><strong>Games for/against:</strong> ${a}: ${stats.aGamesFor}/${stats.aGamesAgainst} (${(stats.aGameShare*100).toFixed(1)}%) —
         ${b}: ${stats.bGamesFor}/${stats.bGamesAgainst} (${(stats.bGameShare*100).toFixed(1)}%)</p>

      <p><strong>Slaps for/against:</strong> ${a}: ${stats.aSlapsFor}/${stats.aSlapsAgainst} (${(stats.aSlapShare*100).toFixed(1)}%) —
         ${b}: ${stats.bSlapsFor}/${stats.bSlapsAgainst} (${(stats.bSlapShare*100).toFixed(1)}%)</p>

      <p><strong>Avg per match (games for):</strong> ${a}: ${stats.aAvgGamesFor.toFixed(2)} — ${b}: ${stats.bAvgGamesFor.toFixed(2)}</p>
      <p><strong>Avg per match (slaps for):</strong> ${a}: ${stats.aAvgSlapsFor.toFixed(2)} — ${b}: ${stats.bAvgSlapsFor.toFixed(2)}</p>

      <hr>

      <p><strong>Discipline:</strong> ${a} 🟨 ${stats.aYellow} 🟥 ${stats.aRed} — ${b} 🟨 ${stats.bYellow} 🟥 ${stats.bRed}</p>
      <p><strong>Longest match:</strong> ${longestText}</p>

      <p><strong>Total Elo change (rated, H2H only):</strong> ${a}: ${stats.aEloDeltaTotal.toFixed(1)} — ${b}: ${stats.bEloDeltaTotal.toFixed(1)}</p>
    </div>
  `;
}

function renderMatchesTable(h2h, a) {
  const el = document.getElementById("h2hMatches");
  if (!el) return;

  const rows = h2h.slice().reverse().map(m => {
    const aIsP1 = m.player1 === a;
    const aGames = aIsP1 ? toNum(m.player1_games) : toNum(m.player2_games);
    const bGames = aIsP1 ? toNum(m.player2_games) : toNum(m.player1_games);
    const aSlaps = aIsP1 ? toNum(m.player1_slaps) : toNum(m.player2_slaps);
    const bSlaps = aIsP1 ? toNum(m.player2_slaps) : toNum(m.player1_slaps);

    const res = (m.winner === a) ? "W" : "L";
    const ratedMark = isTrue(m.elo_applied) ? "✓" : "";

    return `
      <tr>
        <td>${res}</td>
        <td>${formatDate(m.date)}</td>
        <td>${m.player1}</td>
        <td>${toNum(m.player1_games)}–${toNum(m.player2_games)}</td>
        <td>${m.player2}</td>
        <td>${toNum(m.player1_slaps)}–${toNum(m.player2_slaps)}</td>
        <td>${ratedMark}</td>
      </tr>
    `;
  }).join("");

  el.innerHTML = `
    <div class="elo-table-wrapper">
      <table class="elo-table">
        <thead>
          <tr>
            <th>R (A)</th>
            <th>Date</th>
            <th>Player 1</th>
            <th>Games</th>
            <th>Player 2</th>
            <th>Slaps</th>
            <th>Rated</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7">No head-to-head matches found.</td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function showLoading(show) {
  const el = document.getElementById("loadingIndicator");
  if (!el) return;
  el.style.display = show ? "flex" : "none";
}

(async function init() {
  showLoading(true);

  const [matches, players] = await Promise.all([
    fetchMatches(),
    fetchPlayers()
  ]);

  const selA = document.getElementById("pA");
  const selB = document.getElementById("pB");
  const ratedOnly = document.getElementById("ratedOnly");
  const swapBtn = document.getElementById("swapPlayers");

  // Sort players alphabetically
  const sortedPlayers = [...players].sort((a, b) =>
    a.localeCompare(b)
  );

  // Populate dropdowns
  function populateSelect(select) {
    select.innerHTML =
      `<option value="">Select player...</option>` +
      sortedPlayers.map(name =>
        `<option value="${name}">${name}</option>`
      ).join("");
  }

  populateSelect(selA);
  populateSelect(selB);

  function run() {
    const a = selA.value;
    const b = selB.value;

    if (!a || !b || a === b) {
      document.getElementById("h2hSummary").innerHTML = "";
      document.getElementById("h2hMatches").innerHTML = "";
      return;
    }

    const h2h = headToHeadMatches(matches, a, b, !!ratedOnly.checked);
    const stats = computeH2HStats(h2h, a, b);

    renderSummary(a, b, !!ratedOnly.checked, stats);
    renderMatchesTable(h2h, a);
  }

  // Auto-run when selection changes
  selA.addEventListener("change", run);
  selB.addEventListener("change", run);
  ratedOnly.addEventListener("change", run);

  // Swap button
  swapBtn.addEventListener("click", () => {
    const temp = selA.value;
    selA.value = selB.value;
    selB.value = temp;
    run();
  });

  showLoading(false);
})();

