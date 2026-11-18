// ── GLOBAL UTILITY, VALIDATION, DIALOG & ACCESSIBILITY HELPERS ──────

const ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

// Attribute-safe HTML escaping (P0-1)
export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}
window.esc = esc;

// Safe HTTPS URL normalizer/validator (P0-4)
export function safeUrl(u) {
  const raw = String(u || "").trim();
  if (!raw) return "";
  const upgraded = raw.replace(/^http:\/\//i, "https://");
  try {
    const parsed = new URL(upgraded, window.location.origin);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}
window.safeUrl = safeUrl;

// Backward-compatible episode helpers (P2-5)
export function getEpisodesWatched(entry) {
  if (!entry) return 0;
  if (entry.episodesWatched !== undefined && entry.episodesWatched !== null) {
    return Math.max(0, parseInt(entry.episodesWatched, 10) || 0);
  }
  const ep = Math.max(0, parseInt(entry.episodes, 10) || 0);
  return entry.status === "Plan to Watch" ? 0 : ep;
}

export function getEpisodesTotal(entry) {
  if (!entry) return 0;
  if (entry.episodesTotal !== undefined && entry.episodesTotal !== null) {
    return Math.max(0, parseInt(entry.episodesTotal, 10) || 0);
  }
  return Math.max(0, parseInt(entry.episodes, 10) || 0);
}

// Toast Notifications (XSS-safe textContent + optional action button for Undo)
export function showToast(msg, type = "info", options = null) {
  const c = document.getElementById("toast-container");
  if (!c) return;
  const t = document.createElement("div");
  let icon = "ℹ️";
  if (type === "success") icon = "✅";
  if (type === "error") icon = "❌";
  t.className = `toast toast-${type}`;
  t.setAttribute("role", "status");
  t.setAttribute("aria-live", "polite");

  const iconSpan = document.createElement("span");
  iconSpan.textContent = icon;
  const msgSpan = document.createElement("span");
  msgSpan.style.flex = "1";
  msgSpan.textContent = String(msg ?? "");
  t.appendChild(iconSpan);
  t.appendChild(msgSpan);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    t.classList.add("toast-dismiss");
    setTimeout(() => t.remove(), 300);
  };

  if (options?.actionLabel && typeof options?.onAction === "function") {
    const actBtn = document.createElement("button");
    actBtn.type = "button";
    actBtn.className = "btn btn-ghost btn-sm";
    actBtn.style.padding = "3px 8px";
    actBtn.style.fontSize = "11px";
    actBtn.textContent = options.actionLabel;
    actBtn.addEventListener("click", async () => {
      actBtn.disabled = true;
      await options.onAction();
      dismiss();
    });
    t.appendChild(actBtn);
  }

  c.appendChild(t);
  const duration = options?.duration || 3200;
  setTimeout(dismiss, duration);
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
  const s = String(str || "U");
  for (let i = 0; i < s.length; i++)
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
window.getColorForString = getColorForString;

// ── ACCESSIBLE MODAL / DIALOG HELPERS ─────────────────────────────
const lastFocusedMap = new Map();

export function openOverlay(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  if (!overlay.classList.contains("open")) {
    lastFocusedMap.set(id, document.activeElement);
    overlay.classList.add("open");
    const focusable = overlay.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable) {
      setTimeout(() => focusable.focus({ preventScroll: true }), 20);
    }
  }
}

export function closeOverlay(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  if (overlay.classList.contains("open")) {
    overlay.classList.remove("open");
    const prev = lastFocusedMap.get(id);
    lastFocusedMap.delete(id);
    if (prev && typeof prev.focus === "function" && document.contains(prev)) {
      prev.focus({ preventScroll: true });
    }
  }
}

// Reusable In-App Confirm / Prompt Modal (replaces confirm(), prompt(), alert())
export function showAppDialog({
  title = "Confirm",
  message = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  altText = "",
  danger = false,
  inputValue = null,
  inputPlaceholder = "",
  maxLength = 50,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("appDialogOverlay");
    const titleEl = document.getElementById("appDialogTitle");
    const msgEl = document.getElementById("appDialogMessage");
    const inputWrap = document.getElementById("appDialogInputWrap");
    const inputEl = document.getElementById("appDialogInput");
    const confirmBtn = document.getElementById("appDialogConfirmBtn");
    const altBtn = document.getElementById("appDialogAltBtn");
    const cancelBtn = document.getElementById("appDialogCancelBtn");
    const closeBtn = document.getElementById("appDialogCloseBtn");

    if (!overlay || !confirmBtn || !cancelBtn) {
      resolve(null);
      return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    const hasInput = inputValue !== null;
    if (inputWrap && inputEl) {
      inputWrap.style.display = hasInput ? "block" : "none";
      inputEl.value = hasInput ? String(inputValue) : "";
      inputEl.placeholder = inputPlaceholder || "";
      inputEl.maxLength = maxLength || 50;
    }

    confirmBtn.textContent = confirmText;
    confirmBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
    cancelBtn.textContent = cancelText;

    if (altBtn) {
      if (altText) {
        altBtn.style.display = "inline-flex";
        altBtn.textContent = altText;
      } else {
        altBtn.style.display = "none";
      }
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      closeOverlay("appDialogOverlay");
      resolve(result);
    };

    const onConfirm = () => {
      finish(hasInput ? (inputEl?.value ?? "") : true);
    };
    const onAlt = () => finish("alt");
    const onCancel = () => finish(hasInput ? null : false);
    const onOverlayClick = (e) => {
      if (e.target === overlay) onCancel();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter" && hasInput && document.activeElement === inputEl) {
        e.preventDefault();
        onConfirm();
      }
    };

    function cleanup() {
      confirmBtn.removeEventListener("click", onConfirm);
      altBtn?.removeEventListener("click", onAlt);
      cancelBtn.removeEventListener("click", onCancel);
      closeBtn?.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      overlay.removeEventListener("keydown", onKey);
    }

    confirmBtn.addEventListener("click", onConfirm);
    altBtn?.addEventListener("click", onAlt);
    cancelBtn.addEventListener("click", onCancel);
    closeBtn?.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    overlay.addEventListener("keydown", onKey);

    openOverlay("appDialogOverlay");
    if (hasInput && inputEl) {
      setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 30);
    }
  });
}

