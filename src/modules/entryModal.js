// ── ADD / EDIT ENTRY MODAL MODULE (WITH 3-TAB LAYOUT) ───────────────

import {
  auth,
  db,
  doc,
  collection,
  setDoc,
  deleteDoc,
  handleFirestoreError,
} from "../config/firebase.js";
import {
  esc,
  safeUrl,
  showToast,
  showAppDialog,
  registerActions,
  openOverlay,
  closeOverlay,
  getEpisodesWatched,
  getEpisodesTotal,
} from "../utils/helpers.js";
import {
  currentWatchedSeasons,
  setWatchedSeasons,
  onTypeChange,
} from "../utils/seasons.js";
import { refreshGenreFilter, renderLibrary } from "./library.js";

export let currentDraftGenres = [];
export let currentDraftTier = "";
window.editingId = null;

function populateSeasonYearDropdown() {
  const yrSelect = document.getElementById("field-season-year");
  if (!yrSelect || yrSelect.options.length > 1) return;
  const maxYear = new Date().getFullYear() + 3;
  const opts = ['<option value="">Year…</option>'];
  for (let y = maxYear; y >= 1960; y--) {
    opts.push(`<option value="${y}">${y}</option>`);
  }
  yrSelect.innerHTML = opts.join("");
}

export const setSeasonInputs = (window.setSeasonInputs = (seasonStr) => {
  populateSeasonYearDropdown();
  const sName = document.getElementById("field-season-name");
  const sYear = document.getElementById("field-season-year");
  const sCustom = document.getElementById("field-season-custom");
  const raw = String(seasonStr || "").trim();
  const match = raw.match(/^(Winter|Spring|Summer|Fall)\s+(\d{4})$/i);
  if (match) {
    const capSeason =
      match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    if (sName) sName.value = capSeason;
    if (sYear) sYear.value = match[2];
    if (sCustom) sCustom.value = "";
  } else {
    if (sName) sName.value = "";
    if (sYear) sYear.value = "";
    if (sCustom) sCustom.value = raw;
  }
});

function readSeasonValue() {
  const sName = document.getElementById("field-season-name")?.value || "";
  const sYear = document.getElementById("field-season-year")?.value || "";
  const sCustom = document.getElementById("field-season-custom")?.value?.trim() || "";
  if (sName && sYear) return `${sName} ${sYear}`;
  if (sName) return sName;
  if (sYear) return sYear;
  return sCustom;
}

export function setCurrentDraftGenres(genres) {
  currentDraftGenres = (genres || []).map((g) => String(g).trim()).filter(Boolean);
  renderDraftGenres();
}
window.setCurrentDraftGenres = setCurrentDraftGenres;

export const switchEntryTab = (window.switchEntryTab = (tabNum) => {
  const num = parseInt(tabNum, 10) || 1;
  [1, 2, 3].forEach((n) => {
    const pane = document.getElementById(`entryTab-${n}`);
    const btn = document.getElementById(`entryTabBtn-${n}`);
    if (pane) pane.style.display = n === num ? "grid" : "none";
    if (btn) btn.classList.toggle("active", n === num);
  });
});

export const selectTier = (window.selectTier = (t) => {
  if (currentDraftTier === t && t !== "") {
    currentDraftTier = "";
    document
      .querySelectorAll(".tier-tile")
      .forEach((el) => el.classList.remove("selected"));
    return;
  }
  currentDraftTier = t || "";
  document
    .querySelectorAll(".tier-tile")
    .forEach((el) => el.classList.remove("selected"));
  if (currentDraftTier) {
    const el = document.getElementById(`tierTile-${currentDraftTier}`);
    if (el) el.classList.add("selected");
  }
});

export function setupTierSelector() {
  populateSeasonYearDropdown();
  const c = document.getElementById("tierSelector");
  if (!c) return;
  const tiers = ["S", "A", "B", "C", "D", "E", "F"];
  c.innerHTML =
    tiers
      .map(
        (t) =>
          `<button type="button" class="tier-tile tier-label-${t}" id="tierTile-${t}" data-act="selectTier" data-tier="${t}" aria-label="Select ${t} Tier">${t}</button>`,
      )
      .join("") +
    `<button type="button" class="btn btn-ghost btn-sm" data-act="selectTier" data-tier="" title="Clear Tier" aria-label="Clear tier rating">Clear</button>`;
}
window.setupTierSelector = setupTierSelector;

export const handleGenreKey = (window.handleGenreKey = (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = e.target.value.trim().replace(",", "");
    if (val && !currentDraftGenres.includes(val) && currentDraftGenres.length < 30) {
      currentDraftGenres.push(val);
      renderDraftGenres();
    }
    e.target.value = "";
  }
});

export const removeDraftGenre = (window.removeDraftGenre = (idx) => {
  const i = parseInt(idx, 10);
  if (!Number.isFinite(i)) return;
  currentDraftGenres.splice(i, 1);
  renderDraftGenres();
});

