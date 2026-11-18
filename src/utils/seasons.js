// ── SEASONS TRACKER STATE & UTILS ───────────────────────────────────

import { registerActions } from "./helpers.js";

export let currentWatchedSeasons = [];
window.currentWatchedSeasons = currentWatchedSeasons;

export function setWatchedSeasons(seasons) {
  currentWatchedSeasons = Array.isArray(seasons)
    ? seasons.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  window.currentWatchedSeasons = currentWatchedSeasons;
}
window.setWatchedSeasons = setWatchedSeasons;

// Render season chips based on total season count input
export function renderSeasonChips() {
  const countInput = document.getElementById("field-seasonCount");
  const count = parseInt(countInput ? countInput.value : 0, 10) || 0;
  const container = document.getElementById("seasonChipsContainer");
  if (!container) return;
  if (count < 1) {
    container.innerHTML = "";
    return;
  }
  container.innerHTML = Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const watched = currentWatchedSeasons.includes(n);
    return `<button type="button" class="season-chip ${watched ? "watched" : ""}" data-act="toggleSeasonChip" data-season="${n}" aria-pressed="${watched ? "true" : "false"}">S${n} ${watched ? "✓" : "○"}</button>`;
  }).join("");
}
window.renderSeasonChips = renderSeasonChips;

// Toggle a season chip between watched/unwatched when clicked
export function toggleSeasonChip(n, el) {
  const num = parseInt(n, 10);
  if (!Number.isFinite(num)) return;
  const idx = currentWatchedSeasons.indexOf(num);
  if (idx > -1) {
    currentWatchedSeasons.splice(idx, 1);
    if (el) {
      el.classList.remove("watched");
      el.setAttribute("aria-pressed", "false");
      el.textContent = `S${num} ○`;
    }
  } else {
    currentWatchedSeasons.push(num);
    if (el) {
      el.classList.add("watched");
      el.setAttribute("aria-pressed", "true");
      el.textContent = `S${num} ✓`;
    }
  }
}
window.toggleSeasonChip = toggleSeasonChip;

registerActions({
  toggleSeasonChip: (d, el) => toggleSeasonChip(d.season, el),
});

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