// ── GLOBAL DELEGATED ACTIONS (P0-2: Zero inline JS interpolation) ─
const actionRegistry = new Map();

export function registerActions(map) {
  Object.entries(map).forEach(([name, fn]) => {
    actionRegistry.set(name, fn);
  });
}

function getTopmostOpenOverlay() {
  const overlays = Array.from(document.querySelectorAll(".modal-overlay.open"));
  if (!overlays.length) return null;
  overlays.sort((a, b) => {
    const za = parseInt(getComputedStyle(a).zIndex || "1000", 10) || 1000;
    const zb = parseInt(getComputedStyle(b).zIndex || "1000", 10) || 1000;
    return zb - za;
  });
  return overlays[0];
}

function closeModalByOverlayId(id) {
  if (id === "notificationsDrawerOverlay") {
    window.toggleNotificationsDrawer?.();
  } else if (id === "entryModalOverlay") {
    window.closeEntryModal?.();
  } else if (id === "detailModalOverlay") {
    window.closeDetailModal?.();
  } else if (id === "friendLibraryOverlay") {
    window.closeFriendLibrary?.();
  } else if (id === "recommendationsOverlay") {
    window.closeRecommendationsViewer?.();
  } else if (id === "recommendModalOverlay") {
    window.closeRecommendModal?.();
  } else if (id === "socialSettingsOverlay") {
    window.closeSocialSettings?.();
  } else if (id === "surpriseModalOverlay") {
    window.closeSurpriseModal?.();
  } else {
    closeOverlay(id);
  }
}

