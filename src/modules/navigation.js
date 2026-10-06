// ── ROUTING & NAVIGATION MODULE ───────────────────────────────────

export const toggleSidebar = (window.toggleSidebar = () => {
  document.getElementById("sidebar")?.classList.toggle("open");
  document.getElementById("sidebar-overlay")?.classList.toggle("visible");
});

export const closeSidebar = (window.closeSidebar = () => {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("visible");
});

export const toggleMobileMoreMenu = (window.toggleMobileMoreMenu = (e) => {
  if (e) e.stopPropagation();
  const menu = document.getElementById("mobileMoreMenu");
  const overlay = document.getElementById("mobileMoreMenuOverlay");
  if (!menu) return;
  const isOpen = menu.classList.contains("open");
  if (isOpen) {
    closeMobileMoreMenu();
  } else {
    menu.classList.add("open");
    if (overlay) overlay.classList.add("open");
  }
});

export const closeMobileMoreMenu = (window.closeMobileMoreMenu = () => {
  const menu = document.getElementById("mobileMoreMenu");
  const overlay = document.getElementById("mobileMoreMenuOverlay");
  if (menu) menu.classList.remove("open");
  if (overlay) overlay.classList.remove("open");
});

export const updateNavBadges = (window.updateNavBadges = () => {
  const lib = window.library || [];
  const nbLib = document.getElementById("nav-badge-library");
  if (nbLib) nbLib.textContent = lib.length;

  const tierCount = lib.filter((l) => l.tier && l.tier !== "").length || 0;
  const nbTier = document.getElementById("nav-badge-tierlist");
  if (nbTier) nbTier.textContent = tierCount;
  const nbTierMob = document.getElementById("nav-badge-tierlist-mobile");
  if (nbTierMob) nbTierMob.textContent = tierCount;

  const seasonalSet = new Set(lib.map((l) => l.season).filter(Boolean));
  const seasonalCount = seasonalSet.size || 0;
  const nbSea = document.getElementById("nav-badge-seasonal");
  if (nbSea) nbSea.textContent = seasonalCount;
  const nbSeaMob = document.getElementById("nav-badge-seasonal-mobile");
  if (nbSeaMob) nbSeaMob.textContent = seasonalCount;

  const sfAll = document.getElementById("sf-all");
  if (sfAll) sfAll.textContent = lib.length;

  [
    "Plan to Watch",
    "Watching",
    "Completed",
    "On Hold",
    "Dropped",
  ].forEach((status) => {
    const el = document.getElementById(
      `sf-${status === "Plan to Watch" ? "ptw" : status === "Watching" ? "watch" : status === "Completed" ? "done" : status === "On Hold" ? "hold" : "drop"}`,
    );
    if (el)
      el.textContent = lib.filter((l) => l.status === status).length || 0;
  });
});

export const navigateTo = (window.navigateTo = (page) => {
  closeMobileMoreMenu();
  document
    .querySelectorAll(".page-section")
    .forEach((el) => el.classList.remove("active"));
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) targetPage.classList.add("active");

  document
    .querySelectorAll(".nav-item, .more-menu-btn")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.page === page),
    );

  const moreBtn = document.getElementById("nav-item-more");
  if (moreBtn) {
    moreBtn.classList.toggle(
      "active",
      page === "tierlist" || page === "seasonal" || page === "admin",
    );
  }

  const topbar = document.getElementById("topbarTitle");
  if (topbar) {
    topbar.textContent = page
      .toUpperCase()
      .replace("TIERLIST", "TIER LIST");
  }

  if (page === "library") {
    if (window.renderLibrary) window.renderLibrary();
  } else if (page === "discover") {
    if (window.renderDiscover) window.renderDiscover(true);
  } else if (page === "tierlist") {
    if (window.renderTierList) window.renderTierList();
  } else if (page === "stats") {
    if (window.renderStats) window.renderStats();
  } else if (page === "seasonal") {
    if (window.renderSeasonal) window.renderSeasonal();
  } else if (page === "social") {
    if (window.isGuestMode) {
      document.getElementById("socialGuestPrompt").style.display = "flex";
      document.getElementById("socialAppContent").style.display = "none";
      document.getElementById("socialSetupPrompt").style.display = "none";
    } else if (window.socialProfile) {
      document.getElementById("socialSetupPrompt").style.display = "none";
      document.getElementById("socialGuestPrompt").style.display = "none";
      document.getElementById("socialAppContent").style.display = "block";
      if (window.renderFriendsGrid) window.renderFriendsGrid();
    } else {
      document.getElementById("socialSetupPrompt").style.display = "flex";
      document.getElementById("socialAppContent").style.display = "none";
      document.getElementById("socialGuestPrompt").style.display = "none";
    }
  }

  updateNavBadges();
});
