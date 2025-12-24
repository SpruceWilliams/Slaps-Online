console.log("ratings.js loaded");
console.log("API in ratings.js:", window.API);

function fetchRatings(limit) {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "ratings", limit });
  return fetch(url).then(r => r.json());
}

function renderRatings(containerId, ratings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <table class="elo-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Elo</th>
        </tr>
      </thead>
      <tbody>
        ${ratings.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${r.player}</td>
            <td>${Math.round(r.elo)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
