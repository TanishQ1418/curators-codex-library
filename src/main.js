// ── THE CURATOR'S CODEX - APPLICATION ENTRY POINT ─────────────────

import "./config/firebase.js";
import { auth, onAuthStateChanged } from "./config/firebase.js";
import { setupGlobalKeyShortcuts } from "./utils/helpers.js";
import { onTypeChange } from "./utils/seasons.js";
import "./services/api.js";
import { loadFirestoreLibrary, useAsGuest } from "./modules/auth.js";
import { refreshGenreFilter, renderLibrary, setView } from "./modules/library.js";
import { setupTierSelector } from "./modules/entryModal.js";
import "./modules/tierlist.js";
import "./modules/stats.js";
import "./modules/seasonal.js";
import "./modules/surprise.js";
import "./modules/detailModal.js";
import "./modules/discover.js";
import { setupSocialListeners, initSocial, initAdminPanel } from "./modules/social.js";
import { navigateTo, updateNavBadges } from "./modules/navigation.js";

// Global library array
window.library = [];

// Initialize application on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  // Setup keyboard shortcuts and document click handlers
  setupGlobalKeyShortcuts();
  setupTierSelector();
  setupSocialListeners();

  // Reset filters on refresh
  const fType = document.getElementById("filterType");
  const fStatus = document.getElementById("filterStatus");
  const fTier = document.getElementById("filterTier");
  const fGenre = document.getElementById("filterGenre");
  const sBy = document.getElementById("sortBy");

  if (fType) fType.value = "";
  if (fStatus) fStatus.value = "";
  if (fTier) fTier.value = "";
  if (fGenre) fGenre.value = "";
  if (sBy) sBy.value = "titleAZ";

  // Check guest mode stored in localStorage
  if (localStorage.getItem("codex_guestMode") === "true") {
    useAsGuest();
    const loading = document.getElementById("loadingOverlay");
    if (loading) loading.style.display = "none";
  }

  // Monitor Firebase Auth state
  onAuthStateChanged(auth, (user) => {
    const loading = document.getElementById("loadingOverlay");
    if (loading) loading.style.display = "none";

    if (user) {
      window.isGuestMode = false;
      const loginOverlay = document.getElementById("loginOverlay");
      if (loginOverlay) loginOverlay.style.display = "none";

      const emailDisplay = document.getElementById("userEmailDisplay");
      if (emailDisplay) emailDisplay.textContent = user.email;

      if (user.email === "tanishqt00@gmail.com") {
        const adminNav = document.getElementById("nav-item-admin");
        if (adminNav) adminNav.style.display = "flex";
        const adminMore = document.getElementById("more-item-admin");
        if (adminMore) adminMore.style.display = "flex";
        initAdminPanel();
      }

      loadFirestoreLibrary(user.uid);
      initSocial();
    } else {
      if (!window.isGuestMode) {
        const loginOverlay = document.getElementById("loginOverlay");
        if (loginOverlay) loginOverlay.style.display = "flex";

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = "";

        const unameDisplay = document.getElementById("userUsernameDisplay");
        if (unameDisplay) unameDisplay.textContent = "";

        if (window.unsubscribeLibrary) window.unsubscribeLibrary();
        if (window.unsubscribeProfile) {
          window.unsubscribeProfile();
          window.unsubscribeProfile = null;
        }
        if (window.unsubscribeFriends) {
          window.unsubscribeFriends();
          window.unsubscribeFriends = null;
        }
        if (window.unsubscribeNotifs) {
          window.unsubscribeNotifs();
          window.unsubscribeNotifs = null;
        }
        if (window.unsubscribeFriendLibrary) {
          window.unsubscribeFriendLibrary();
          window.unsubscribeFriendLibrary = null;
        }

        window.library = [];
        window.socialProfile = null;
        window.socialFriends = [];
        window.socialNotifications = [];
        renderLibrary();
      }
    }
  });

  refreshGenreFilter();
  updateNavBadges();
  setView(window._currentView || "grid");
  navigateTo("library");
});
