document.addEventListener("DOMContentLoaded", () => {
    fetchRatings().then(ratings => {
    console.log("Fetched ratings:", ratings);
    renderRatings("elo-full", ratings);
    });
});

