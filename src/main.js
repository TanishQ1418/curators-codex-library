// ── THE CURATOR'S CODEX - APPLICATION ENTRY POINT ─────────────────

import "./config/firebase.js";
import {
  auth,
  db,
  doc,
  getDoc,
  getRedirectResult,
  onAuthStateChanged,
} from "./config/firebase.js";
import {
  setupGlobalKeyShortcuts,
  registerActions,
  showToast,
  openOverlay,
  closeOverlay,
} from "./utils/helpers.js";
import { onTypeChange, renderSeasonChips } from "./utils/seasons.js";
import { onTitleInput, handleTitleKey } from "./services/api.js";
import {
  loadFirestoreLibrary,
  useAsGuest,
  signInWithGoogle,
  signOutUser,
  resetLoginButton,
  promptGuestMergeIfNeeded,
  exportBackup,
  importBackup,
  toggleBackupMenu,
  closeBackupMenu,
} from "./modules/auth.js";
import {
  refreshGenreFilter,
  renderLibrary,
  setView,
  onSearchInput,
  clearSearch,
  quickFilterStatus,
  toggleLibraryFiltersDrawer,
  updateFilterBadge,
  clearFilters,
  selectAllFiltered,
  bulkDelete,
  clearSelection,
} from "./modules/library.js";
import {
  setupTierSelector,
  openAddModal,
  closeEntryModal,
  saveEntry,
  handleGenreKey,
} from "./modules/entryModal.js";
import "./modules/tierlist.js";
import "./modules/stats.js";
import { renderSeasonal } from "./modules/seasonal.js";
import {
  openSurpriseModal,
  closeSurpriseModal,
  pickSurprise,
} from "./modules/surprise.js";
import { closeDetailModal } from "./modules/detailModal.js";
import {
  renderDiscover,
  switchDiscoverType,
  loadDiscoverRejections,
  resetDiscoverCache,
} from "./modules/discover.js";
import {
  setupSocialListeners,
  initSocial,
  initAdminPanel,
  openSocialSettings,
  closeSocialSettings,
  saveSocialSettingsDisplayName,
  saveSocialSettingsVisibility,
  saveSocialSettingsToggle,
  toggleNotificationsDrawer,
  clearAllNotifications,
  switchPendingTab,
  renderFriendsGrid,
  openRecommendationsViewer,
  closeRecommendationsViewer,
  closeFriendLibrary,
  pickFriendSurprise,
  openRecommendFromFriendView,
  quickFilterFriendStatus,
  toggleFriendFiltersDrawer,
  updateFriendFilterBadge,
  clearFriendFilters,
  clearFriendSearch,
  setFriendView,
  renderFriendLibrary,
  closeRecommendModal,
  onRecommendSearchInput,
  sendRecommendation,
} from "./modules/social.js";
import {
  navigateTo,
  updateNavBadges,
  toggleSidebar,
  closeSidebar,
  toggleMobileMoreMenu,
  closeMobileMoreMenu,
} from "./modules/navigation.js";

// Global application state
window.library = [];
window.isSiteAdmin = false;

