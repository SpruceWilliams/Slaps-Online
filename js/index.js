document.addEventListener("DOMContentLoaded", () => {
  fetchRatings(6).then(ratings => {
    renderRatings("elo-top", ratings);
  });
});