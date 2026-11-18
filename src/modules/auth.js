// ── AUTHENTICATION, SANITIZATION & CLOUD SYNC MODULE ──────────────

import {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  collection,
  doc,
  writeBatch,
  onSnapshot,
  handleFirestoreError,
} from "../config/firebase.js";
import {
  showToast,
  safeUrl,
  showAppDialog,
  getEpisodesWatched,
  getEpisodesTotal,
} from "../utils/helpers.js";

export let unsubscribeLibrary = null;
window.isGuestMode = false;

const VALID_TYPES = new Set(["Anime", "Movie", "Web Series", "OVA", "Special"]);
const VALID_STATUSES = new Set([
  "Plan to Watch",
  "Watching",
  "Completed",
  "On Hold",
  "Dropped",
  "Rewatching",
]);
const VALID_TIERS = new Set(["", "S", "A", "B", "C", "D", "E", "F"]);

let originalLoginBtnHtml = null;

export function resetLoginButton() {
  const btn = document.getElementById("googleSignInBtn");
  if (!btn) return;
  if (originalLoginBtnHtml !== null) {
    btn.innerHTML = originalLoginBtnHtml;
  }
  btn.disabled = false;
  btn.removeAttribute("aria-busy");
}

export function sanitizeEntry(rawItem, fallbackId = "") {
  if (!rawItem || typeof rawItem !== "object") return null;
  const title = String(rawItem.title || "").trim().slice(0, 500);
  if (!title) return null;

  const rawId = String(rawItem.id || fallbackId || Date.now().toString())
    .replace(/[^a-zA-Z0-9_.\-]/g, "_")
    .slice(0, 128);
  const itemId = rawId || String(Date.now());

  const type = VALID_TYPES.has(rawItem.type) ? rawItem.type : "Anime";
  const status = VALID_STATUSES.has(rawItem.status) ? rawItem.status : "Plan to Watch";
  const tier = VALID_TIERS.has(rawItem.tier) ? rawItem.tier : "";

  const parsedYear = parseInt(rawItem.year, 10);
  const year =
    Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= 2100
      ? parsedYear
      : null;

  const hasSplit =
    rawItem.episodesWatched !== undefined && rawItem.episodesWatched !== null;
  const legacyEps = Math.min(100000, Math.max(0, parseInt(rawItem.episodes, 10) || 0));
  const episodesWatched = hasSplit
    ? Math.min(100000, Math.max(0, parseInt(rawItem.episodesWatched, 10) || 0))
    : status === "Plan to Watch"
      ? 0
      : legacyEps;
  const episodesTotal =
    rawItem.episodesTotal !== undefined && rawItem.episodesTotal !== null
      ? Math.min(100000, Math.max(0, parseInt(rawItem.episodesTotal, 10) || 0))
      : legacyEps;

  const isEpisodic = type === "Anime" || type === "Web Series";
  const seasonCount = isEpisodic
    ? Math.min(50, Math.max(0, parseInt(rawItem.seasonCount, 10) || 0))
    : 0;
  const watchedSeasons = isEpisodic && Array.isArray(rawItem.watchedSeasons)
    ? rawItem.watchedSeasons
        .map((n) => parseInt(n, 10))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 50)
        .slice(0, 100)
    : [];

  let malId = null;
  if (typeof rawItem.malId === "number" && Number.isFinite(rawItem.malId)) {
    malId = rawItem.malId;
  } else if (typeof rawItem.malId === "string" && rawItem.malId.trim()) {
    malId = rawItem.malId.trim().slice(0, 64);
  }

  return {
    id: itemId,
    title,
    type,
    status,
    tier,
    poster: safeUrl(rawItem.poster),
    link: safeUrl(rawItem.link),
    year,
    episodes: episodesWatched,
    episodesWatched,
    episodesTotal,
    season: rawItem.season ? String(rawItem.season).trim().slice(0, 100) : "",
    genres: Array.isArray(rawItem.genres)
      ? rawItem.genres
          .map((g) => String(g || "").trim())
          .filter(Boolean)
          .slice(0, 30)
      : [],
    notes: rawItem.notes ? String(rawItem.notes).slice(0, 20000) : "",
    seasonCount,
    watchedSeasons,
    stremioId: rawItem.stremioId ? String(rawItem.stremioId).slice(0, 128) : null,
    jikanId: rawItem.jikanId ? String(rawItem.jikanId).slice(0, 128) : null,
    malId,
    kitsuId: rawItem.kitsuId ? String(rawItem.kitsuId).slice(0, 128) : null,
    dateAdded: rawItem.dateAdded
      ? String(rawItem.dateAdded).slice(0, 64)
      : new Date().toISOString(),
  };
}

