console.log("ratings.js LOADED — version 2026-02-04-emoji-test");
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
    <div class="table-wrap">
      <table class="table table-compact">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th>Player</th>
            <th class="col-num">Elo</th>
            <th class="col-num">Games</th>
            <th class="col-form">Form (last 5)</th>
          </tr>
        </thead>
        <tbody>
          ${ratings.map((r, i) => `
            <tr>
              <td class="col-rank">${i + 1}</td>
              <td>
                <span class="player-cell">
                  <span class="flag">${countryCodeToFlag(r.flag || "GB")}</span>
                  <a class="player-link" href="player.html?player=${encodeURIComponent(r.player_name)}">
                    ${r.player_name}
                  </a>
                </span>
              </td>
              <td class="col-num">${Math.round(r.elo)}</td>
              <td class="col-num">${r.games_played}</td>
              <td class="col-form"><span class="form5">${r.form5 || "-----"}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  if (window.twemoji) {
    window.twemoji.parse(container, { folder: "svg", ext: ".svg" });
  }
}



