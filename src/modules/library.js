// ── LIBRARY MANAGEMENT & FILTERING MODULE ─────────────────────────

import {
  auth,
  db,
  doc,
  writeBatch,
  updateDoc,
  handleFirestoreError,
} from "../config/firebase.js";
import {
  esc,
  safeUrl,
  showToast,
  showAppDialog,
  registerActions,
  getEpisodesWatched,
  getEpisodesTotal,
} from "../utils/helpers.js";
import { commitEntriesInChunks, deleteEntryIdsInChunks } from "./auth.js";

export const bulkSelection = new Set();
window.bulkSelection = bulkSelection;

export const toggleSelection = (window.toggleSelection = (id) => {
  const sid = String(id);
  if (bulkSelection.has(sid)) bulkSelection.delete(sid);
  else bulkSelection.add(sid);
  updateBulkBar();
});

export const updateBulkBar = (window.updateBulkBar = () => {
  const bar = document.getElementById("bulkBar");
  const cnt = document.getElementById("bulkCount");
  if (!bar || !cnt) return;
  if (bulkSelection.size > 0) {
    bar.classList.add("visible");
    cnt.textContent = `${bulkSelection.size} selected`;
  } else {
    bar.classList.remove("visible");
  }
});

export const clearSelection = (window.clearSelection = () => {
  bulkSelection.clear();
  renderLibrary();
  updateBulkBar();
});

export const bulkDelete = (window.bulkDelete = async () => {
  if (bulkSelection.size === 0) return;
  const count = bulkSelection.size;
  const confirmed = await showAppDialog({
    title: `Delete ${count} Entries?`,
    message: `Are you sure you want to delete ${count} selected ${count === 1 ? "entry" : "entries"}? You can undo this for 8 seconds.`,
    confirmText: `Delete ${count}`,
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmed) return;

  const idsToDelete = Array.from(bulkSelection);
  const deletedSnapshot = (window.library || [])
    .filter((l) => bulkSelection.has(String(l.id)))
    .map((l) => ({ ...l }));

  const restoreBatch = async () => {
    try {
      if (window.isGuestMode) {
        const existing = new Set((window.library || []).map((l) => l.id));
        deletedSnapshot.forEach((d) => {
          if (!existing.has(d.id)) window.library.unshift(d);
        });
        localStorage.setItem("codex_library", JSON.stringify(window.library));
      } else if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        await commitEntriesInChunks(uid, deletedSnapshot, false);
        const existing = new Set((window.library || []).map((l) => l.id));
        deletedSnapshot.forEach((d) => {
          if (!existing.has(d.id)) window.library.unshift(d);
        });
      }
      refreshGenreFilter();
      window.updateNavBadges?.();
      renderLibrary();
      showToast(`Restored ${deletedSnapshot.length} entries`, "success");
    } catch (err) {
      handleFirestoreError(err, "write", "users/.../library");
    }
  };

  if (window.isGuestMode) {
    window.library = (window.library || []).filter(
      (l) => !bulkSelection.has(String(l.id)),
    );
    localStorage.setItem("codex_library", JSON.stringify(window.library));
    clearSelection();
    refreshGenreFilter();
    if (window.updateNavBadges) window.updateNavBadges();
    showToast(`Deleted ${deletedSnapshot.length} entries`, "success", {
      actionLabel: "Undo",
      onAction: restoreBatch,
      duration: 8000,
    });
    return;
  }

  try {
    const uid = auth.currentUser.uid;
    await deleteEntryIdsInChunks(uid, idsToDelete);
    window.library = (window.library || []).filter(
      (l) => !bulkSelection.has(String(l.id)),
    );
    clearSelection();
    refreshGenreFilter();
    if (window.updateNavBadges) window.updateNavBadges();
    showToast(`Deleted ${deletedSnapshot.length} entries`, "success", {
      actionLabel: "Undo",
      onAction: restoreBatch,
      duration: 8000,
    });
  } catch (err) {
    handleFirestoreError(err, "delete", "users/.../library");
  }
});

