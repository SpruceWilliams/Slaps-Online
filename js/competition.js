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
function getCompFromURL() {
  const u = new URL(window.location.href);
  return (u.searchParams.get("comp") || "").trim();
}
function countryCodeToFlag(code) {
  const c = String(code || "GB").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🇬🇧";
  return c.replace(/./g, ch => String.fromCodePoint(127397 + ch.charCodeAt(0)));
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

function expectedScore(Rp, Ropp) {
  return 1 / (1 + Math.pow(10, (Ropp - Rp) / 400));
}

// Solve Rp s.t. sum expected = observed
function performanceRating(opponentRatings, observedScores) {
  // Use only valid opponent ratings (>0)
  const pairs = opponentRatings
    .map((r, i) => ({ r: Number(r), s: Number(observedScores[i]) }))
    .filter(x => Number.isFinite(x.r) && x.r > 0 && Number.isFinite(x.s));

  if (!pairs.length) return null;

  const Rs = pairs.map(x => x.r);
  const Ss = pairs.map(x => x.s);

  const n = Ss.length;
  const S = Ss.reduce((a, b) => a + b, 0);
  const Ravg = Rs.reduce((a, b) => a + b, 0) / n;

  // Laplace smoothing to avoid p=0 or p=1 infinities (important for small n)
  const p = (S + 0.5) / (n + 1); // always in (0,1)

  // Elo logistic inverse: D = -400*log10(1/p - 1)
  const D = -400 * Math.log10(1 / p - 1);

  // Optional: clamp to avoid silly extremes in tiny samples
  const perf = Ravg + D;
  const clamp = 800; // you can use 600 if you want it tighter
  return Math.max(Ravg - clamp, Math.min(Ravg + clamp, perf));
}


function buildFlagMap(ratings) {
  const map = {};
  (ratings || []).forEach(r => {
    map[r.player_name] = (r.flag && String(r.flag).trim()) ? String(r.flag).trim() : "GB";
  });
  return map;
}

function filterCompetition(matches, compName) {
  return matches
    .filter(m => String(m.competition_name || "").trim() === compName)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date)); // chronological
}

function computeCompetitionStats(compMatches) {
  const players = new Set();
  let longestByGames = null, maxGames = -1;
  let mostSlaps = null, maxSlaps = -1;

  for (const m of compMatches) {
    players.add(m.player1);
    players.add(m.player2);

    const totalGames = toNum(m.player1_games) + toNum(m.player2_games);
    if (totalGames > maxGames) { maxGames = totalGames; longestByGames = m; }

    const totalSlaps = toNum(m.player1_slaps) + toNum(m.player2_slaps);
    if (totalSlaps > maxSlaps) { maxSlaps = totalSlaps; mostSlaps = m; }
  }

  return {
    matchCount: compMatches.length,
    playerCount: players.size,
    longestByGames, maxGames,
    mostSlaps, maxSlaps
  };
}

