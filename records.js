// ----------------------------
// Helpers
// ----------------------------

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

function getCompetitionName(m) {
  // adjust these keys to whatever your API returns
  return (
    m.competition_name ||
    m.competition ||
    m.tournament ||
    m.event ||
    ""
  );
}

function getMatchDate(m) {
  // adjust these keys to whatever your API returns
  return (
    m.date ||
    m.match_date ||
    m.played_at ||
    m.created_at ||
    ""
  );
}

function fetchMatches() {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "matches" });
  return fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

// ----------------------------
// Core computation
// ----------------------------

function computeRecords(matches, ratedOnly = true) {
  const filtered = ratedOnly
    ? matches.filter(m => isTrue(m.elo_applied))
    : matches;

  const playerTotals = new Map();
  const matchRecords = [];

  // for most common matchups
  const matchupCounts = new Map();

  for (const m of filtered) {
    const p1 = m.player1;
    const p2 = m.player2;

    const totalSlaps = toNum(m.player1_slaps) + toNum(m.player2_slaps);
    const totalGames = toNum(m.player1_games) + toNum(m.player2_games);

    const dateStr = formatDate(getMatchDate(m));
    const compName = getCompetitionName(m);

    // Determine which player's Elo delta is the larger magnitude
    const p1Delta = toNum(m.p1_elo_delta);
    const p2Delta = toNum(m.p2_elo_delta);

    const abs1 = Math.abs(p1Delta);
    const abs2 = Math.abs(p2Delta);

    const eloMainPlayer = abs1 >= abs2 ? m.player1 : m.player2;
    const eloOtherPlayer = abs1 >= abs2 ? m.player2 : m.player1;

    const eloMainDelta = abs1 >= abs2 ? p1Delta : p2Delta;
    const eloOutcome =
      eloMainDelta > 0 ? "gain" : (eloMainDelta < 0 ? "loss" : "no change");


    matchRecords.push({
      ...m,
      totalSlaps,
      totalGames,
      dateStr,
      compName,
      eloMainPlayer,
      eloOtherPlayer,
      eloMainDelta,
      eloOutcome
    });

    // count matchup (order-independent)
    if (p1 && p2) {
      const a = String(p1);
      const b = String(p2);
      const key = a < b ? `${a}|||${b}` : `${b}|||${a}`;
      matchupCounts.set(key, (matchupCounts.get(key) || 0) + 1);
    }

    for (const side of [1, 2]) {
      const name = m[`player${side}`];
      if (!name) continue;

      if (!playerTotals.has(name)) {
        playerTotals.set(name, {
          name,
          matches: 0,
          slaps: 0,
          games: 0,
          yellow: 0,
          red: 0,
          wins: 0
        });
      }

      const p = playerTotals.get(name);

      p.matches++;
      p.slaps += toNum(m[`player${side}_slaps`]);
      p.games += toNum(m[`player${side}_games`]);
      p.yellow += toNum(m[`player${side}_yellow`]);
      p.red += toNum(m[`player${side}_red`]);

      if (m.winner === name) p.wins++;
    }
  }

  const players = Array.from(playerTotals.values());

    // averages (guard against divide-by-zero)
    // Only include players with at least 5 matches
    const eligiblePlayers = players.filter(p => p.matches >= 5);

    // averages
    const playersWithAvgs = eligiblePlayers.map(p => ({
      ...p,
      avgGames: p.games / p.matches,
      avgSlaps: p.slaps / p.matches
    }));



  const topMatchups = Array.from(matchupCounts.entries())
    .map(([key, count]) => {
      const [a, b] = key.split("|||");
      return { a, b, count };
    })
    .sort((x, y) => y.count - x.count)
    .slice(0, 5);

  return {
    topSlapsPlayers:  [...players].sort((a,b)=>b.slaps-a.slaps).slice(0,5),
    topMatchesPlayers:[...players].sort((a,b)=>b.matches-a.matches).slice(0,5),
    topGamesPlayers:  [...players].sort((a,b)=>b.games-a.games).slice(0,5),
    topRedPlayers:    [...players].sort((a,b)=>b.red-a.red).slice(0,5),

    topSlapMatches:   [...matchRecords].sort((a,b)=>b.totalSlaps-a.totalSlaps).slice(0,5),
    topGameMatches:   [...matchRecords].sort((a,b)=>b.totalGames-a.totalGames).slice(0,5),
    topEloSwings: [...matchRecords]
      .sort((a,b)=>Math.abs(b.eloMainDelta) - Math.abs(a.eloMainDelta))
      .slice(0,5),

      topAvgGamesPlayers: [...playersWithAvgs].sort((a,b)=>b.avgGames-a.avgGames).slice(0,5),
  lowAvgGamesPlayers: [...playersWithAvgs].sort((a,b)=>a.avgGames-b.avgGames).slice(0,5),

  topAvgSlapsPlayers: [...playersWithAvgs].sort((a,b)=>b.avgSlaps-a.avgSlaps).slice(0,5),
  lowAvgSlapsPlayers: [...playersWithAvgs].sort((a,b)=>a.avgSlaps-b.avgSlaps).slice(0,5),


    topMatchups
  };
}

// ----------------------------
// Rendering
// ----------------------------