export const incrementEpisode = (window.incrementEpisode = async (id) => {
  const sid = String(id);
  const entry = (window.library || []).find((l) => String(l.id) === sid);
  if (!entry) return;

  const watched = getEpisodesWatched(entry);
  const total = getEpisodesTotal(entry);
  const nextWatched = watched + 1;
  const patch = {
    episodes: nextWatched,
    episodesWatched: nextWatched,
  };
  if (total > 0 && nextWatched >= total && entry.status !== "Completed") {
    patch.status = "Completed";
  } else if (entry.status === "Plan to Watch") {
    patch.status = "Watching";
  }

  Object.assign(entry, patch);
  if (window.isGuestMode) {
    localStorage.setItem("codex_library", JSON.stringify(window.library));
    window.updateNavBadges?.();
    renderLibrary();
    return;
  }
  if (!auth.currentUser) return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "library", sid), patch);
    window.updateNavBadges?.();
    renderLibrary();
  } catch (err) {
    handleFirestoreError(err, "update", `users/.../library/${sid}`);
  }
});

export function refreshGenreFilter() {
  const select = document.getElementById("filterGenre");
  if (!select) return;
  const previous = select.value;
  const genres = new Set();
  (window.library || []).forEach((e) => {
    if (Array.isArray(e.genres)) e.genres.forEach((g) => g && genres.add(g));
  });
  select.innerHTML =
    '<option value="">All Genres</option>' +
    Array.from(genres)
      .sort()
      .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
      .join("");
  if (previous && genres.has(previous)) select.value = previous;
}
window.refreshGenreFilter = refreshGenreFilter;

export const quickFilterStatus = (window.quickFilterStatus = (status) => {
  document
    .querySelectorAll(
      "#libraryStatusPills .status-pill-btn, .sidebar-status-filters .status-filter-btn",
    )
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.status === status),
    );
  if (document.getElementById("filterStatus"))
    document.getElementById("filterStatus").value = status;
  if (window.updateFilterBadge) window.updateFilterBadge();
  if (window.navigateTo) window.navigateTo("library");
  renderLibrary();
});

