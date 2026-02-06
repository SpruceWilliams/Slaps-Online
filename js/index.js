document.addEventListener("DOMContentLoaded", () => {

  // Top 6 ratings
  fetchRatings(6).then(ratings => {
    renderRatings("elo-top", ratings);
  });

  // Matches (newest 10)
  fetchMatches().then(matches => {

    // sort newest first using safe parser
    const sorted = matches.slice().sort((a, b) => {
      const da = parseSheetDate(a.date);
      const db = parseSheetDate(b.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });

    renderMatches("matches-top", sorted.slice(0, 10));

    // Also render past competitions from matches
    renderCompetitions("recentCompetitions", matches);
  });

  // Downloads
  function downloadFile(action) {
    const url = new URL(API.BASE);
    url.search = new URLSearchParams({ action });
    window.location.href = url;
  }

  document.getElementById("downloadRatings")
    ?.addEventListener("click", () => downloadFile("download_ratings"));

  document.getElementById("downloadMatches")
    ?.addEventListener("click", () => downloadFile("download_matches"));

});


function parseSheetDate(s) {
  if (!s) return null;
  const str = String(s).trim();
  if (!str) return null;

  // YYYY-MM-DD
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    return new Date(Date.UTC(y, mo - 1, d));
  }

  // DD/MM/YYYY
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    return new Date(Date.UTC(y, mo - 1, d));
  }

  // Fallback (handles ISO datetime etc.)
  const t = Date.parse(str);
  return Number.isFinite(t) ? new Date(t) : null;
}


function toISODate(dt) {
  if (!dt) return "";
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


function fetchCompetitions(limit = 40) {
  const url = new URL(API.BASE);
  url.search = new URLSearchParams({ action: "competitions", limit });
  return fetch(url).then(r => r.json());
}

function renderCompetitions(containerId, matches) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const parseDateSafe = (s) => parseSheetDate(s);

  const isRatedMatch = (m) => {
    const mt = String(m.match_type || "").toLowerCase();
    if (mt) return mt !== "friendly";
    return m.elo_applied === true || String(m.elo_applied).toLowerCase() === "true";
  };

  // --- 1) Aggregate matches -> competitions ---
  const compMap = new Map();

  for (const m of (matches || [])) {
    const name = (m.competition_name || "").trim();
    if (!name) continue;

    const d = parseDateSafe(m.date);
    const rated = isRatedMatch(m);

    if (!compMap.has(name)) {
      compMap.set(name, {
        competition_name: name,
        minDate: d,
        maxDate: d,
        hasRated: rated,
        matchCount: 1
      });
    } else {
      const c = compMap.get(name);
      c.matchCount += 1;
      c.hasRated = c.hasRated || rated;

      if (d) {
        if (!c.minDate || d < c.minDate) c.minDate = d;
        if (!c.maxDate || d > c.maxDate) c.maxDate = d;
      }
    }
  }

  const comps = Array.from(compMap.values());

  // --- 2) Group competitions by year ---
  const groups = new Map();

  for (const c of comps) {
    const year = c.maxDate ? c.maxDate.getUTCFullYear() : "Unknown";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(c);
  }

  const years = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return Number(b) - Number(a);
  });

  const fmt = (d) =>
    d
      ? d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit"
        })
      : "";

  const rangeText = (c) => {
    if (!c.minDate && !c.maxDate) return "";
    const a = fmt(c.minDate);
    const b = fmt(c.maxDate);
    if (a && b && a !== b) return `${a} – ${b}`;
    return a || b;
  };

  el.innerHTML = years
    .map((year) => {
      const list = groups.get(year).slice();

      list.sort((x, y) => {
        const tx = x.maxDate ? x.maxDate.getTime() : -Infinity;
        const ty = y.maxDate ? y.maxDate.getTime() : -Infinity;
        return ty - tx;
      });

      const items = list
        .map((c) => {
          const dateRange = rangeText(c);
          return `
            <li class="event-item ${c.hasRated ? "rated-event" : ""}">
              <a class="event-link" href="competition.html?comp=${encodeURIComponent(c.competition_name)}">
                <span class="event-name">
                  ${c.competition_name}
                  ${c.hasRated ? `<span class="event-badge">Rated</span>` : ""}
                </span>
                <span class="event-meta muted">
                  ${dateRange}
                  ${c.matchCount ? ` · ${c.matchCount} match${c.matchCount === 1 ? "" : "es"}` : ""}
                </span>
              </a>
            </li>
          `;
        })
        .join("");

      return `
        <div class="event-year">
          <div class="event-year-title">${year}</div>
          <ul class="event-list-year">
            ${items || `<li class="muted">No events</li>`}
          </ul>
        </div>
      `;
    })
    .join("");
}


