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

document.addEventListener("DOMContentLoaded", () => {

  function downloadFile(action) {
    const url = new URL(API.BASE);
    url.search = new URLSearchParams({ action });
    window.location.href = url;
  }

  const ratingsBtn = document.getElementById("downloadRatings");
  const matchesBtn = document.getElementById("downloadMatches");

  if (ratingsBtn) {
    ratingsBtn.addEventListener("click", () => downloadFile("download_ratings"));
  }

  if (matchesBtn) {
    matchesBtn.addEventListener("click", () => downloadFile("download_matches"));
  }

});
