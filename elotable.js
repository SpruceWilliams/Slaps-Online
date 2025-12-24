document.addEventListener("DOMContentLoaded", () => {
  fetchRatings().then(ratings => {
    renderRatings("elo-full", ratings);
  });
});

