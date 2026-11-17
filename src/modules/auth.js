// ── AUTHENTICATION & CLOUD SYNC MODULE ──────────────────────────

import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  collection,
  doc,
  writeBatch,
  onSnapshot,
  handleFirestoreError,
} from "../config/firebase.js";
import { showToast } from "../utils/helpers.js";

export let unsubscribeLibrary = null;
window.isGuestMode = false;

export const signInWithGoogle = (window.signInWithGoogle = () => {
  const provider = new GoogleAuthProvider();
  const btn = document.getElementById("googleSignInBtn");
  if (btn) btn.textContent = "Loading...";
  signInWithPopup(auth, provider).catch((err) => {
    if (btn) btn.textContent = "🌐 Sign in with Google";
    if (err.code === "auth/unauthorized-domain") {
      alert(
        `Google Sign-In blocked.\n\nFirebase Authentication requires the app to be hosted on a web server (like GitHub Pages or Vercel). It will not work if you just open the index.html file locally on your computer (file://).\n\nPlease use "Guest Mode" for local usage, or host the website on a real domain and add that domain to Firebase Console -> Authentication -> Settings -> Authorized Domains.`,
      );
    } else {
      alert("Login error: " + err.message + " (" + err.code + ")");
    }
  });
});

export const useAsGuest = (window.useAsGuest = () => {
  localStorage.setItem("codex_guestMode", "true");
  window.isGuestMode = true;
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) loginOverlay.style.display = "none";
  const stored = localStorage.getItem("codex_library");
  if (stored) {
    try {
      window.library = JSON.parse(stored);
    } catch (e) {
      window.library = [];
    }
  } else {
    window.library = [];
  }

  const emailDisplay = document.getElementById("userEmailDisplay");
  if (emailDisplay) emailDisplay.textContent = "Guest Mode (Local Only)";
  const unameDisplay = document.getElementById("userUsernameDisplay");
  if (unameDisplay) unameDisplay.textContent = "Guest";
  const sub = document.getElementById("librarySubtitle");
  if (sub) sub.textContent = `Total Entries: ${window.library.length}`;

  if (window.refreshGenreFilter) window.refreshGenreFilter();
  if (window.updateNavBadges) window.updateNavBadges();

  const libSec = document.getElementById("page-library");
  const tierSec = document.getElementById("page-tierlist");
  const statSec = document.getElementById("page-stats");
  const seaSec = document.getElementById("page-seasonal");

  if (libSec && libSec.classList.contains("active")) {
    if (window.renderLibrary) window.renderLibrary();
  } else if (tierSec && tierSec.classList.contains("active")) {
    if (window.renderTierList) window.renderTierList();
  } else if (statSec && statSec.classList.contains("active")) {
    if (window.renderStats) window.renderStats();
  } else if (seaSec && seaSec.classList.contains("active")) {
    if (window.renderSeasonal) window.renderSeasonal();
  }
});

export const signOutUser = (window.signOutUser = () => {
  if (window.isGuestMode) {
    localStorage.removeItem("codex_guestMode");
    window.isGuestMode = false;
    const loginOverlay = document.getElementById("loginOverlay");
    if (loginOverlay) loginOverlay.style.display = "flex";
    const emailDisplay = document.getElementById("userEmailDisplay");
    if (emailDisplay) emailDisplay.textContent = "";
    const unameDisplay = document.getElementById("userUsernameDisplay");
    if (unameDisplay) unameDisplay.textContent = "";
    window.library = [];
    if (window.renderLibrary) window.renderLibrary();
  } else {
    signOut(auth);
  }
});

export function loadFirestoreLibrary(uid) {
  const colRef = collection(db, "users", uid, "library");
  const sub = document.getElementById("librarySubtitle");
  if (sub) sub.textContent = "Syncing from cloud...";
  if (unsubscribeLibrary) unsubscribeLibrary();

  unsubscribeLibrary = onSnapshot(
    colRef,
    (snapshot) => {
      window.library = snapshot.docs.map((d) => {
        const data = d.data();
        data.id = d.id;
        return data;
      });
      if (sub) sub.textContent = `Total Entries: ${window.library.length}`;
      if (window.refreshGenreFilter) window.refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();

      const libSec = document.getElementById("page-library");
      const tierSec = document.getElementById("page-tierlist");
      const statSec = document.getElementById("page-stats");
      const seaSec = document.getElementById("page-seasonal");

      if (libSec && libSec.classList.contains("active")) {
        if (window.renderLibrary) window.renderLibrary();
      } else if (tierSec && tierSec.classList.contains("active")) {
        if (window.renderTierList) window.renderTierList();
      } else if (statSec && statSec.classList.contains("active")) {
        if (window.renderStats) window.renderStats();
      } else if (seaSec && seaSec.classList.contains("active")) {
        if (window.renderSeasonal) window.renderSeasonal();
      }
    },
    (error) => {
      handleFirestoreError(error, "list", `users/${uid}/library`);
      showToast("Error loading library.", "error");
    },
  );
  window.unsubscribeLibrary = unsubscribeLibrary;
}
window.loadFirestoreLibrary = loadFirestoreLibrary;

