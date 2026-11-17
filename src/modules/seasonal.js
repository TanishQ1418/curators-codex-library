// ── SEASONAL ARCHIVE MODULE ─────────────────────────────────────────

export const renderSeasonal = (window.renderSeasonal = () => {
  const c = document.getElementById("seasonalContainer");
  const filterEl = document.getElementById("seasonalFilter");
  if (!c || !filterEl) return;
  const fSeason = filterEl.value;

  const seasons = {};
  (window.library || []).forEach((l) => {
    if (l.season) {
      if (!seasons[l.season]) seasons[l.season] = [];
      seasons[l.season].push(l);
    }
  });

  const sortedKeys = Object.keys(seasons).sort().reverse();

  filterEl.innerHTML =
    '<option value="">All Seasons</option>' +
    sortedKeys.map((k) => `<option value="${k}">${k}</option>`).join("");
  filterEl.value = fSeason;

  let html = "";
  sortedKeys.forEach((k) => {
    if (fSeason && k !== fSeason) return;
    const items = seasons[k];
    html += `
      <div class="season-group-card">
          <div class="season-group-header">
              <div class="season-group-name">${k}</div>
              <div class="season-group-count">${items.length} titles</div>
          </div>
          <div>
              ${items
                .map(
                  (l) => `
                  <div class="season-entry-row" onclick="window.openDetailModal('${l.id}')">
                      <div class="season-entry-poster"><img src="${l.poster}" onerror="this.outerHTML='🎬'" /></div>
                      <div class="season-entry-title">${l.title}</div>
                      <div style="font-size:12px;font-weight:600;color:var(--text-muted);width:100px;text-align:right">${l.status}</div>
                  </div>
              `,
                )
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