export async function commitEntriesInChunks(uid, entries, merge = true) {
  const BATCH_LIMIT = 450;
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const chunk = entries.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((item) => {
      batch.set(doc(db, "users", uid, "library", item.id), item, { merge });
    });
    await batch.commit();
  }
}

export async function deleteEntryIdsInChunks(uid, ids) {
  const BATCH_LIMIT = 450;
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((id) => {
      batch.delete(doc(db, "users", uid, "library", String(id)));
    });
    await batch.commit();
  }
}

export const signInWithGoogle = (window.signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  const btn = document.getElementById("googleSignInBtn");
  if (btn) {
    if (originalLoginBtnHtml === null) originalLoginBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "Signing in…";
  }
  try {
    await signInWithPopup(auth, provider);
    resetLoginButton();
  } catch (err) {
    if (err.code === "auth/popup-blocked" && window.self === window.top) {
      try {
        await signInWithRedirect(auth, provider);
        return;
      } catch (redirErr) {
        resetLoginButton();
        showToast("Login error: " + redirErr.message, "error");
        return;
      }
    }
    resetLoginButton();
    if (err.code === "auth/unauthorized-domain") {
      await showAppDialog({
        title: "Google Sign-In Blocked",
        message:
          'This domain is not yet authorized in Firebase Console -> Authentication -> Settings -> Authorized Domains. Use "Guest Mode" for local usage, or add your hosting domain.',
        confirmText: "OK",
        cancelText: "Close",
      });
    } else if (err.code === "auth/popup-blocked") {
      showToast(
        "Pop-up was blocked by your browser. Allow pop-ups for this site or open in a standalone tab.",
        "error",
        { duration: 6000 },
      );
    } else if (err.code !== "auth/popup-closed-by-user") {
      showToast(`Login error: ${err.message}`, "error");
    }
  }
});

let promptedGuestMergeForUid = null;
export async function promptGuestMergeIfNeeded(uid) {
  if (!uid || promptedGuestMergeForUid === uid) return;
  const raw = localStorage.getItem("codex_library");
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return;

  const clean = [];
  parsed.forEach((item, idx) => {
    const s = sanitizeEntry(item, `local_${Date.now()}_${idx}`);
    if (s) clean.push(s);
  });
  if (clean.length === 0) return;

  promptedGuestMergeForUid = uid;
  const confirmed = await showAppDialog({
    title: "Import Local Entries?",
    message: `Found ${clean.length} local guest ${clean.length === 1 ? "entry" : "entries"} saved in this browser. Import them into your cloud account?`,
    confirmText: `Import ${clean.length}`,
    cancelText: "Keep Local Only",
  });
  if (!confirmed) return;

  try {
    await commitEntriesInChunks(uid, clean, true);
    localStorage.removeItem("codex_library");
    showToast(`Imported ${clean.length} local entries into your Codex!`, "success");
  } catch (err) {
    handleFirestoreError(err, "write", `users/${uid}/library`);
  }
}

export const useAsGuest = (window.useAsGuest = () => {
  localStorage.setItem("codex_guestMode", "true");
  window.isGuestMode = true;
  const loginOverlay = document.getElementById("loginOverlay");
  if (loginOverlay) loginOverlay.style.display = "none";
  const stored = localStorage.getItem("codex_library");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      window.library = Array.isArray(parsed)
        ? parsed.map((x, i) => sanitizeEntry(x, `guest_${i}`)).filter(Boolean)
        : [];
    } catch {
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
  resetLoginButton();
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
        return {
          ...data,
          id: d.id,
          episodesWatched: getEpisodesWatched(data),
          episodesTotal: getEpisodesTotal(data),
        };
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
    },
  );
  window.unsubscribeLibrary = unsubscribeLibrary;
}
window.loadFirestoreLibrary = loadFirestoreLibrary;