function computeStandings(compMatches) {
  // per player aggregates
  const agg = {}; // name -> stats

  function ensure(p) {
    if (!agg[p]) {
      agg[p] = {
        player: p,
        matches: 0,
        wins: 0,
        losses: 0,
        gamesFor: 0,
        gamesAgainst: 0,
        slapsFor: 0,
        slapsAgainst: 0,
        yellow: 0,
        red: 0,
        oppRatings: [],
        scores: [],
        results: [] // for the “chess-results style” card
      };
    }
    return agg[p];
  }

  compMatches.forEach((m, idx) => {
    const p1 = m.player1;
    const p2 = m.player2;
    const w = m.winner;

    const s1 = ensure(p1);
    const s2 = ensure(p2);

    const p1win = (w === p1);
    const p2win = (w === p2);

    // If you ever have draws, set score = 0.5 accordingly
    const p1Score = p1win ? 1 : 0;
    const p2Score = p2win ? 1 : 0;

    // opponent rating before match (rated matches only are meaningful)
    const p1OppR = toNum(m.p2_elo_before);
    const p2OppR = toNum(m.p1_elo_before);

    // update p1
    s1.matches++;
    s1.wins += p1win ? 1 : 0;
    s1.losses += p1win ? 0 : 1;
    s1.gamesFor += toNum(m.player1_games);
    s1.gamesAgainst += toNum(m.player2_games);
    s1.slapsFor += toNum(m.player1_slaps);
    s1.slapsAgainst += toNum(m.player2_slaps);
    s1.yellow += toNum(m.player1_yellow);
    s1.red += toNum(m.player1_red);
    if (isTrue(m.elo_applied)) { s1.oppRatings.push(p1OppR); s1.scores.push(p1Score); }
    s1.results.push({
      no: idx + 1,
      date: m.date,
      opp: p2,
      oppRating: isTrue(m.elo_applied) ? p1OppR : null,
      res: p1win ? "W" : "L",
      games: `${toNum(m.player1_games)}–${toNum(m.player2_games)}`,
      slaps: `${toNum(m.player1_slaps)}–${toNum(m.player2_slaps)}`
    });

    // update p2
    s2.matches++;
    s2.wins += p2win ? 1 : 0;
    s2.losses += p2win ? 0 : 1;
    s2.gamesFor += toNum(m.player2_games);
    s2.gamesAgainst += toNum(m.player1_games);
    s2.slapsFor += toNum(m.player2_slaps);
    s2.slapsAgainst += toNum(m.player1_slaps);
    s2.yellow += toNum(m.player2_yellow);
    s2.red += toNum(m.player2_red);
    if (isTrue(m.elo_applied)) { s2.oppRatings.push(p2OppR); s2.scores.push(p2Score); }
    s2.results.push({
      no: idx + 1,
      date: m.date,
      opp: p1,
      oppRating: isTrue(m.elo_applied) ? p2OppR : null,
      res: p2win ? "W" : "L",
      games: `${toNum(m.player2_games)}–${toNum(m.player1_games)}`,
      slaps: `${toNum(m.player2_slaps)}–${toNum(m.player1_slaps)}`
    });
  });

  // compute perf rating
  Object.values(agg).forEach(s => {
    s.perf = performanceRating(s.oppRatings, s.scores);
  });

  // sort standings: wins desc, then perf desc, then games share desc
  return Object.values(agg).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const bp = (b.perf ?? -1e9), ap = (a.perf ?? -1e9);
    if (bp !== ap) return bp - ap;
    const aShare = (a.gamesFor + a.gamesAgainst) ? a.gamesFor / (a.gamesFor + a.gamesAgainst) : 0;
    const bShare = (b.gamesFor + b.gamesAgainst) ? b.gamesFor / (b.gamesFor + b.gamesAgainst) : 0;
    return bShare - aShare;
  });
}

function renderSummary(compName, stats) {
  const el = document.getElementById("compSummary");
  const longest = stats.longestByGames
    ? `${formatDate(stats.longestByGames.date)} — ${stats.longestByGames.player1} ${toNum(stats.longestByGames.player1_games)}–${toNum(stats.longestByGames.player2_games)} ${stats.longestByGames.player2} (${stats.maxGames} games)`
    : "-";
  const mostSlaps = stats.mostSlaps
    ? `${formatDate(stats.mostSlaps.date)} — ${stats.mostSlaps.player1} ${toNum(stats.mostSlaps.player1_slaps)}–${toNum(stats.mostSlaps.player2_slaps)} ${stats.mostSlaps.player2} (${stats.maxSlaps} slaps)`
    : "-";

  el.innerHTML = `
    <div class="card">
      <p><strong>${compName}</strong></p>
      <p><strong>Matches:</strong> ${stats.matchCount} &nbsp; <strong>Players:</strong> ${stats.playerCount}</p>
      <p><strong>Longest match (most total games):</strong> ${longest}</p>
      <p><strong>Most slaps in a match:</strong> ${mostSlaps}</p>
      <p style="opacity:.75;">
        <em>Performance rating:</em> Elo-based rating that would produce the player’s observed W/L score vs their opponents’ pre-match Elo, using the standard expected-score formula.
      </p>
    </div>
  `;
}