export function renderDraftGenres() {
  const container = document.getElementById("genreTags");
  if (!container) return;
  container.innerHTML = currentDraftGenres
    .map(
      (g, i) =>
        `<span class="tag-pill">${esc(g)} <button type="button" class="tag-remove" data-act="removeDraftGenre" data-idx="${i}" aria-label="Remove ${esc(g)}">×</button></span>`,
    )
    .join("");
}
window.renderDraftGenres = renderDraftGenres;

export const openAddModal = (window.openAddModal = () => {
  window.editingId = null;
  window._draftStremioId = null;
  window._draftJikanId = null;
  window._draftMalId = null;
  window._draftKitsuId = null;
  window.switchEntryTab(1);

  document.getElementById("entryModalTitle").textContent = "ADD ENTRY";
  document.getElementById("field-title").value = "";
  document.getElementById("field-poster").value = "";
  document.getElementById("field-episodes").value = "";
  const totalEl = document.getElementById("field-episodes-total");
  if (totalEl) totalEl.value = "";
  document.getElementById("field-year").value = "";
  document.getElementById("field-link").value = "";
  setSeasonInputs("");
  document.getElementById("field-notes").value = "";
  document.getElementById("field-seasonCount").value = "0";
  document.getElementById("seasonCountLabel").textContent = "0";
  document.getElementById("genreTags").innerHTML = "";
  document.getElementById("field-status").value = "Plan to Watch";
  document.getElementById("autofillStatus").innerHTML = "";
  const dd = document.getElementById("searchDropdown");
  if (dd) dd.style.display = "none";
  const sc = document.getElementById("seasonChipsContainer");
  if (sc) sc.innerHTML = "";

  currentDraftGenres = [];
  setWatchedSeasons([]);
  window.selectTier("");
  onTypeChange();
  openOverlay("entryModalOverlay");
});

export const closeEntryModal = (window.closeEntryModal = () => {
  closeOverlay("entryModalOverlay");
});

export const editEntry = (window.editEntry = (id) => {
  const entry = (window.library || []).find((l) => l.id === String(id));
  if (!entry) return;
  window.editingId = entry.id;
  window.switchEntryTab(1);
  document.getElementById("entryModalTitle").textContent = "EDIT ENTRY";

  document.getElementById("field-title").value = entry.title || "";
  document.getElementById("field-type").value = entry.type || "Anime";
  document.getElementById("field-status").value = entry.status || "Plan to Watch";
  document.getElementById("field-poster").value = entry.poster || "";
  document.getElementById("field-episodes").value = getEpisodesWatched(entry) || "";
  const totalEl = document.getElementById("field-episodes-total");
  if (totalEl) totalEl.value = getEpisodesTotal(entry) || "";
  document.getElementById("field-year").value = entry.year || "";
  document.getElementById("field-link").value = entry.link || "";
  setSeasonInputs(entry.season || "");
  document.getElementById("field-notes").value = entry.notes || "";
  document.getElementById("field-seasonCount").value = entry.seasonCount || "0";
  document.getElementById("seasonCountLabel").textContent =
    entry.seasonCount || "0";

  window._draftStremioId = entry.stremioId || null;
  window._draftJikanId = entry.jikanId || null;
  window._draftMalId = entry.malId || null;
  window._draftKitsuId = entry.kitsuId || null;

  currentDraftGenres = [...(entry.genres || [])];
  setWatchedSeasons([...(entry.watchedSeasons || [])]);
  renderDraftGenres();
  currentDraftTier = "";
  window.selectTier(entry.tier || "");

  document.getElementById("autofillStatus").innerHTML = "";
  const dd = document.getElementById("searchDropdown");
  if (dd) dd.style.display = "none";
  onTypeChange();
  openOverlay("entryModalOverlay");
});