function bindStaticDomHandlers() {
  // Backdrop clicks on modal overlays
  document.querySelectorAll('.modal-overlay[data-backdrop-close="1"]').forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target !== ov) return;
      if (ov.id === "notificationsDrawerOverlay") toggleNotificationsDrawer();
      else if (ov.id === "entryModalOverlay") closeEntryModal();
      else if (ov.id === "detailModalOverlay") closeDetailModal();
      else if (ov.id === "socialSettingsOverlay") closeSocialSettings();
      else if (ov.id === "recommendModalOverlay") closeRecommendModal();
      else if (ov.id === "surpriseModalOverlay") closeSurpriseModal();
      else closeOverlay(ov.id);
    });
  });

  document.getElementById("searchInput")?.addEventListener("input", onSearchInput);
  document.getElementById("importBackupInput")?.addEventListener("change", (e) => {
    importBackup(e);
  });
  document.getElementById("sortBy")?.addEventListener("change", renderLibrary);

  ["filterType", "filterTier", "filterGenre"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      updateFilterBadge();
      renderLibrary();
    });
  });

  document.getElementById("seasonalFilter")?.addEventListener("change", renderSeasonal);
  document.getElementById("allowSequelsToggle")?.addEventListener("change", () => {
    renderDiscover(true);
  });
  document.getElementById("localFriendSearch")?.addEventListener("input", renderFriendsGrid);

  document
    .getElementById("socialSettingsVisibility")
    ?.addEventListener("change", (e) => {
      saveSocialSettingsVisibility(e.target.value);
    });
  document
    .getElementById("socialSettingsSearch")
    ?.addEventListener("change", (e) => {
      saveSocialSettingsToggle("showInSearch", e.target.checked);
    });
  document
    .getElementById("socialSettingsRequests")
    ?.addEventListener("change", (e) => {
      saveSocialSettingsToggle("allowRequests", e.target.checked);
    });

  document
    .getElementById("friendSearchInput")
    ?.addEventListener("input", renderFriendLibrary);
  document
    .getElementById("friendSortBy")
    ?.addEventListener("change", renderFriendLibrary);
  [
    "friendFilterType",
    "friendFilterTier",
    "friendFilterGenre",
    "friendFilterOverlap",
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      updateFriendFilterBadge();
      renderFriendLibrary();
    });
  });

  const recInput = document.getElementById("recommendSearchInput");
  if (recInput) {
    recInput.addEventListener("input", onRecommendSearchInput);
    recInput.addEventListener("focus", onRecommendSearchInput);
  }

  const titleField = document.getElementById("field-title");
  if (titleField) {
    titleField.addEventListener("input", onTitleInput);
    titleField.addEventListener("keydown", handleTitleKey);
  }
  document.getElementById("field-type")?.addEventListener("change", onTypeChange);
  document.getElementById("genreInput")?.addEventListener("keydown", handleGenreKey);

  const seasonCountRange = document.getElementById("field-seasonCount");
  if (seasonCountRange) {
    seasonCountRange.addEventListener("input", (e) => {
      const lbl = document.getElementById("seasonCountLabel");
      if (lbl) lbl.textContent = e.target.value;
      renderSeasonChips();
    });
  }
}

registerActions({
  nav: (d) => navigateTo(d.page),
  toggleSidebar: () => toggleSidebar(),
  closeSidebar: () => closeSidebar(),
  toggleMore: (_d, _el, e) => toggleMobileMoreMenu(e),
  closeMore: () => closeMobileMoreMenu(),
  signOut: () => signOutUser(),
  googleSignIn: () => signInWithGoogle(),
  useGuest: () => useAsGuest(),
  openLoginFromGuest: () => {
    localStorage.removeItem("codex_guestMode");
    window.isGuestMode = false;
    const ov = document.getElementById("loginOverlay");
    if (ov) ov.style.display = "flex";
  },
  clearSearch: () => clearSearch(),
  toggleNotifs: () => toggleNotificationsDrawer(),
  clearAllNotifs: () => clearAllNotifications(),
  toggleBackupMenu: (_d, _el, e) => toggleBackupMenu(e),
  exportBackup: () => {
    exportBackup();
    closeBackupMenu();
  },
  quickFilterStatus: (d) => quickFilterStatus(d.status ?? ""),
  toggleLibFilters: () => toggleLibraryFiltersDrawer(),
  setView: (d) => setView(d.view),
  openSurprise: () => openSurpriseModal(),
  closeSurpriseModal: () => closeSurpriseModal(),
  pickSurprise: () => pickSurprise(),
  selectAll: () => selectAllFiltered(),
  clearFilters: () => clearFilters(),
  bulkDelete: () => bulkDelete(),
  clearSelection: () => clearSelection(),
  switchDiscover: (d) => switchDiscoverType(d.type),
  refreshDiscover: () => renderDiscover(true),
  openSocialSettings: () => openSocialSettings(),
  closeSocialSettings: () => closeSocialSettings(),
  saveSocialDisplayName: () => saveSocialSettingsDisplayName(),
  copyFriendCode: async () => {
    const val = document.getElementById("socialSettingsUid")?.value || "";
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      showToast("Invite code copied to clipboard", "success");
    } catch {
      showToast("Copy failed — select and copy manually.", "error");
    }
  },
  switchPendingTab: (d) => switchPendingTab(d.tab),
  openRecViewer: () => openRecommendationsViewer(),
  closeRecViewer: () => closeRecommendationsViewer(),
  closeFriendLib: () => closeFriendLibrary(),
  pickFriendSurprise: () => pickFriendSurprise(),
  openRecFromFriend: () => openRecommendFromFriendView(),
  quickFilterFriendStatus: (d) => quickFilterFriendStatus(d.status ?? ""),
  toggleFriendFilters: () => toggleFriendFiltersDrawer(),
  setFriendView: (d) => setFriendView(d.view),
  clearFriendFilters: () => clearFriendFilters(),
  clearFriendSearch: () => clearFriendSearch(),
  closeRecModal: () => closeRecommendModal(),
  sendRec: () => sendRecommendation(),
  closeEntryModal: () => closeEntryModal(),
  saveEntry: () => saveEntry(),
  focusGenreInput: () => document.getElementById("genreInput")?.focus(),
  closeDetailModal: () => closeDetailModal(),
  openShortcuts: () => openOverlay("shortcutsModalOverlay"),
  closeShortcuts: () => closeOverlay("shortcutsModalOverlay"),
  openLegal: () => openOverlay("legalModalOverlay"),
  closeLegal: () => closeOverlay("legalModalOverlay"),
  adminRefreshUsers: () => initAdminPanel(),
  adminClearCache: () => window.clearDiscoverCache?.(),
  adminExportBackup: () => exportBackup(),
});

