document.addEventListener("DOMContentLoaded", () => {
    fetchMatches().then(matches => {
    console.log("Fetched matches:", matches);
    renderMatches("matches-full", matches);
    });
});

