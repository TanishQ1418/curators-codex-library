// ── TIER LIST VIEW MODULE ──────────────────────────────────────────

import { auth, db, doc, updateDoc, handleFirestoreError } from "../config/firebase.js";
import { esc, safeUrl, showToast, registerActions } from "../utils/helpers.js";
import { refreshGenreFilter } from "./library.js";

const TIERS = ["S", "A", "B", "C", "D", "E", "F"];
let quickAssignMode = false;

export const toggleTierAssignMode = (window.toggleTierAssignMode = () => {
  quickAssignMode = !quickAssignMode;
  renderTierList();
});

export async function assignEntryTier(id, nextTier) {
  const sid = String(id);
  const entry = (window.library || []).find((l) => String(l.id) === sid);
  if (!entry) return;
  const cleanTier = TIERS.includes(nextTier) ? nextTier : "";
  entry.tier = cleanTier;

  if (window.isGuestMode) {
    localStorage.setItem("codex_library", JSON.stringify(window.library));
    window.updateNavBadges?.();
    renderTierList();
    showToast(cleanTier ? `Moved to ${cleanTier} Tier` : "Tier cleared", "success");
    return;
  }

  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "library", sid), {
      tier: cleanTier,
    });
    refreshGenreFilter();
    window.updateNavBadges?.();
    renderTierList();
    showToast(cleanTier ? `Moved to ${cleanTier} Tier` : "Tier cleared", "success");
  } catch (err) {
    handleFirestoreError(err, "update", `users/.../library/${sid}`);
  }
}

export const renderTierList = (window.renderTierList = () => {
  const c = document.getElementById("tierListContainer");
  if (!c) return;
  const lib = window.library || [];

  const renderThumb = (l) => {
    const poster = safeUrl(l.poster);
    const safeId = esc(String(l.id || ""));
    const currentTier = l.tier || "";
    const tierOptions = ['<option value="">Unranked</option>']
      .concat(
        TIERS.map(
          (tierOpt) =>
            `<option value="${tierOpt}" ${currentTier === tierOpt ? "selected" : ""}>${tierOpt}</option>`,
        ),
      )
      .join("");

    return `
      <div class="tier-thumb-wrap">
        <div class="tier-poster-thumb" data-act="openDetail" data-id="${safeId}" title="${esc(l.title)}">
          ${
            poster
              ? `<img src="${esc(poster)}" alt="${esc(l.title)} poster" referrerpolicy="no-referrer" data-fallback="emoji" />`
              : `<span class="tier-fallback-title">${esc((l.title || "🎬").slice(0, 16))}</span>`
          }
        </div>
        ${
          quickAssignMode || !currentTier
            ? `<select class="tier-quick-select" data-tier-entry-id="${safeId}" aria-label="Assign tier for ${esc(l.title)}">${tierOptions}</select>`
            : ""
        }
      </div>
    `;
  };

  let html = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:18px;">
      <button type="button" class="btn ${quickAssignMode ? "btn-primary" : "btn-ghost"} btn-sm" data-act="toggleTierAssign">
        ${quickAssignMode ? "✓ Done Assigning Tiers" : "⇄ Quick Assign / Move Tiers"}
      </button>
    </div>
  `;

  TIERS.forEach((t) => {
    const items = lib.filter((l) => l.tier === t);
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
                  ? items.map(renderThumb).join("")
                  : `<div class="tier-empty-placeholder">No entries in ${t} Tier yet.</div>`
              }
          </div>
      </div>
    `;
  });

  const unranked = lib.filter((l) => !l.tier || !TIERS.includes(l.tier));
  if (unranked.length > 0) {
    html += `
      <div class="tier-row">
          <div class="tier-row-header">
              <div class="tier-label-block tier-label-unranked">—</div>
              <div class="tier-divider"></div>
              <div class="tier-entry-count">${unranked.length} UNRANKED</div>
          </div>
          <div class="tier-posters">
              ${unranked.map(renderThumb).join("")}
          </div>
      </div>
    `;
  }

  c.innerHTML = html;

  c.querySelectorAll("select.tier-quick-select").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      e.stopPropagation();
      assignEntryTier(sel.dataset.tierEntryId, e.target.value);
    });
    sel.addEventListener("click", (e) => e.stopPropagation());
  });
});

registerActions({
  toggleTierAssign: () => toggleTierAssignMode(),
});