// Initialize application on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupGlobalKeyShortcuts();
  setupTierSelector();
  setupSocialListeners();
  bindStaticDomHandlers();

  // Handle redirect auth result when top-level redirect flow returns
  getRedirectResult(auth).catch((err) => {
    if (err && err.code !== "auth/no-auth-event") {
      showToast(`Login error: ${err.message}`, "error");
    }
  });

  // Reset filters on refresh
  ["filterType", "filterStatus", "filterTier", "filterGenre"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const sBy = document.getElementById("sortBy");
  if (sBy) sBy.value = "titleAZ";

  let initialAuthResolved = false;

  // Monitor Firebase Auth state BEFORE activating guest mode (P2-2)
  onAuthStateChanged(auth, async (user) => {
    const loading = document.getElementById("loadingOverlay");
    if (loading) loading.style.display = "none";

    if (user) {
      initialAuthResolved = true;
      window.isGuestMode = false;
      localStorage.removeItem("codex_guestMode");
      resetLoginButton();

      const loginOverlay = document.getElementById("loginOverlay");
      if (loginOverlay) loginOverlay.style.display = "none";

      const emailDisplay = document.getElementById("userEmailDisplay");
      if (emailDisplay) emailDisplay.textContent = user.email || "";

      // Check Firestore /admins/{uid} document (P1-6)
      let isAdmin = false;
      try {
        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        isAdmin = adminSnap.exists();
      } catch {
        isAdmin = false;
      }
      window.isSiteAdmin = isAdmin;

      const adminNav = document.getElementById("nav-item-admin");
      if (adminNav) adminNav.style.display = isAdmin ? "flex" : "none";
      const adminMore = document.getElementById("more-item-admin");
      if (adminMore) adminMore.style.display = isAdmin ? "flex" : "none";
      if (isAdmin) initAdminPanel();

      loadFirestoreLibrary(user.uid);
      initSocial();
      loadDiscoverRejections(user.uid);
      promptGuestMergeIfNeeded(user.uid);
    } else {
      window.isSiteAdmin = false;
      const adminNav = document.getElementById("nav-item-admin");
      if (adminNav) adminNav.style.display = "none";
      const adminMore = document.getElementById("more-item-admin");
      if (adminMore) adminMore.style.display = "none";

      if (window.unsubscribeLibrary) {
        window.unsubscribeLibrary();
        window.unsubscribeLibrary = null;
      }
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

      resetDiscoverCache();
      resetLoginButton();

      if (!initialAuthResolved && localStorage.getItem("codex_guestMode") === "true") {
        initialAuthResolved = true;
        useAsGuest();
        return;
      }

      initialAuthResolved = true;
      if (!window.isGuestMode) {
        const loginOverlay = document.getElementById("loginOverlay");
        if (loginOverlay) loginOverlay.style.display = "flex";

        const emailDisplay = document.getElementById("userEmailDisplay");
        if (emailDisplay) emailDisplay.textContent = "";

        const unameDisplay = document.getElementById("userUsernameDisplay");
        if (unameDisplay) unameDisplay.textContent = "";

        window.library = [];
        window.socialProfile = null;
        window.socialPrivate = null;
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