// Backup Export & Import
export const exportBackup = (window.exportBackup = () => {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(window.library || []));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute(
    "download",
    `codex_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
  dlAnchorElem.click();
});

export const importBackup = (window.importBackup = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) throw new Error("Not an array");
      if (
        confirm("This will ADD/MERGE these entries to your database. Proceed?")
      ) {
        if (window.isGuestMode) {
          parsed.forEach((item, index) => {
            if (!item.id) item.id = Date.now().toString() + index;
            const existingIdx = (window.library || []).findIndex(
              (l) => l.id === item.id,
            );
            if (existingIdx !== -1)
              window.library[existingIdx] = {
                ...window.library[existingIdx],
                ...item,
              };
            else window.library.unshift(item);
          });
          localStorage.setItem(
            "codex_library",
            JSON.stringify(window.library),
          );
          closeBackupMenu();
          if (window.refreshGenreFilter) window.refreshGenreFilter();
          if (window.updateNavBadges) window.updateNavBadges();
          if (window.renderLibrary) window.renderLibrary();
          showToast("Backup Restored", "success");
          return;
        }

        const batch = writeBatch(db);
        const uid = auth.currentUser.uid;

        parsed.forEach((rawItem, index) => {
          if (!rawItem || !rawItem.title) return;
          const itemId = String(rawItem.id || Date.now().toString() + index)
            .replace(/[^a-zA-Z0-9_.\-]/g, "_")
            .slice(0, 128);
          const item = {
            id: itemId,
            title: String(rawItem.title).slice(0, 500),
            type: rawItem.type ? String(rawItem.type).slice(0, 60) : "Anime",
            status: rawItem.status ? String(rawItem.status).slice(0, 60) : "Plan to Watch",
            tier: rawItem.tier ? String(rawItem.tier).slice(0, 10) : "",
            poster: rawItem.poster ? String(rawItem.poster).slice(0, 2000) : "",
            link: rawItem.link ? String(rawItem.link).slice(0, 2000) : "",
            year: rawItem.year ? parseInt(rawItem.year, 10) || null : null,
            episodes: parseInt(rawItem.episodes, 10) || 0,
            season: rawItem.season ? String(rawItem.season).slice(0, 100) : "",
            genres: Array.isArray(rawItem.genres) ? rawItem.genres.slice(0, 30).map(String) : [],
            notes: rawItem.notes ? String(rawItem.notes).slice(0, 20000) : "",
            seasonCount: parseInt(rawItem.seasonCount, 10) || 0,
            watchedSeasons: Array.isArray(rawItem.watchedSeasons) ? rawItem.watchedSeasons.slice(0, 100) : [],
            stremioId: rawItem.stremioId ? String(rawItem.stremioId).slice(0, 128) : null,
            jikanId: rawItem.jikanId ? String(rawItem.jikanId).slice(0, 128) : null,
            malId: rawItem.malId ?? null,
            kitsuId: rawItem.kitsuId ? String(rawItem.kitsuId).slice(0, 128) : null,
            dateAdded: rawItem.dateAdded ? String(rawItem.dateAdded).slice(0, 64) : new Date().toISOString(),
          };

          const existingIdx = (window.library || []).findIndex(
            (l) => l.id === item.id,
          );
          if (existingIdx !== -1)
            window.library[existingIdx] = {
              ...window.library[existingIdx],
              ...item,
            };
          else window.library.unshift(item);

          batch.set(doc(db, "users", uid, "library", item.id), item, {
            merge: true,
          });
        });

        batch.commit().catch((err) => {
          handleFirestoreError(err, "write", "users/.../library");
          showToast("Failed to restore to cloud.", "error");
        });

        closeBackupMenu();
        if (window.refreshGenreFilter) window.refreshGenreFilter();
        if (window.updateNavBadges) window.updateNavBadges();
        if (window.renderLibrary) window.renderLibrary();
        showToast("Backup Restored", "success");
      }
    } catch (err) {
      handleFirestoreError(err, "write", "users/.../library");
      showToast("Invalid JSON or restore failed", "error");
    }
  };
  reader.readAsText(file);
});

export const toggleBackupMenu = (window.toggleBackupMenu = (e) => {
  e.stopPropagation();
  const menu = document.getElementById("backupMenu");
  if (!menu) return;
  if (menu.style.display === "block") {
    menu.style.display = "none";
  } else {
    menu.style.display = "block";
    const rect = e.target.closest(".btn").getBoundingClientRect();
    menu.style.top = rect.bottom + 8 + "px";
    menu.style.right = window.innerWidth - rect.right + "px";
  }
});

export const closeBackupMenu = (window.closeBackupMenu = () => {
  const menu = document.getElementById("backupMenu");
  if (menu) menu.style.display = "none";
});