export const saveEntry = (window.saveEntry = async () => {
  const saveBtn = document.getElementById("entrySaveBtn");
  try {
    if (!auth.currentUser && !window.isGuestMode)
      return showToast("You must be logged in!", "error");

    const titleField = document.getElementById("field-title");
    const title = titleField ? titleField.value.trim().slice(0, 500) : "";
    if (!title) return showToast("Title is required!", "error");

    const rawPoster = document.getElementById("field-poster")?.value?.trim() || "";
    const rawLink = document.getElementById("field-link")?.value?.trim() || "";
    const poster = safeUrl(rawPoster);
    const link = safeUrl(rawLink);
    if (rawPoster && !poster) {
      return showToast("Poster URL must be a valid https:// URL.", "error");
    }
    if (rawLink && !link) {
      return showToast("External Link must be a valid https:// URL.", "error");
    }

    const type = document.getElementById("field-type")?.value || "Anime";
    const status = document.getElementById("field-status")?.value || "Plan to Watch";
    const parsedYear = parseInt(document.getElementById("field-year")?.value, 10);
    const year =
      Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100
        ? parsedYear
        : null;

    const episodesWatched = Math.min(
      100000,
      Math.max(0, parseInt(document.getElementById("field-episodes")?.value, 10) || 0),
    );
    const episodesTotal = Math.min(
      100000,
      Math.max(
        0,
        parseInt(document.getElementById("field-episodes-total")?.value, 10) || 0,
      ),
    );

    const isEpisodic = type === "Anime" || type === "Web Series";
    const seasonCount = isEpisodic
      ? Math.min(
          50,
          Math.max(
            0,
            parseInt(document.getElementById("field-seasonCount")?.value, 10) || 0,
          ),
        )
      : 0;
    const watchedSeasons = isEpisodic
      ? currentWatchedSeasons.filter((n) => Number.isFinite(n) && n >= 1 && n <= seasonCount)
      : [];

    const payload = {
      title,
      type,
      status,
      tier: currentDraftTier,
      poster,
      link,
      year,
      episodes: episodesWatched,
      episodesWatched,
      episodesTotal,
      season: readSeasonValue().slice(0, 100),
      genres: [...currentDraftGenres].slice(0, 30),
      notes: (document.getElementById("field-notes")?.value?.trim() || "").slice(0, 20000),
      seasonCount,
      watchedSeasons,
      stremioId: window._draftStremioId || null,
      jikanId: window._draftJikanId || null,
      malId: window._draftMalId || null,
      kitsuId: window._draftKitsuId || null,
    };

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
    }

    if (window.isGuestMode) {
      if (window.editingId) {
        payload.id = String(window.editingId);
        const i = (window.library || []).findIndex((l) => l.id === payload.id);
        if (i !== -1) window.library[i] = { ...window.library[i], ...payload };
        showToast("Entry updated successfully!", "success");
      } else {
        payload.id = Date.now().toString() + Math.floor(Math.random() * 1000);
        payload.dateAdded = new Date().toISOString();
        window.library.unshift(payload);
        showToast("Entry saved successfully!", "success");
      }
      localStorage.setItem("codex_library", JSON.stringify(window.library));
      closeEntryModal();
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      renderLibrary();
      return;
    }

    const uid = auth.currentUser.uid;
    const colRef = collection(db, "users", uid, "library");

    if (window.editingId) {
      payload.id = String(window.editingId);
      await setDoc(doc(colRef, payload.id), payload, { merge: true });
      const i = (window.library || []).findIndex((l) => l.id === payload.id);
      if (i !== -1) window.library[i] = { ...window.library[i], ...payload };
      showToast("Entry updated successfully!", "success");
    } else {
      const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
      payload.id = newId;
      payload.dateAdded = new Date().toISOString();
      await setDoc(doc(colRef, newId), payload);
      window.library.unshift(payload);
      showToast("Entry saved successfully!", "success");
    }

    closeEntryModal();
    refreshGenreFilter();
    if (window.updateNavBadges) window.updateNavBadges();
    renderLibrary();
  } catch (err) {
    handleFirestoreError(err, "write", "users/.../library");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Entry";
    }
  }
});

export const deleteEntry = (window.deleteEntry = async (id) => {
  const targetId = String(id);
  const entry = (window.library || []).find((l) => l.id === targetId);
  if (!entry) return;

  const confirmed = await showAppDialog({
    title: "Delete Entry?",
    message: `Remove "${entry.title}" from your Codex?`,
    confirmText: "Delete",
    cancelText: "Cancel",
    danger: true,
  });
  if (!confirmed) return;

  const backupCopy = { ...entry };
  const restore = async () => {
    try {
      if (window.isGuestMode) {
        window.library.unshift(backupCopy);
        localStorage.setItem("codex_library", JSON.stringify(window.library));
      } else if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        await setDoc(doc(db, "users", uid, "library", targetId), backupCopy);
        if (!(window.library || []).some((l) => l.id === targetId)) {
          window.library.unshift(backupCopy);
        }
      }
      refreshGenreFilter();
      window.updateNavBadges?.();
      renderLibrary();
      showToast("Entry restored", "success");
    } catch (err) {
      handleFirestoreError(err, "write", "users/.../library");
    }
  };

  if (window.isGuestMode) {
    window.library = (window.library || []).filter((l) => l.id !== targetId);
    localStorage.setItem("codex_library", JSON.stringify(window.library));
    refreshGenreFilter();
    if (window.updateNavBadges) window.updateNavBadges();
    renderLibrary();
    if (window.closeDetailModal) window.closeDetailModal();
    showToast("Entry deleted", "success", {
      actionLabel: "Undo",
      onAction: restore,
      duration: 8000,
    });
    return;
  }

  try {
    const uid = auth.currentUser.uid;
    await deleteDoc(doc(db, "users", uid, "library", targetId));
    window.library = (window.library || []).filter((l) => l.id !== targetId);
    refreshGenreFilter();
    if (window.updateNavBadges) window.updateNavBadges();
    renderLibrary();
    if (window.closeDetailModal) window.closeDetailModal();
    showToast("Entry deleted", "success", {
      actionLabel: "Undo",
      onAction: restore,
      duration: 8000,
    });
  } catch (err) {
    handleFirestoreError(err, "delete", "users/.../library");
  }
});

registerActions({
  selectTier: (d) => selectTier(d.tier ?? ""),
  removeDraftGenre: (d) => removeDraftGenre(d.idx),
  switchEntryTab: (d) => switchEntryTab(d.tab),
});
