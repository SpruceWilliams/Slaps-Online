console.log("ratings.js loaded");
console.log("API in ratings.js:", window.API);

function fetchRatings(limit) {
  const url = new URL(API.BASE);
  const params = new URLSearchParams({ action: "ratings" });
  if (limit != null) params.set("limit", limit);
  url.search = params;
  return fetch(url).then(r => r.json());
}

function renderRatings(containerId, ratings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
  <div class="elo-table-wrapper">
    <table class="elo-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Elo</th>
          <th>Games Played</th>
        </tr>
      </thead>
      <tbody>
        ${ratings.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.player_name}</td>
            <td>${Math.round(r.elo)}</td>
            <td>${r.games_played}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    </div>
  `;
}
