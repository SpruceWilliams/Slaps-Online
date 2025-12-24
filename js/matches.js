console.log("matches.js loaded");
console.log("API in matches.js:", window.API);

function formatDate(iso) {
  if (!iso) return "";
  return iso.split("T")[0];
}

function fetchMatches(limit) {
  const url = new URL(API.BASE);
  const params = new URLSearchParams({ action: "matches" });
  if (limit != null) params.set("limit", limit);
  url.search = params;
  return fetch(url).then(r => r.json());
}

function renderMatches(containerId, matches) {
  const container = document.getElementById(containerId);
  if (!container) return;

  console.log("Rendering matches:", matches);

  container.innerHTML = `
    <div class="matches-table-wrapper">
      <table class="matches-table">
        <thead>
          <tr>
            <th>Match ID</th>
            <th>Date</th>
            <th>Player 1</th>
            <th>Player 2</th>
            <th>Winner</th>
            <th>P1 Games</th>
            <th>P2 Games</th>
            <th>P1 Slaps</th>
            <th>P2 Slaps</th>
            <th>P1 Yellow</th>
            <th>P1 Red</th>
            <th>P2 Yellow</th>
            <th>P2 Red</th>
            <th>Referee</th>
            <th>Match Type</th>
            <th>Competition</th>
            <th>ELO Change?</th>
            <th>P1 ELO Before</th>
            <th>P2 ELO Before</th>
            <th>P1 ELO After</th>
            <th>P2 ELO After</th>
            <th>P1 ELO Δ</th>
            <th>P2 ELO Δ</th>
          </tr>
        </thead>
        <tbody>
          ${matches.map(m => `
            <tr>
              <td>${m.match_id}</td>
              <td>${formatDate(m.date)}</td>
              <td>${m.player1}</td>
              <td>${m.player2}</td>
              <td>${m.winner}</td>
              <td>${m.player1_games}</td>
              <td>${m.player2_games}</td>
              <td>${m.player1_slaps}</td>
              <td>${m.player2_slaps}</td>
              <td>${m.player1_yellow}</td>
              <td>${m.player1_red}</td>
              <td>${m.player2_yellow}</td>
              <td>${m.player2_red}</td>
              <td>${m.referee}</td>
              <td>${m.match_type}</td>
              <td>${m.competition_name}</td>
              <td>${m.elo_applied}</td>
              <td>${m.p1_elo_before}</td>
              <td>${m.p2_elo_before}</td>
              <td>${m.p1_elo_after}</td>
              <td>${m.p2_elo_after}</td>
              <td>${m.p1_elo_delta}</td>
              <td>${m.p2_elo_delta}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
