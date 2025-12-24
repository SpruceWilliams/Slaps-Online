document.addEventListener("DOMContentLoaded", () => {
  fetchRatings(6).then(ratings => {
    renderRatings("elo-top", ratings);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  fetchMatches().then(matches => {
    const bottom10 = matches.slice(-10); // oldest 10
    renderMatches("matches-top", bottom10);
  });
});