export const renderLibrary = (window.renderLibrary = () => {
  const searchInput = document.getElementById("searchInput");
  const qs = (searchInput ? searchInput.value : "").toLowerCase();

  const clearBtn = document.getElementById("clearSearchBtn");
  if (clearBtn) {
    clearBtn.style.display = qs.length > 0 ? "block" : "none";
  }

  const fType = document.getElementById("filterType")?.value || "";
  const fStatus = document.getElementById("filterStatus")?.value || "";
  const fTier = document.getElementById("filterTier")?.value || "";
  const fGenre = document.getElementById("filterGenre")?.value || "";
  const sBy = document.getElementById("sortBy")?.value || "titleAZ";

  let filtered = (window.library || []).filter((e) => {
    if (qs && !(e.title || "").toLowerCase().includes(qs)) return false;
    if (fType && e.type !== fType) return false;
    if (fStatus && e.status !== fStatus) return false;
    if (fTier && e.tier !== fTier) return false;
    if (fGenre && (!Array.isArray(e.genres) || !e.genres.includes(fGenre))) return false;
    return true;
  });

  if (sBy === "titleAZ")
    filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (sBy === "year")
    filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (sBy === "tier") {
    const p = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, "": 0 };
    filtered.sort((a, b) => (p[b.tier || ""] ?? 0) - (p[a.tier || ""] ?? 0));
  } else {
    filtered.sort(
      (a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0),
    );
  }

  window._currentFiltered = filtered;
  const grid = document.getElementById("gridView");
  const list = document.getElementById("listView");
  const sub = document.getElementById("librarySubtitle");

  if (sub) {
    sub.textContent = `Showing ${filtered.length} of ${(window.library || []).length} entries`;
  }

  if (!filtered.length) {
    if (!window.library || window.library.length === 0) {
      if (grid)
        grid.innerHTML =
          '<div class="empty-state"><div class="empty-icon">✨</div><h3>Your codex is empty</h3><p style="margin-bottom: 20px;">Begin building your personalized collection.</p><button type="button" class="btn btn-primary" data-act="openAddModal">Add your first entry</button></div>';
    } else {
      if (grid)
        grid.innerHTML =
          '<div class="empty-state"><div class="empty-icon">📂</div><h3>No entries found</h3><p>Try adjusting your search or filters.</p></div>';
    }
    if (list) list.innerHTML = "";
    return;
  }

  if (grid) {
    grid.innerHTML = filtered
      .map((e) => {
        const poster = safeUrl(e.poster);
        const safeId = esc(String(e.id || ""));
        const safeTier = esc(e.tier || "");
        const watched = getEpisodesWatched(e);
        const total = getEpisodesTotal(e);
        const showProgress = e.type !== "Movie" && (total > 0 || watched > 0);
        const pct = total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0;

        return `
    <div class="entry-card" data-act="openDetail" data-id="${safeId}">
      <div class="card-poster">
        ${
          poster
            ? `<img src="${esc(poster)}" alt="${esc(e.title)} poster" referrerpolicy="no-referrer" data-fallback="emoji" />`
            : "🎬"
        }
      </div>
      <div class="card-info">
        <div class="card-title">${esc(e.title)}</div>
        <div class="card-meta">
          <span class="badge badge-type">${esc(e.type || "Anime")}</span>
          ${e.tier ? `<span class="badge tier-${safeTier}" style="border-radius:4px;padding:2px 7px;">${safeTier}</span>` : ""}
        </div>
        ${
          showProgress
            ? `<div class="card-progress-wrap">
                <div class="card-progress-meta">
                  <span>Ep ${watched}${total > 0 ? "/" + total : ""}</span>
                  <button type="button" class="card-ep-plus" data-act="incEpisode" data-id="${safeId}" data-stop="1" aria-label="Increment episode watched for ${esc(e.title)}">+1</button>
                </div>
                ${
                  total > 0
                    ? `<div class="card-progress-track"><div class="card-progress-fill" style="width:${pct}%"></div></div>`
                    : ""
                }
              </div>`
            : ""
        }
      </div>
      <div class="card-overlay">
        <div style="font-size:12px;color:#fff;font-weight:600;margin-bottom:auto;">${esc(e.status || "")}</div>
        <div class="card-actions">
          <div class="card-action-btn" style="padding:0; border:none; background:transparent;">
            <input type="checkbox" class="card-checkbox" data-act="toggleSelection" data-id="${safeId}" data-stop="1" aria-label="Select ${esc(e.title)}" ${bulkSelection.has(String(e.id)) ? "checked" : ""} />
          </div>
          <button type="button" class="card-action-btn" data-act="openRecommend" data-id="${safeId}" data-stop="1" title="Recommend" aria-label="Recommend ${esc(e.title)}">🎁</button>
          <button type="button" class="card-action-btn" data-act="editEntry" data-id="${safeId}" data-stop="1" title="Edit" aria-label="Edit ${esc(e.title)}">✎</button>
          <button type="button" class="card-action-btn" data-act="deleteEntry" data-id="${safeId}" data-stop="1" title="Delete" aria-label="Delete ${esc(e.title)}">🗑</button>
        </div>
      </div>
    </div>
  `;
      })
      .join("");
  }

  if (list) {
    list.innerHTML = filtered
      .map((e) => {
        const poster = safeUrl(e.poster);
        const safeId = esc(String(e.id || ""));
        const safeTier = esc(e.tier || "");
        const watched = getEpisodesWatched(e);
        const total = getEpisodesTotal(e);
        const showProgress = e.type !== "Movie" && (total > 0 || watched > 0);
        return `
    <div class="list-row" data-act="openDetail" data-id="${safeId}">
      <input type="checkbox" class="card-checkbox" data-act="toggleSelection" data-id="${safeId}" data-stop="1" aria-label="Select ${esc(e.title)}" ${bulkSelection.has(String(e.id)) ? "checked" : ""} />
      <div class="list-poster">
        ${
          poster
            ? `<img src="${esc(poster)}" alt="${esc(e.title)} poster" referrerpolicy="no-referrer" data-fallback="emoji" />`
            : "🎬"
        }
      </div>
      <div class="list-title">${esc(e.title)} ${e.tier ? `<span class="badge tier-${safeTier}" style="margin-left:6px">${safeTier}</span>` : ""}</div>
      ${
        showProgress
          ? `<div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);">
              <span>Ep ${watched}${total > 0 ? "/" + total : ""}</span>
              <button type="button" class="card-ep-plus" data-act="incEpisode" data-id="${safeId}" data-stop="1" aria-label="Increment episode for ${esc(e.title)}">+1</button>
            </div>`
          : ""
      }
      <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-right:auto">${esc(e.status || "")}</div>
      <div class="list-row-actions">
         <button type="button" class="card-action-btn" data-act="openRecommend" data-id="${safeId}" data-stop="1" title="Recommend" aria-label="Recommend ${esc(e.title)}">🎁</button>
         <button type="button" class="card-action-btn" data-act="editEntry" data-id="${safeId}" data-stop="1" title="Edit" aria-label="Edit ${esc(e.title)}">✎</button>
         <button type="button" class="card-action-btn" data-act="deleteEntry" data-id="${safeId}" data-stop="1" title="Delete" aria-label="Delete ${esc(e.title)}">🗑</button>
      </div>
    </div>
  `;
      })
      .join("");
  }
});

