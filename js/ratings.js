console.log("ratings.js loaded");
console.log("API in ratings.js:", window.API);

function countryCodeToFlag(code) {
  const c = String(code || "GB").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🇬🇧";
  return c.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
}


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
            <th>Form (last 5)</th>
          </tr>
        </thead>
        <tbody>
          ${ratings.map((r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>
                <span class="flag">${countryCodeToFlag(r.flag || "GB")}</span>
                <span class="player-name">${r.player_name}</span>
              </td>
              <td>${Math.round(r.elo)}</td>
              <td>${r.games_played}</td>
              <td class="form5">${r.form5 || "-----"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

