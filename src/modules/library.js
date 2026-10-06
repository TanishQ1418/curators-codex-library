// ── LIBRARY MANAGEMENT & FILTERING MODULE ─────────────────────────

import {
  auth,
  db,
  doc,
  writeBatch,
  handleFirestoreError,
} from "../config/firebase.js";
import { showToast } from "../utils/helpers.js";

export const bulkSelection = new Set();
window.bulkSelection = bulkSelection;

export const toggleSelection = (window.toggleSelection = (id) => {
  if (bulkSelection.has(id)) bulkSelection.delete(id);
  else bulkSelection.add(id);
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
  if (confirm(`Delete ${bulkSelection.size} entries permanently?`)) {
    if (window.isGuestMode) {
      window.library = (window.library || []).filter(
        (l) => !bulkSelection.has(l.id),
      );
      localStorage.setItem("codex_library", JSON.stringify(window.library));
      clearSelection();
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      showToast("Batch deleted", "success");
      return;
    }

    try {
      const batch = writeBatch(db);
      const uid = auth.currentUser.uid;

      bulkSelection.forEach((id) => {
        batch.delete(doc(db, "users", uid, "library", String(id)));
      });
      await batch.commit();

      window.library = (window.library || []).filter(
        (l) => !bulkSelection.has(l.id),
      );
      clearSelection();
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      showToast("Batch deleted", "success");
    } catch (err) {
      try {
        handleFirestoreError(err, "delete", "users/.../library");
      } catch (e) {}
      showToast("Failed to batch delete: " + err.message, "error");
    }
  }
});

export function refreshGenreFilter() {
  const select = document.getElementById("filterGenre");
  if (!select) return;
  const genres = new Set();
  (window.library || []).forEach((e) => {
    if (e.genres) e.genres.forEach((g) => genres.add(g));
  });
  select.innerHTML =
    '<option value="">All Genres</option>' +
    Array.from(genres)
      .sort()
      .map((g) => `<option value="${g}">${g}</option>`)
      .join("");
}
window.refreshGenreFilter = refreshGenreFilter;

export const quickFilterStatus = (window.quickFilterStatus = (status) => {
  document
    .querySelectorAll(".status-pill-btn, .status-filter-btn")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.status === status),
    );
  if (document.getElementById("filterType"))
    document.getElementById("filterType").value = "";
  if (document.getElementById("filterTier"))
    document.getElementById("filterTier").value = "";
  if (document.getElementById("filterGenre"))
    document.getElementById("filterGenre").value = "";
  if (document.getElementById("sortBy"))
    document.getElementById("sortBy").value = "titleAZ";
  if (window.updateFilterBadge) window.updateFilterBadge();
  if (window.navigateTo) window.navigateTo("library");
  if (document.getElementById("filterStatus"))
    document.getElementById("filterStatus").value = status;
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
    if (fGenre && (!e.genres || !e.genres.includes(fGenre))) return false;
    return true;
  });

  if (sBy === "titleAZ")
    filtered.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  else if (sBy === "year")
    filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
  else if (sBy === "tier") {
    const p = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, "": 0 };
    filtered.sort((a, b) => p[b.tier || ""] - p[a.tier || ""]);
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
          '<div class="empty-state"><div class="empty-icon">✨</div><h3>Your codex is empty</h3><p style="margin-bottom: 20px;">Begin building your personalized collection.</p><button class="btn btn-primary" onclick="window.openAddModal()">Add your first entry</button></div>';
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
      .map(
        (e) => `
    <div class="entry-card" onclick="window.openDetailModal('${e.id}')">
      <div class="card-poster"><img src="${e.poster}" onerror="this.outerHTML='🎬'" /></div>
      <div class="card-info">
        <div class="card-title">${e.title}</div>
        <div class="card-meta">
          <span class="badge badge-type">${e.type}</span>
          ${e.tier ? `<span class="badge tier-${e.tier}" style="border-radius:4px;padding:2px 7px;">${e.tier}</span>` : ""}
        </div>
      </div>
      <div class="card-overlay">
        <div style="font-size:12px;color:#fff;font-weight:600;margin-bottom:auto;">${e.status}</div>
        <div class="card-actions">
          <div class="card-action-btn" style="padding:0; border:none; background:transparent;">
            <input type="checkbox" class="card-checkbox" onclick="event.stopPropagation();window.toggleSelection('${e.id}')" ${bulkSelection.has(e.id) ? "checked" : ""} />
          </div>
          <button class="card-action-btn" onclick="event.stopPropagation();window.openRecommendModalById('${e.id}')" title="Recommend">🎁</button>
          <button class="card-action-btn" onclick="event.stopPropagation();window.editEntry('${e.id}')" title="Edit">✎</button>
          <button class="card-action-btn" onclick="event.stopPropagation();window.deleteEntry('${e.id}')" title="Delete">🗑</button>
        </div>
      </div>
    </div>
  `,
      )
      .join("");
  }

  if (list) {
    list.innerHTML = filtered
      .map(
        (e) => `
    <div class="list-row" onclick="window.openDetailModal('${e.id}')">
      <input type="checkbox" class="card-checkbox" onclick="event.stopPropagation();window.toggleSelection('${e.id}')" ${bulkSelection.has(e.id) ? "checked" : ""} />
      <div class="list-poster"><img src="${e.poster}" onerror="this.outerHTML='🎬'" /></div>
      <div class="list-title">${e.title} ${e.tier ? `<span class="badge tier-${e.tier}" style="margin-left:6px">${e.tier}</span>` : ""}</div>
      <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-right:auto">${e.status}</div>
      <div class="list-row-actions">
         <button class="card-action-btn" onclick="event.stopPropagation();window.openRecommendModalById('${e.id}')" title="Recommend">🎁</button>
         <button class="card-action-btn" onclick="event.stopPropagation();window.editEntry('${e.id}')" title="Edit">✎</button>
         <button class="card-action-btn" onclick="event.stopPropagation();window.deleteEntry('${e.id}')" title="Delete">🗑</button>
      </div>
    </div>
  `,
      )
      .join("");
  }
});

export const selectAllFiltered = (window.selectAllFiltered = () => {
  const itemsToSelect =
    window._currentFiltered ||
    window._currentSearchData ||
    window.library ||
    [];
  itemsToSelect.forEach((e) => bulkSelection.add(e.id));
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
    .querySelectorAll(".status-pill-btn, .status-filter-btn")
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