function renderStandings(standings, flagMap) {
  const el = document.getElementById("compStandings");
  el.innerHTML = `
    <div class="elo-table-wrapper">
      <table class="elo-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>W–L</th>
            <th>Matches</th>
            <th>Games F/A</th>
            <th>Slaps F/A</th>
            <th>Tournament Rating</th>
            <th>🟨</th>
            <th>🟥</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>
                <span class="flag">${countryCodeToFlag(flagMap[s.player] || "GB")}</span>
                <a class="player-link" href="player.html?player=${encodeURIComponent(s.player)}">${s.player}</a>
              </td>
              <td>${s.wins}–${s.losses}</td>
              <td>${s.matches}</td>
              <td>${s.gamesFor}/${s.gamesAgainst}</td>
              <td>${s.slapsFor}/${s.slapsAgainst}</td>
              <td>${s.perf != null ? Math.round(s.perf) : "-"}</td>
              <td>${s.yellow}</td>
              <td>${s.red}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAllMatches(compMatches) {
  const el = document.getElementById("compMatches");
  el.innerHTML = `
    <div class="elo-table-wrapper">
      <table class="elo-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Date</th>
            <th>P1</th>
            <th>Games</th>
            <th>P2</th>
            <th>Slaps</th>
            <th>Rated</th>
          </tr>
        </thead>
        <tbody>
          ${compMatches.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${formatDate(m.date)}</td>
              <td>${m.player1}</td>
              <td>${toNum(m.player1_games)}–${toNum(m.player2_games)}</td>
              <td>${m.player2}</td>
              <td>${toNum(m.player1_slaps)}–${toNum(m.player2_slaps)}</td>
              <td>${isTrue(m.elo_applied) ? "✓" : ""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderPlayerCards(standings, flagMap) {
  const el = document.getElementById("compPlayerCards");
  el.innerHTML = standings.map(s => {
    const rows = s.results.map(r => `
      <tr>
        <td>${r.no}</td>
        <td>${formatDate(r.date)}</td>
        <td>
          <span class="flag">${countryCodeToFlag(flagMap[r.opp] || "GB")}</span>
          ${r.opp}
        </td>
        <td>${r.oppRating != null ? Math.round(r.oppRating) : "-"}</td>
        <td>${r.res}</td>
        <td>${r.games}</td>
        <td>${r.slaps}</td>
      </tr>
    `).join("");

    return `
      <div class="card" style="margin: 12px 0;">
        <p>
          <strong>${s.player}</strong> — ${s.wins}–${s.losses}
          &nbsp; | &nbsp; Performance Rating: ${s.perf != null ? Math.round(s.perf) : "-"}
        </p>
        <div class="elo-table-wrapper">
          <table class="elo-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Opponent</th>
                <th>Opp Rtg</th>
                <th>Res</th>
                <th>Games</th>
                <th>Slaps</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `;
  }).join("");
}

(async function init() {
  const compName = getCompFromURL();
  const loading = document.getElementById("loadingIndicator");

  if (!compName) {
    document.getElementById("compTitle").textContent = "Competition not found";
    if (loading) loading.style.display = "none";
    return;
  }

  try {
    const [matches, ratings] = await Promise.all([fetchMatches(), fetchRatings()]);
    const flagMap = buildFlagMap(ratings);

    document.getElementById("compTitle").textContent = compName;

    const compMatches = filterCompetition(matches, compName);
    const stats = computeCompetitionStats(compMatches);
    const standings = computeStandings(compMatches);

    renderSummary(compName, stats);
    renderStandings(standings, flagMap);
    renderAllMatches(compMatches);
    renderPlayerCards(standings, flagMap);

    if (window.twemoji) {
      window.twemoji.parse(document.body, { folder: "svg", ext: ".svg" });
    }
  } catch (e) {
    console.error(e);
    document.getElementById("compSummary").innerHTML =
      `<p style="color:red;">Failed to load competition.</p>`;
  } finally {
    if (loading) loading.style.display = "none";
  }
})();
