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
import { showToast } from "../utils/helpers.js";
import {
  currentWatchedSeasons,
  setWatchedSeasons,
  renderSeasonChips,
  onTypeChange,
} from "../utils/seasons.js";
import { refreshGenreFilter, renderLibrary } from "./library.js";

export let currentDraftGenres = [];
export let currentDraftTier = "";
window.editingId = null;

export function setCurrentDraftGenres(genres) {
  currentDraftGenres = genres || [];
  renderDraftGenres();
}
window.setCurrentDraftGenres = setCurrentDraftGenres;

export const switchEntryTab = (window.switchEntryTab = (tabNum) => {
  [1, 2, 3].forEach((n) => {
    const pane = document.getElementById(`entryTab-${n}`);
    const btn = document.getElementById(`entryTabBtn-${n}`);
    if (pane) pane.style.display = n === tabNum ? "grid" : "none";
    if (btn) btn.classList.toggle("active", n === tabNum);
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
  currentDraftTier = t;
  document
    .querySelectorAll(".tier-tile")
    .forEach((el) => el.classList.remove("selected"));
  if (t) {
    const el = document.getElementById(`tierTile-${t}`);
    if (el) el.classList.add("selected");
  }
});

export function setupTierSelector() {
  const c = document.getElementById("tierSelector");
  if (!c) return;
  const tiers = ["S", "A", "B", "C", "D", "E", "F"];
  c.innerHTML = tiers
    .map(
      (t) =>
        `<div class="tier-tile tier-label-${t}" id="tierTile-${t}" onclick="window.selectTier('${t}')">${t}</div>`,
    )
    .join("");
}
window.setupTierSelector = setupTierSelector;

export const handleGenreKey = (window.handleGenreKey = (e) => {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = e.target.value.trim().replace(",", "");
    if (val && !currentDraftGenres.includes(val)) {
      currentDraftGenres.push(val);
      renderDraftGenres();
    }
    e.target.value = "";
  }
});

export const removeDraftGenre = (window.removeDraftGenre = (idx) => {
  currentDraftGenres.splice(idx, 1);
  renderDraftGenres();
});

export function renderDraftGenres() {
  const container = document.getElementById("genreTags");
  if (!container) return;
  container.innerHTML = currentDraftGenres
    .map(
      (g, i) =>
        `<span class="tag-pill">${g} <span class="tag-remove" onclick="window.removeDraftGenre(${i})">×</span></span>`,
    )
    .join("");
}
window.renderDraftGenres = renderDraftGenres;

export const openAddModal = (window.openAddModal = () => {
  window.editingId = null;
  window._draftStremioId = null;
  window._draftJikanId = null;
  window._draftMalId = null;
  window.switchEntryTab(1);

  document.getElementById("entryModalTitle").textContent = "ADD ENTRY";
  document.getElementById("field-title").value = "";
  document.getElementById("field-poster").value = "";
  document.getElementById("field-episodes").value = "";
  document.getElementById("field-year").value = "";
  document.getElementById("field-link").value = "";
  document.getElementById("field-season").value = "";
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
  document.getElementById("entryModalOverlay")?.classList.add("open");
});

export const closeEntryModal = (window.closeEntryModal = () => {
  document.getElementById("entryModalOverlay")?.classList.remove("open");
});

export const editEntry = (window.editEntry = (id) => {
  const entry = (window.library || []).find((l) => l.id === String(id));
  if (!entry) return;
  window.editingId = entry.id;
  window.switchEntryTab(1);
  document.getElementById("entryModalTitle").textContent = "EDIT ENTRY";

  document.getElementById("field-title").value = entry.title || "";
  document.getElementById("field-type").value = entry.type || "Anime";
  document.getElementById("field-status").value =
    entry.status || "Plan to Watch";
  document.getElementById("field-poster").value = entry.poster || "";
  document.getElementById("field-episodes").value = entry.episodes || "";
  document.getElementById("field-year").value = entry.year || "";
  document.getElementById("field-link").value = entry.link || "";
  document.getElementById("field-season").value = entry.season || "";
  document.getElementById("field-notes").value = entry.notes || "";
  document.getElementById("field-seasonCount").value = entry.seasonCount || "0";
  document.getElementById("seasonCountLabel").textContent =
    entry.seasonCount || "0";

  window._draftStremioId = entry.stremioId || null;
  window._draftJikanId = entry.jikanId || null;
  window._draftMalId = entry.malId || null;

  currentDraftGenres = [...(entry.genres || [])];
  setWatchedSeasons([...(entry.watchedSeasons || [])]);
  renderDraftGenres();
  currentDraftTier = "";
  window.selectTier(entry.tier || "");

  document.getElementById("autofillStatus").innerHTML = "";
  const dd = document.getElementById("searchDropdown");
  if (dd) dd.style.display = "none";
  onTypeChange();
  document.getElementById("entryModalOverlay")?.classList.add("open");
});

export const saveEntry = (window.saveEntry = async () => {
  try {
    if (!auth.currentUser && !window.isGuestMode)
      return showToast("You must be logged in!", "error");

    const titleField = document.getElementById("field-title");
    const title = titleField ? titleField.value.trim() : "";
    if (!title) return showToast("Title is required!", "error");

    const payload = {
      title,
      type: document.getElementById("field-type")?.value || "Anime",
      status: document.getElementById("field-status")?.value || "Plan to Watch",
      tier: currentDraftTier,
      poster: document.getElementById("field-poster")?.value || "",
      link: document.getElementById("field-link")?.value || "",
      year: parseInt(document.getElementById("field-year")?.value) || null,
      episodes:
        parseInt(document.getElementById("field-episodes")?.value) || 0,
      season: document.getElementById("field-season")?.value.trim() || "",
      genres: [...currentDraftGenres],
      notes: document.getElementById("field-notes")?.value.trim() || "",
      seasonCount:
        parseInt(document.getElementById("field-seasonCount")?.value) || 0,
      watchedSeasons: [...currentWatchedSeasons],
      stremioId: window._draftStremioId || null,
      jikanId: window._draftJikanId || null,
      malId: window._draftMalId || null,
    };

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
        showToast("Entry Saved successfully!", "success");
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

    try {
      if (window.editingId) {
        payload.id = String(window.editingId);
        setDoc(doc(colRef, payload.id), payload, { merge: true }).catch(
          (err) => {
            handleFirestoreError(err, "write", "users/.../library");
            showToast("Failed to sync to cloud. Retrying...", "error");
          },
        );

        const i = (window.library || []).findIndex((l) => l.id === payload.id);
        if (i !== -1) window.library[i] = { ...window.library[i], ...payload };

        showToast("Entry updated successfully!", "success");
      } else {
        const newId = Date.now().toString() + Math.floor(Math.random() * 1000);
        payload.id = newId;
        payload.dateAdded = new Date().toISOString();
        setDoc(doc(colRef, newId), payload).catch((err) => {
          handleFirestoreError(err, "write", "users/.../library");
          showToast("Failed to sync to cloud. Retrying...", "error");
        });

        window.library.unshift(payload);
        showToast("Entry Saved successfully!", "success");
      }
      closeEntryModal();
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      renderLibrary();
    } catch (err) {
      handleFirestoreError(err, "write", "users/.../library");
      showToast("Failed to save entry", "error");
    }
  } catch (globalErr) {
    alert("Unexpected error in saveEntry: " + globalErr.message);
    console.error(globalErr);
  }
});

export const deleteEntry = (window.deleteEntry = async (id) => {
  if (confirm("Delete this entry permanently?")) {
    if (window.isGuestMode) {
      window.library = (window.library || []).filter(
        (l) => l.id !== String(id),
      );
      localStorage.setItem("codex_library", JSON.stringify(window.library));
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      renderLibrary();
      if (window.closeDetailModal) window.closeDetailModal();
      showToast("Entry deleted", "success");
      return;
    }

    try {
      const uid = auth.currentUser.uid;
      await deleteDoc(doc(db, "users", uid, "library", String(id)));

      window.library = (window.library || []).filter(
        (l) => l.id !== String(id),
      );
      refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      renderLibrary();
      if (window.closeDetailModal) window.closeDetailModal();
      showToast("Entry deleted", "success");
    } catch (err) {
      try {
        handleFirestoreError(err, "delete", "users/.../library");
      } catch (e) {}
      showToast("Failed to delete: " + err.message, "error");
    }
  }
});
