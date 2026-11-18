// ── DETAIL VIEW MODAL MODULE ───────────────────────────────────────

import {
  esc,
  safeUrl,
  registerActions,
  openOverlay,
  closeOverlay,
  getEpisodesWatched,
  getEpisodesTotal,
} from "../utils/helpers.js";

function isEntryInMyCodex(entry) {
  if (!entry) return false;
  const lib = window.library || [];
  const titleKey = (entry.title || "").trim().toLowerCase();
  const typeKey = (entry.type || "").trim().toLowerCase();
  return lib.some((l) => {
    if (entry.stremioId && l.stremioId && entry.stremioId === l.stremioId)
      return true;
    if (entry.malId && l.malId && String(entry.malId) === String(l.malId))
      return true;
    if (entry.kitsuId && l.kitsuId && String(entry.kitsuId) === String(l.kitsuId))
      return true;
    if (entry.jikanId && l.jikanId && String(entry.jikanId) === String(l.jikanId))
      return true;
    return (
      titleKey &&
      (l.title || "").trim().toLowerCase() === titleKey &&
      (!typeKey || (l.type || "").trim().toLowerCase() === typeKey)
    );
  });
}

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
    entry = (sourceLib || []).find((l) => String(l.id) === String(id));
  }
  if (!entry) return;

  const hero = document.getElementById("detailHero");
  const body = document.getElementById("detailBody");
  if (!hero || !body) return;

  const poster = safeUrl(entry.poster);
  const link = safeUrl(entry.link);
  const safePoster = esc(poster);
  const safeTitle = esc(entry.title || "");
  const safeType = esc(entry.type || "");
  const safeYear = esc(entry.year || "");
  const safeTier = esc(entry.tier || "");
  const safeStatus = esc(entry.status || "");
  const safeSeason = esc(entry.season || "");
  const safeId = esc(String(entry.id || ""));
  const safeNotifId = esc(String(entry.notifId || ""));
  const alreadyOwned =
    (friendMode === true || entry.isRec) && isEntryInMyCodex(entry);

  const watched = getEpisodesWatched(entry);
  const total = getEpisodesTotal(entry);
  const epSummary =
    watched > 0 || total > 0
      ? ` • ${watched}${total > 0 ? "/" + total : ""} Episodes Watched`
      : "";

  hero.innerHTML = `
    ${poster ? `<img src="${safePoster}" class="detail-hero-bg" alt="" referrerpolicy="no-referrer" data-fallback="hide" />` : ""}
    <div class="detail-hero-overlay"></div>
    <div class="detail-hero-content">
        ${
          poster
            ? `<img src="${safePoster}" class="detail-poster-thumb" alt="${safeTitle} poster" referrerpolicy="no-referrer" data-fallback="poster-detail" />`
            : `<div class="detail-poster-thumb-placeholder">🎬</div>`
        }
        <div class="detail-hero-info">
            <div class="detail-title">${safeTitle}</div>
            <div class="detail-meta-row">
                <span class="badge badge-type" style="font-size:12px;padding:3px 10px">${safeType}</span>
                ${safeYear ? `<span style="font-size:13px;font-weight:600;color:var(--text-secondary)">${safeYear}</span>` : ""}
                ${entry.tier ? `<span class="tier-label-${safeTier}" style="font-size:14px;font-weight:700;padding:2px 10px;border-radius:4px">${safeTier} TIER</span>` : ""}
            </div>
        </div>
    </div>
  `;

  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--border);align-items:center;">
        ${
          friendMode === true
            ? alreadyOwned
              ? `
            <span style="flex:1;min-width:140px;text-align:center;padding:8px 14px;border-radius:7px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:var(--success);font-weight:700;font-size:13px;">✓ Already in Your Codex</span>
            <button type="button" class="btn btn-ghost" style="justify-content:center" data-act="detailAddFriend" data-id="${safeId}">+ Add Again</button>
        `
              : `
            <button type="button" class="btn btn-primary" style="flex:1;min-width:140px;justify-content:center" data-act="detailAddFriend" data-id="${safeId}">+ Add to Codex</button>
        `
            : entry.isRec
              ? alreadyOwned
                ? `
            <span style="flex:1;min-width:140px;text-align:center;padding:8px 14px;border-radius:7px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);color:var(--success);font-weight:700;font-size:13px;">✓ Already in Your Codex</span>
            <button type="button" class="btn btn-ghost" style="justify-content:center" data-act="detailAddRec" data-id="${safeNotifId}">+ Add Again</button>
        `
                : `
            <button type="button" class="btn btn-primary" style="flex:1;min-width:140px;justify-content:center" data-act="detailAddRec" data-id="${safeNotifId}">+ Add to Codex</button>
        `
              : `
            <button type="button" class="btn btn-primary" style="flex:1;min-width:130px;justify-content:center" data-act="detailEdit" data-id="${safeId}">✏️ Edit Entry</button>
            <button type="button" class="btn btn-ghost" style="flex:1;min-width:130px;justify-content:center" data-act="detailRecommend" data-id="${safeId}">🎁 Recommend</button>
            <button type="button" class="btn btn-danger" style="flex:1;min-width:90px;justify-content:center" data-act="deleteEntry" data-id="${safeId}">🗑️ Delete</button>
        `
        }
    </div>

    ${
      entry.genres && entry.genres.length
        ? `
       <div class="detail-section-label">Genres</div>
       <div class="detail-genres">
          ${entry.genres.map((g) => `<span class="genre-tag">${esc(g)}</span>`).join("")}
       </div>
    `
        : ""
    }
    
    <div class="detail-section-label">Status</div>
    <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:16px;">
        ${safeStatus}${esc(epSummary)}
    </div>
    
    ${
      entry.notes
        ? `
       <div class="detail-section-label">Personal Notes</div>
       <div class="detail-notes">${esc(entry.notes).replace(/\n/g, "<br>")}</div>
    `
        : ""
    }
    
    ${
      entry.season
        ? `
       <div class="detail-section-label">Season</div>
       <div style="font-size:14px;color:var(--text-secondary);margin-bottom:16px">${safeSeason}</div>
    `
        : ""
    }
    
    ${
      link
        ? `
       <a href="${esc(link)}" target="_blank" rel="noopener noreferrer" class="btn btn-ghost" style="margin-top:10px; width:100%; justify-content:center;">🔗 View External Information</a>
    `
        : ""
    }
  `;

  openOverlay("detailModalOverlay");
});

export const closeDetailModal = (window.closeDetailModal = () => {
  closeOverlay("detailModalOverlay");
});

export const handleOverlayClick = (window.handleOverlayClick = (e, id) => {
  if (e.target.id === id) {
    closeOverlay(id);
  }
});

registerActions({
  detailAddFriend: (d) => {
    closeDetailModal();
    window.addFriendLibToCodex?.(d.id);
  },
  detailAddRec: (d) => {
    closeDetailModal();
    window.addRecToLibrary?.(d.id);
  },
  detailEdit: (d) => {
    closeDetailModal();
    window.editEntry?.(d.id);
  },
  detailRecommend: (d) => {
    closeDetailModal();
    window.openRecommendModalById?.(d.id);
  },
});
