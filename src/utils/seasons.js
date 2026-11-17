// ── SEASONS TRACKER STATE & UTILS ───────────────────────────────────

export let currentWatchedSeasons = [];
window.currentWatchedSeasons = currentWatchedSeasons;

export function setWatchedSeasons(seasons) {
  currentWatchedSeasons = seasons || [];
  window.currentWatchedSeasons = currentWatchedSeasons;
}
window.setWatchedSeasons = setWatchedSeasons;

// Render season chips based on total season count input
export function renderSeasonChips() {
  const countInput = document.getElementById("field-seasonCount");
  const count = parseInt(countInput ? countInput.value : 0) || 0;
  const container = document.getElementById("seasonChipsContainer");
  if (!container) return;
  if (count < 1) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const watched = currentWatchedSeasons.includes(n);
    return `<div class="season-chip ${watched ? "watched" : ""}"
      onclick="window.toggleSeasonChip(${n}, this)">
      S${n} ${watched ? "✓" : "○"}
    </div>`;
  }).join("");
}
window.renderSeasonChips = renderSeasonChips;

// Toggle a season chip between watched/unwatched when clicked
export function toggleSeasonChip(n, el) {
  const idx = currentWatchedSeasons.indexOf(n);
  if (idx > -1) {
    currentWatchedSeasons.splice(idx, 1);
    if (el) {
      el.classList.remove("watched");
      el.textContent = `S${n} ○`;
    }
  } else {
    currentWatchedSeasons.push(n);
    if (el) {
      el.classList.add("watched");
      el.textContent = `S${n} ✓`;
    }
  }
}
window.toggleSeasonChip = toggleSeasonChip;

export function onTypeChange() {
  // Show the seasons tracker for Anime and Web Series only
  const typeField = document.getElementById("field-type");
  const t = typeField ? typeField.value : "";
  const showSeasons = t === "Anime" || t === "Web Series";
  const group = document.getElementById("seasonsTrackerGroup");
  if (group) {
    group.style.display = showSeasons ? "block" : "none";
  }
  if (showSeasons) {
    renderSeasonChips();
  }
}
window.onTypeChange = onTypeChange;