export function setupGlobalKeyShortcuts() {
  // Capturing image fallback handler (CSP-safe: zero inline onerror="")
  document.addEventListener(
    "error",
    (e) => {
      const img = e.target;
      if (!img || img.tagName !== "IMG") return;
      const mode = img.dataset.fallback;
      if (mode === "hide") {
        img.style.display = "none";
      } else if (mode === "poster-detail") {
        const div = document.createElement("div");
        div.className = "detail-poster-thumb-placeholder";
        div.textContent = "🎬";
        img.replaceWith(div);
      } else if (mode === "emoji") {
        const span = document.createElement("span");
        span.setAttribute("aria-hidden", "true");
        span.textContent = "🎬";
        img.replaceWith(span);
      }
    },
    true,
  );

  // Delegated click handler for all [data-act] elements
  document.addEventListener("click", (e) => {
    const actEl = e.target.closest("[data-act]");
    if (actEl) {
      const act = actEl.dataset.act;
      if (actEl.dataset.stop === "1") {
        e.stopPropagation();
      }
      const handler = actionRegistry.get(act);
      if (handler) {
        handler(actEl.dataset, actEl, e);
      }
    }

    // Close floating menus when clicking outside
    if (!e.target.closest("#backupMenu") && !e.target.closest('[data-act="toggleBackupMenu"]')) {
      window.closeBackupMenu?.();
    }
    const sdd = document.getElementById("searchDropdown");
    if (sdd && !e.target.closest("#searchDropdown") && !e.target.closest("#field-title")) {
      sdd.style.display = "none";
    }
    const socialDd = document.getElementById("socialSearchDropdown");
    if (
      socialDd &&
      !e.target.closest("#socialSearchDropdown") &&
      !e.target.closest("#socialSearchInput")
    ) {
      socialDd.style.display = "none";
    }
    const recRes = document.getElementById("recommendSearchResults");
    if (
      recRes &&
      !e.target.closest("#recommendSearchResults") &&
      !e.target.closest("#recommendSearchInput")
    ) {
      recRes.style.display = "none";
    }
  });

  // Delegated focus trap + keyboard shortcuts (P2-7 & P4-5)
  document.addEventListener("keydown", (e) => {
    // Focus trap inside topmost open modal
    const topModal = getTopmostOpenOverlay();
    if (topModal && e.key === "Tab") {
      const focusables = Array.from(
        topModal.querySelectorAll(
          'button:not([disabled]), [href], input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
          return;
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
          return;
        }
      }
    }

    // Escape closes topmost dropdown, drawer, or modal
    if (e.key === "Escape") {
      const searchDd = document.getElementById("searchDropdown");
      if (searchDd && searchDd.style.display !== "none") {
        searchDd.style.display = "none";
        return;
      }
      const socialDd = document.getElementById("socialSearchDropdown");
      if (socialDd && socialDd.style.display !== "none") {
        socialDd.style.display = "none";
        return;
      }
      const backupMenu = document.getElementById("backupMenu");
      if (backupMenu && backupMenu.style.display === "block") {
        window.closeBackupMenu?.();
        return;
      }
      const moreMenu = document.getElementById("mobileMoreMenu");
      if (moreMenu && moreMenu.classList.contains("open")) {
        window.closeMobileMoreMenu?.();
        return;
      }
      if (topModal) {
        e.preventDefault();
        closeModalByOverlayId(topModal.id);
        return;
      }
    }

    // Do not hijack browser/system shortcuts (P2-7)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Ignore when typing/interacting in form controls
    const tag = e.target?.tagName;
    if (
      ["INPUT", "TEXTAREA", "SELECT"].includes(tag) ||
      e.target?.isContentEditable ||
      e.target?.closest?.("[contenteditable='true']")
    ) {
      return;
    }

    // Ignore when any modal or login overlay is open
    if (topModal) return;
    const loginOv = document.getElementById("loginOverlay");
    if (loginOv && getComputedStyle(loginOv).display !== "none") return;

    // For BUTTON elements, let Space/Enter behave naturally
    if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;

    if (e.key === "/") {
      e.preventDefault();
      document.getElementById("searchInput")?.focus();
      return;
    }

    if (e.key === "?") {
      e.preventDefault();
      openOverlay("shortcutsModalOverlay");
      return;
    }

    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      window.openAddModal?.();
      return;
    }

    if (e.key === "1") {
      e.preventDefault();
      window.navigateTo?.("library");
    } else if (e.key === "2") {
      e.preventDefault();
      window.navigateTo?.("tierlist");
    } else if (e.key === "3") {
      e.preventDefault();
      window.navigateTo?.("stats");
    } else if (e.key === "4") {
      e.preventDefault();
      window.navigateTo?.("discover");
    } else if (e.key === "5") {
      e.preventDefault();
      window.navigateTo?.("social");
    }
  });
}