export const selectAllFiltered = (window.selectAllFiltered = () => {
  const itemsToSelect =
    window._currentFiltered ||
    window._currentSearchData ||
    window.library ||
    [];
  itemsToSelect.forEach((e) => bulkSelection.add(String(e.id)));
  updateBulkBar();
  renderLibrary();
});

export const onSearchInput = (window.onSearchInput = () => {
  const val = document.getElementById("searchInput")?.value || "";
  const btn = document.getElementById("clearSearchBtn");
  if (btn) {
    btn.style.display = val.length > 0 ? "block" : "none";
  }

  const libPage = document.getElementById("page-library");
  if (libPage && libPage.classList.contains("active")) {
    renderLibrary();
  } else {
    if (window.navigateTo) window.navigateTo("library");
    renderLibrary();
  }
});

export const clearFilters = (window.clearFilters = () => {
  if (document.getElementById("filterType"))
    document.getElementById("filterType").value = "";
  if (document.getElementById("filterStatus"))
    document.getElementById("filterStatus").value = "";
  if (document.getElementById("filterTier"))
    document.getElementById("filterTier").value = "";
  if (document.getElementById("filterGenre"))
    document.getElementById("filterGenre").value = "";
  if (document.getElementById("sortBy"))
    document.getElementById("sortBy").value = "titleAZ";
  document
    .querySelectorAll(
      "#libraryStatusPills .status-pill-btn, .sidebar-status-filters .status-filter-btn",
    )
    .forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.status === "");
    });
  if (window.updateFilterBadge) window.updateFilterBadge();
  renderLibrary();
});

export const clearSearch = (window.clearSearch = () => {
  const input = document.getElementById("searchInput");
  if (input) {
    input.value = "";
    onSearchInput();
  }
});

window._currentView = "grid";

export const setView = (window.setView = (v) => {
  window._currentView = v;
  const gridBtn = document.getElementById("gridViewBtn");
  const listBtn = document.getElementById("listViewBtn");
  if (gridBtn) gridBtn.classList.toggle("active", v === "grid");
  if (listBtn) listBtn.classList.toggle("active", v === "list");

  const grid = document.getElementById("gridView");
  const lv = document.getElementById("listView");
  if (grid) grid.style.display = v === "grid" ? "grid" : "none";
  if (lv) {
    if (v === "list") {
      lv.style.display = "flex";
      lv.style.flexDirection = "column";
      lv.style.gap = "6px";
    } else {
      lv.style.display = "none";
    }
  }
});

export const toggleLibraryFiltersDrawer = (window.toggleLibraryFiltersDrawer =
  () => {
    const drawer = document.getElementById("libraryFiltersDrawer");
    const btn = document.getElementById("toggleFiltersBtn");
    if (!drawer) return;
    const isHidden = drawer.style.display === "none";
    drawer.style.display = isHidden ? "block" : "none";
    if (btn) btn.classList.toggle("active", isHidden);
  });

export const updateFilterBadge = (window.updateFilterBadge = () => {
  const fType = document.getElementById("filterType")?.value || "";
  const fTier = document.getElementById("filterTier")?.value || "";
  const fGenre = document.getElementById("filterGenre")?.value || "";
  let count = 0;
  if (fType) count++;
  if (fTier) count++;
  if (fGenre) count++;
  const badge = document.getElementById("activeFilterBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }
});

registerActions({
  openDetail: (d) => window.openDetailModal?.(d.id, d.friend === "1"),
  toggleSelection: (d) => toggleSelection(d.id),
  openRecommend: (d) => window.openRecommendModalById?.(d.id),
  editEntry: (d) => window.editEntry?.(d.id),
  deleteEntry: (d) => window.deleteEntry?.(d.id),
  incEpisode: (d) => incrementEpisode(d.id),
  openAddModal: () => window.openAddModal?.(),
});
