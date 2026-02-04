function getPlayerFromURL() {
  const url = new URL(window.location.href);
  return (url.searchParams.get("player") || "").trim();
}

function fetchMatches() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "matches" });
  return fetch(url).then(r => r.json());
}

function isTrue(v) {
  return v === true || String(v).toLowerCase() === "true";
}

function computePlayerStats(player, matches) {
  // rated only
  const rated = matches.filter(m => isTrue(m.elo_applied));

  // matches involving this player
  const mine = rated.filter(m => m.player1 === player || m.player2 === player);

  const played = mine.length;
  const wins = mine.filter(m => m.winner === player).length;
  const losses = played - wins;
  const winRate = played ? (wins / played) : 0;

  // Last 10 (most recent first) – assumes matches are returned oldest->newest OR include date.
  // If you have a date column, sort by it here.
  const recent = [...mine].reverse().slice(0, 10);

  // streak from most recent backwards
  let streakType = null;
  let streakCount = 0;
  for (const m of recent) {
    const res = (m.winner === player) ? "W" : "L";
    if (streakType == null) {
      streakType = res;
      streakCount = 1;
    } else if (res === streakType) {
      streakCount++;
    } else {
      break;
    }
  }

  // most common opponent
  const oppCounts = {};
  for (const m of mine) {
    const opp = (m.player1 === player) ? m.player2 : m.player1;
    oppCounts[opp] = (oppCounts[opp] || 0) + 1;
  }
  const topOpp = Object.entries(oppCounts).sort((a,b) => b[1]-a[1])[0] || null;

  return {
    played, wins, losses, winRate,
    streak: streakType ? `${streakCount}${streakType}` : "-",
    topOpp: topOpp ? `${topOpp[0]} (${topOpp[1]})` : "-",
    recent
  };
}

function renderPlayer(player, stats) {
  document.getElementById("playerTitle").textContent = player;

  document.getElementById("playerSummary").innerHTML = `
    <div class="card">
      <p><strong>Rated games:</strong> ${stats.played}</p>
      <p><strong>Wins–Losses:</strong> ${stats.wins}–${stats.losses}</p>
      <p><strong>Win rate:</strong> ${(stats.winRate * 100).toFixed(1)}%</p>
      <p><strong>Current streak:</strong> ${stats.streak}</p>
      <p><strong>Most played opponent:</strong> ${stats.topOpp}</p>
    </div>
  `;

  const rows = stats.recent.map(m => {
    const opp = (m.player1 === player) ? m.player2 : m.player1;
    const res = (m.winner === player) ? "W" : "L";
    return `<tr>
      <td>${res}</td>
      <td>${opp}</td>
      <td>${m.player1} vs ${m.player2}</td>
    </tr>`;
  }).join("");

  document.getElementById("playerMatches").innerHTML = `
    <div class="elo-table-wrapper">
      <table class="elo-table">
        <thead><tr><th>Result</th><th>Opponent</th><th>Match</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3">No rated matches found.</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

(async function init() {
  const player = getPlayerFromURL();
  if (!player) {
    document.getElementById("playerTitle").textContent = "Player not found";
    return;
  }

  const matches = await fetchMatches();
  const stats = computePlayerStats(player, matches);
  renderPlayer(player, stats);
})();
