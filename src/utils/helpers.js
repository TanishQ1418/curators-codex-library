// ── GLOBAL UTILITY HELPERS ─────────────────────────────────────────

// XSS-Safe HTML escaping
export function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s == null ? "" : s);
  return d.innerHTML;
}
window.esc = esc;

// Toast Notifications
export function showToast(msg, type = "info") {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.classList.add("toast-dismiss");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
window.showToast = showToast;

// Consistent avatar colors based on string
export function getColorForString(str) {
  const colors = [
    "#ef4444",
    "#f97316",
    "#f59e0b",
    "#84cc16",
    "#10b981",
    "#06b6d4",
    "#3b82f6",
    "#8b5cf6",
    "#d946ef",
    "#f43f5e",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
window.getColorForString = getColorForString;

// Global Keyboard Shortcuts
export function setupGlobalKeyShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Prevent shortcuts when user is typing in inputs or textareas
    if (
      ["INPUT", "TEXTAREA"].includes(e.target.tagName) ||
      e.target.isContentEditable
    )
      return;

    // / - focus search
    if (e.key === "/") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
    }

    // n or a - Open Add modal
    if (e.key === "a" || e.key === "A" || e.key === "n" || e.key === "N") {
      e.preventDefault();
      if (window.openAddModal) window.openAddModal();
    }

    // Shift + navigation shortcuts
    if (e.key === "D" || e.key === "d") {
      if (e.shiftKey) {
        e.preventDefault();
        if (window.navigateTo) window.navigateTo("discover");
      }
    }
    if (e.key === "L" || e.key === "l") {
      if (e.shiftKey) {
        e.preventDefault();
        if (window.navigateTo) window.navigateTo("library");
      }
    }
    if (e.key === "T" || e.key === "t") {
      if (e.shiftKey) {
        e.preventDefault();
        if (window.navigateTo) window.navigateTo("tierlist");
      }
    }
    if (e.key === "S" || e.key === "s") {
      if (e.shiftKey) {
        e.preventDefault();
        if (window.navigateTo) window.navigateTo("stats");
      }
    }

    // Number navigation
    if (e.key === "1") {
      e.preventDefault();
      if (window.navigateTo) window.navigateTo("library");
    }
    if (e.key === "2") {
      e.preventDefault();
      if (window.navigateTo) window.navigateTo("tierlist");
    }
    if (e.key === "3") {
      e.preventDefault();
      if (window.navigateTo) window.navigateTo("stats");
    }
    if (e.key === "4") {
      e.preventDefault();
      if (window.navigateTo) window.navigateTo("discover");
    }
    if (e.key === "5") {
      e.preventDefault();
      if (window.navigateTo) window.navigateTo("social");
    }
  });

  // Global click to close floating dropdowns / menus
  document.addEventListener("click", (e) => {
    if (window.closeBackupMenu) window.closeBackupMenu();
    if (
      document.getElementById("searchDropdown") &&
      !e.target.closest("#searchDropdown") &&
      !e.target.closest("#field-title")
    ) {
      document.getElementById("searchDropdown").style.display = "none";
    }
    if (
      document.getElementById("socialSearchDropdown") &&
      !e.target.closest("#socialSearchDropdown") &&
      !e.target.closest("#socialSearchInput")
    ) {
      document.getElementById("socialSearchDropdown").style.display = "none";
    }
    if (
      document.getElementById("recommendSearchResults") &&
      !e.target.closest("#recommendSearchResults") &&
      !e.target.closest("#recommendSearchInput")
    ) {
      document.getElementById("recommendSearchResults").style.display = "none";
    }
  });
}
