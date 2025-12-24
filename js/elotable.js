document.addEventListener("DOMContentLoaded", () => {
  fetchRatings().then(ratings => {
    renderRatings("elo-full", ratings);
  });
});

// Updated fetchRatings to avoid limit=undefined
async function fetchRatings(limit) {
  const baseUrl = "https://script.google.com/macros/s/AKfycbxO9lWeFfz0mH4Spw5zQ67wsN3I1hpoHB89fkRJQ0ve9QsSL5j-FMrU09c7c-M2-s-o/exec";
  
  // Only include limit if it is defined
  const params = new URLSearchParams({ action: "ratings" });
  if (limit != null) params.set("limit", limit);

  const response = await fetch(`${baseUrl}?${params.toString()}`);
  const data = await response.json();
  return data;
}
