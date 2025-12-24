document.addEventListener("DOMContentLoaded", () => {
  fetchRatings().then(ratings => {
    renderRatings("elo-top", ratings);
  });
});