function renderRecords(records, ratedOnly) {
  const subtitle = document.getElementById("recordsSubtitle");
  if (subtitle) subtitle.textContent = ratedOnly ? "(Rated matches only)" : "(All matches)";

  function renderPlayerList(list, metric, opts = {}) {
    const { decimals = 0, suffix = "" } = opts;

    return list.map((p,i)=>{
      const raw = p[metric] ?? 0;
      const val = (typeof raw === "number")
        ? raw.toFixed(decimals)
        : raw;

      return `
        <div class="leader-row">
          <span class="leader-rank">${i+1}.</span>
          <span class="leader-name">${p.name}</span>
          <span class="leader-value">${val}${suffix}</span>
        </div>
      `;
    }).join("");
  }


  function renderEloChangeList(list) {
    return list.map((m,i)=> {
      const delta = toNum(m.eloMainDelta);
      const signed = delta > 0 ? `+${delta}` : `${delta}`; // keep minus as-is

      // Optional: show win/loss based on the delta sign (more robust than relying on "winner")
      const label = delta > 0 ? "gain" : (delta < 0 ? "loss" : "no change");

      return `
        <div class="leader-row" style="align-items:flex-start;">
          <span class="leader-rank">${i+1}.</span>

          <span>
            <div>
              <strong>${m.eloMainPlayer}</strong>
              <span class="muted">vs ${m.eloOtherPlayer}</span>
            </div>

            <div class="muted" style="font-size:0.9em; margin-top:2px;">
              ${m.dateStr ? m.dateStr : "—"}
              ${m.compName ? ` • ${m.compName}` : ""}
            </div>
          </span>

          <span class="leader-value">${signed} <span class="muted">(${label})</span></span>
        </div>
      `;
    }).join("");
  }


  function renderMatchList(list, valueKey) {
    return list.map((m,i)=>`
      <div class="leader-row" style="align-items:flex-start;">
        <span class="leader-rank">${i+1}.</span>

        <span>
          <div>${m.player1} vs ${m.player2}</div>
          <div class="muted" style="font-size:0.9em; margin-top:2px;">
            ${m.dateStr ? m.dateStr : "—"}
            ${m.compName ? ` • ${m.compName}` : ""}
          </div>
        </span>

        <span class="leader-value">${m[valueKey]}</span>
      </div>
    `).join("");
  }

  function renderMatchups(list) {
    if (!list.length) return `<div class="muted">No matchup data available.</div>`;
    return list.map((x,i)=>`
      <div class="leader-row">
        <span class="leader-rank">${i+1}.</span>
        <span>${x.a} vs ${x.b}</span>
        <span class="leader-value">${x.count}</span>
      </div>
    `).join("");
  }

  document.getElementById("lbMostSlaps").innerHTML =
    renderPlayerList(records.topSlapsPlayers, "slaps");

  document.getElementById("lbMostMatches").innerHTML =
    renderPlayerList(records.topMatchesPlayers, "matches");

  document.getElementById("lbMostGames").innerHTML =
    renderPlayerList(records.topGamesPlayers, "games");

  document.getElementById("lbMostCards").innerHTML =
    renderPlayerList(records.topRedPlayers, "red");

  // Avg games per match
  document.getElementById("lbAvgGamesHigh").innerHTML =
    renderPlayerList(records.topAvgGamesPlayers, "avgGames", { decimals: 2 });

  document.getElementById("lbAvgGamesLow").innerHTML =
    renderPlayerList(records.lowAvgGamesPlayers, "avgGames", { decimals: 2 });

  // Avg slaps per match
  document.getElementById("lbAvgSlapsHigh").innerHTML =
    renderPlayerList(records.topAvgSlapsPlayers, "avgSlaps", { decimals: 2 });

  document.getElementById("lbAvgSlapsLow").innerHTML =
    renderPlayerList(records.lowAvgSlapsPlayers, "avgSlaps", { decimals: 2 });


  document.getElementById("recordsMatchTable").innerHTML = `
    <h3 style="margin:0 0 10px 0;">🤝 Most common matchups</h3>
    ${renderMatchups(records.topMatchups)}

    <h3 style="margin-top:22px;">🔥 Highest Slap Matches</h3>
    ${renderMatchList(records.topSlapMatches, "totalSlaps")}

    <h3 style="margin-top:22px;">🎮 Longest Matches</h3>
    ${renderMatchList(records.topGameMatches, "totalGames")}

    <h3 style="margin-top:22px;">⚡ Biggest Elo Changes</h3>
    ${renderEloChangeList(records.topEloSwings)}
  `;
}

// ----------------------------
// Loading / error UI helpers
// ----------------------------

function setLoading(isLoading) {
  const el = document.getElementById("recordsLoading");
  if (!el) return;
  el.style.display = isLoading ? "flex" : "none";
}

function setError(isError) {
  const el = document.getElementById("recordsError");
  if (!el) return;
  el.classList.toggle("hidden", !isError);
}

// ----------------------------
// Init
// ----------------------------

(async function init() {
  const toggle = document.getElementById("recordsRatedOnly");
  if (!toggle) return;

  setError(false);
  setLoading(true);

  try {
    const matches = await fetchMatches();

    function run() {
      const includeFriendlies = toggle.checked;
      const ratedOnly = !includeFriendlies; // OFF = rated only

      const records = computeRecords(matches, ratedOnly);
      renderRecords(records, ratedOnly);

      // ✅ hide loading once we have rendered
      setLoading(false);
    }

    toggle.addEventListener("change", run);
    run();
  } catch (err) {
    console.error("Failed to load records:", err);
    setLoading(false);  // ✅ hide loading on error too
    setError(true);
  }
})();