// Backup Export & Import
export const exportBackup = (window.exportBackup = () => {
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(window.library || [], null, 2));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute(
    "download",
    `codex_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
  dlAnchorElem.click();
});

export const importBackup = (window.importBackup = (e) => {
  const fileInput = e.target;
  const file = fileInput?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function (evt) {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) throw new Error("Backup JSON must be an array");

      const currentLib = window.library || [];
      const existingIds = new Set(currentLib.map((l) => l.id));
      const clean = [];
      let skippedCount = 0;
      let newCount = 0;
      let updatedCount = 0;

      parsed.forEach((rawItem, index) => {
        const sanitized = sanitizeEntry(rawItem, `${Date.now()}_${index}`);
        if (!sanitized) {
          skippedCount++;
          return;
        }
        if (existingIds.has(sanitized.id)) updatedCount++;
        else newCount++;
        clean.push(sanitized);
      });

      if (clean.length === 0) {
        showToast("No valid entries found in backup file.", "error");
        return;
      }

      const mode = await showAppDialog({
        title: "Import Backup Preview",
        message: `Ready to import from "${file.name}": ${newCount} new, ${updatedCount} updated, ${skippedCount} skipped. Choose Merge to add/update or Replace to overwrite your entire collection.`,
        confirmText: "Merge Entries",
        altText: "Replace All",
        cancelText: "Cancel",
      });

      if (!mode) return;
      const isReplace = mode === "alt";

      if (window.isGuestMode) {
        let nextLib = isReplace ? [] : [...currentLib];
        clean.forEach((item) => {
          const idx = nextLib.findIndex((l) => l.id === item.id);
          if (idx !== -1) nextLib[idx] = { ...nextLib[idx], ...item };
          else nextLib.unshift(item);
        });
        window.library = nextLib;
        localStorage.setItem("codex_library", JSON.stringify(window.library));
        closeBackupMenu();
        if (window.refreshGenreFilter) window.refreshGenreFilter();
        if (window.updateNavBadges) window.updateNavBadges();
        if (window.renderLibrary) window.renderLibrary();
        showToast(
          `Backup restored (${clean.length} ${isReplace ? "replaced" : "merged"})`,
          "success",
        );
        return;
      }

      if (!auth.currentUser) {
        showToast("Please sign in first", "error");
        return;
      }

      const uid = auth.currentUser.uid;
      if (isReplace && currentLib.length > 0) {
        await deleteEntryIdsInChunks(
          uid,
          currentLib.map((l) => l.id),
        );
      }
      await commitEntriesInChunks(uid, clean, !isReplace);

      let nextLib = isReplace ? [] : [...currentLib];
      clean.forEach((item) => {
        const idx = nextLib.findIndex((l) => l.id === item.id);
        if (idx !== -1) nextLib[idx] = { ...nextLib[idx], ...item };
        else nextLib.unshift(item);
      });
      window.library = nextLib;

      closeBackupMenu();
      if (window.refreshGenreFilter) window.refreshGenreFilter();
      if (window.updateNavBadges) window.updateNavBadges();
      if (window.renderLibrary) window.renderLibrary();
      showToast(
        `Backup restored (${clean.length} entries${skippedCount ? `, ${skippedCount} skipped` : ""})`,
        "success",
      );
    } catch (err) {
      handleFirestoreError(err, "write", "users/.../library");
    } finally {
      if (fileInput) fileInput.value = "";
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
    const anchor = e.target.closest(".btn");
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      menu.style.top = rect.bottom + 8 + "px";
      menu.style.right = window.innerWidth - rect.right + "px";
    }
  }
});

export const closeBackupMenu = (window.closeBackupMenu = () => {
  const menu = document.getElementById("backupMenu");
  if (menu) menu.style.display = "none";
});
