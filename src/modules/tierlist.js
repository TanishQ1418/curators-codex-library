// ── TIER LIST VIEW MODULE ──────────────────────────────────────────

export const renderTierList = (window.renderTierList = () => {
  const c = document.getElementById("tierListContainer");
  if (!c) return;
  const tiers = ["S", "A", "B", "C", "D", "E", "F"];

  let html = "";
  tiers.forEach((t) => {
    const items = (window.library || []).filter((l) => l.tier === t);
    html += `
      <div class="tier-row">
          <div class="tier-row-header">
              <div class="tier-label-block tier-label-${t}">${t}</div>
              <div class="tier-divider"></div>
              <div class="tier-entry-count">${items.length} ENTRIES</div>
          </div>
          <div class="tier-posters">
              ${
                items.length
                  ? items
                      .map(
                        (l) => `
                  <div class="tier-poster-thumb" onclick="window.openDetailModal('${l.id}')" title="${l.title}">
                      <img src="${l.poster}" onerror="this.outerHTML='🎬'" />
                  </div>
              `,
                      )
                      .join("")
                  : `<div class="tier-empty-placeholder">No entries in ${t} Tier yet.</div>`
              }
          </div>
      </div>
  `;
  });
  c.innerHTML = html;
});
