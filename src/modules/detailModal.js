// ── DETAIL VIEW MODAL MODULE ───────────────────────────────────────

export const openDetailModal = (window.openDetailModal = (
  id,
  friendMode = false,
) => {
  let entry;
  if (typeof id === "object" && id !== null) {
    entry = id;
  } else {
    const sourceLib = friendMode
      ? window.currentFriendLibrary
      : window.library;
    entry = (sourceLib || []).find((l) => l.id === String(id));
  }
  if (!entry) return;

  const hero = document.getElementById("detailHero");
  const body = document.getElementById("detailBody");
  if (!hero || !body) return;

  hero.innerHTML = `
    <img src="${entry.poster || ""}" class="detail-hero-bg" onerror="this.style.display='none'" />
    <div class="detail-hero-overlay"></div>
    <div class="detail-hero-content">
        ${
          entry.poster
            ? `<img src="${entry.poster}" class="detail-poster-thumb" onerror="this.outerHTML='<div class=\\'detail-poster-thumb-placeholder\\'>🎬</div>'" />`
            : `<div class="detail-poster-thumb-placeholder">🎬</div>`
        }
        <div class="detail-hero-info">
            <div class="detail-title">${entry.title}</div>
            <div class="detail-meta-row">
                <span class="badge badge-type" style="font-size:12px;padding:3px 10px">${entry.type}</span>
                <span style="font-size:13px;font-weight:600;color:var(--text-secondary)">${entry.year || ""}</span>
                ${entry.tier ? `<span class="tier-label-${entry.tier}" style="font-size:14px;font-weight:700;padding:2px 10px;border-radius:4px">${entry.tier} TIER</span>` : ""}
            </div>
        </div>
    </div>
  `;

  // Action buttons placed at top of details section (under hero image and title)
  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        ${
          friendMode === true
            ? `
            <button class="btn btn-primary" style="flex:1;min-width:140px;justify-content:center" onclick="window.closeDetailModal(); window.addFriendLibToCodex('${entry.id}')">Add to Codex</button>
        `
            : entry.isRec
              ? `
            <button class="btn btn-primary" style="flex:1;min-width:140px;justify-content:center" onclick="window.closeDetailModal(); window.addRecToLibrary('${entry.notifId}')">Add to Codex</button>
        `
              : `
            <button class="btn btn-primary" style="flex:1;min-width:130px;justify-content:center" onclick="window.closeDetailModal(); window.editEntry('${entry.id}')">✏️ Edit Entry</button>
            <button class="btn btn-ghost" style="flex:1;min-width:130px;justify-content:center" onclick="window.closeDetailModal(); window.openRecommendModalById('${entry.id}')">🎁 Recommend</button>
            <button class="btn btn-danger" style="flex:1;min-width:90px;justify-content:center" onclick="window.deleteEntry('${entry.id}')">🗑️ Delete</button>
        `
        }
    </div>

    ${
      entry.genres && entry.genres.length
        ? `
       <div class="detail-section-label">Genres</div>
       <div class="detail-genres">
          ${entry.genres.map((g) => `<span class="genre-tag">${g}</span>`).join("")}
       </div>
    `
        : ""
    }
    
    <div class="detail-section-label">Status</div>
    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px;">
        ${entry.status} ${entry.episodes ? ` • ${entry.episodes} Episodes Watched` : ""}
    </div>
    
    ${
      entry.notes
        ? `
       <div class="detail-section-label">Personal Notes</div>
       <div class="detail-notes">${entry.notes.replace(/\n/g, "<br>")}</div>
    `
        : ""
    }
    
    ${
      entry.season
        ? `
       <div class="detail-section-label">Season</div>
       <div style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">${entry.season}</div>
    `
        : ""
    }
    
    ${
      entry.link
        ? `
       <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" style="margin-top:10px; width:100%; justify-content:center;">🔗 View External Information</a>
    `
        : ""
    }
  `;

  document.getElementById("detailModalOverlay")?.classList.add("open");
});

export const closeDetailModal = (window.closeDetailModal = () => {
  document.getElementById("detailModalOverlay")?.classList.remove("open");
});

export const handleOverlayClick = (window.handleOverlayClick = (e, id) => {
  if (e.target.id === id) {
    document.getElementById(id)?.classList.remove("open");
  }
});
