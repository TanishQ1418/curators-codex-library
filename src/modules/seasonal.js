// ── SEASONAL ARCHIVE MODULE ─────────────────────────────────────────

import { esc, safeUrl } from "../utils/helpers.js";

const SEASON_ORDER = {
  winter: 0,
  spring: 1,
  summer: 2,
  fall: 3,
};

function parseSeasonSortKey(key) {
  const m = String(key || "").trim().match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (!m) return -1;
  const sIdx = SEASON_ORDER[m[1].toLowerCase()] ?? -1;
  const yr = parseInt(m[2], 10) || 0;
  return yr * 10 + sIdx;
}

export const renderSeasonal = (window.renderSeasonal = () => {
  const c = document.getElementById("seasonalContainer");
  const filterEl = document.getElementById("seasonalFilter");
  if (!c || !filterEl) return;
  const fSeason = filterEl.value;

  const seasons = {};
  (window.library || []).forEach((l) => {
    const raw = String(l.season || "").trim();
    if (!raw) return;
    const m = raw.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
    const key = m
      ? `${m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()} ${m[2]}`
      : "Other";
    if (!seasons[key]) seasons[key] = [];
    seasons[key].push(l);
  });

  const sortedKeys = Object.keys(seasons).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return parseSeasonSortKey(b) - parseSeasonSortKey(a);
  });

  filterEl.innerHTML =
    '<option value="">All Seasons</option>' +
    sortedKeys.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join("");
  filterEl.value = sortedKeys.includes(fSeason) ? fSeason : "";

  let html = "";
  sortedKeys.forEach((k) => {
    if (filterEl.value && k !== filterEl.value) return;
    const items = seasons[k];
    html += `
      <div class="season-group-card">
          <div class="season-group-header">
              <div class="season-group-name">${esc(k)}</div>
              <div class="season-group-count">${items.length} titles</div>
          </div>
          <div>
              ${items
                .map((l) => {
                  const poster = safeUrl(l.poster);
                  const safeId = esc(String(l.id || ""));
                  return `
                  <div class="season-entry-row" data-act="openDetail" data-id="${safeId}">
                      <div class="season-entry-poster">${
                        poster
                          ? `<img src="${esc(poster)}" alt="${esc(l.title)} poster" referrerpolicy="no-referrer" data-fallback="emoji" />`
                          : "🎬"
                      }</div>
                      <div class="season-entry-title">${esc(l.title)}</div>
                      <div style="font-size:12px;font-weight:600;color:var(--text-muted);width:100px;text-align:right">${esc(l.status || "")}</div>
                  </div>
              `;
                })
                .join("")}
          </div>
      </div>
  `;
  });

  if (!html)
    html =
      '<div class="empty-state"><div class="empty-icon">🌸</div><h3>No Seasonal Data</h3><p>Tag entries with a season (e.g., "Winter 2024") to see them here.</p></div>';
  c.innerHTML = html;
});
