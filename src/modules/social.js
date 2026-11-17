// ── SOCIAL & COMMUNITY MODULE ─────────────────────────────────────

import {
  auth,
  db,
  doc,
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  updateDoc,
  onSnapshot,
  handleFirestoreError,
} from "../config/firebase.js";
import { esc, showToast, getColorForString } from "../utils/helpers.js";

window.socialProfile = null;
window.socialFriends = [];
window.socialNotifications = [];
window.currentPendingTab = "received";
window.currentFriendViewUid = null;
window.currentFriendProfile = null;
window.currentFriendLibrary = [];
window._currentFriendView = "grid";
window._currentFriendFiltered = [];

const inFlightFriendOps = new Set();
let profileSearchCache = { ts: 0, items: [] };

function escJs(str) {
  return String(str == null ? "" : str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, "")
    .replace(/\n/g, " ");
}

function isValidFirestoreId(id) {
  return (
    typeof id === "string" &&
    id.length >= 1 &&
    id.length <= 128 &&
    /^[a-zA-Z0-9_.\-]+$/.test(id)
  );
}

function getMyUsernameFallback() {
  const raw =
    window.socialProfile?.username ||
    auth.currentUser?.displayName ||
    auth.currentUser?.email?.split("@")[0] ||
    "User";
  return String(raw).trim().slice(0, 100) || "User";
}

function isEntryInMyLibrary(entry) {
  if (!entry) return false;
  const lib = window.library || [];
  const titleKey = (entry.title || "").trim().toLowerCase();
  const typeKey = (entry.type || "").trim().toLowerCase();
  return lib.some((l) => {
    if (entry.stremioId && l.stremioId && entry.stremioId === l.stremioId)
      return true;
    if (entry.malId && l.malId && String(entry.malId) === String(l.malId))
      return true;
    if (entry.kitsuId && l.kitsuId && String(entry.kitsuId) === String(l.kitsuId))
      return true;
    if (entry.jikanId && l.jikanId && String(entry.jikanId) === String(l.jikanId))
      return true;
    return (
      titleKey &&
      (l.title || "").trim().toLowerCase() === titleKey &&
      (!typeKey || (l.type || "").trim().toLowerCase() === typeKey)
    );
  });
}

function safeSyncError(err, op, path) {
  try {
    handleFirestoreError(err, op, path);
  } catch (e) {
    // Error is already logged & toasted by handleFirestoreError
  }
}

export const openSocialSettings = (window.openSocialSettings = () => {
  if (!auth.currentUser) {
    return showToast("Please sign in to access Social Settings", "error");
  }
  if (!window.socialProfile) {
    return showToast("Please claim a username first", "info");
  }
  document.getElementById("socialSettingsDisplayName").value =
    window.socialProfile.displayUsername || "";
  document.getElementById("socialSettingsUid").value =
    window.socialProfile.friendCode || auth.currentUser?.uid || "";
  document.getElementById("socialSettingsVisibility").value =
    window.socialProfile.libraryPublic || "public";
  document.getElementById("socialSettingsSearch").checked =
    window.socialProfile.showInSearch !== false;
  document.getElementById("socialSettingsRequests").checked =
    window.socialProfile.allowRequests !== false;
  document.getElementById("socialSettingsOverlay")?.classList.add("open");
});

export const closeSocialSettings = (window.closeSocialSettings = () => {
  document.getElementById("socialSettingsOverlay")?.classList.remove("open");
});

export const saveSocialSettingsDisplayName =
  (window.saveSocialSettingsDisplayName = async () => {
    if (!auth.currentUser) return showToast("Please sign in first", "error");
    const val = document
      .getElementById("socialSettingsDisplayName")
      ?.value.trim();
    if (!val || val.length < 3) return showToast("Name too short (min 3 chars)", "error");
    if (val.length > 50) return showToast("Name too long (max 50 chars)", "error");
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { displayUsername: val },
      );
      profileSearchCache.ts = 0;
      showToast("Display name saved!", "success");
    } catch (e) {
      safeSyncError(e, "update", "profile");
    }
  });

export const saveSocialSettingsVisibility =
  (window.saveSocialSettingsVisibility = async (val) => {
    if (!auth.currentUser) return;
    if (!["public", "friends", "private"].includes(val)) return;
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { libraryPublic: val },
      );
      showToast("Visibility updated", "success");
    } catch (e) {
      safeSyncError(e, "update", "profile");
    }
  });

export const saveSocialSettingsToggle = (window.saveSocialSettingsToggle =
  async (field, val) => {
    if (!auth.currentUser) return;
    if (!["showInSearch", "allowRequests"].includes(field)) return;
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { [field]: Boolean(val) },
      );
      profileSearchCache.ts = 0;
      showToast("Preference saved", "success");
    } catch (e) {
      safeSyncError(e, "update", "profile");
    }
  });

export const toggleNotificationsDrawer =
  (window.toggleNotificationsDrawer = () => {
    const d = document.getElementById("notificationsDrawerOverlay");
    const drawer = document.getElementById("notificationsDrawer");
    if (!d || !drawer) return;
    if (d.classList.contains("open")) {
      drawer.style.transform = "translateX(100%)";
      setTimeout(() => d.classList.remove("open"), 300);
    } else {
      d.classList.add("open");
      setTimeout(() => (drawer.style.transform = "translateX(0)"), 10);

      const unread = (window.socialNotifications || []).filter((n) => !n.read);
      if (unread.length > 0 && auth.currentUser) {
        const batch = writeBatch(db);
        unread.forEach((n) =>
          batch.update(
            doc(db, "users", auth.currentUser.uid, "notifications", n.id),
            { read: true },
          ),
        );
        batch.commit().catch((e) => console.error(e));
      }
    }
  });

export const clearAllNotifications = (window.clearAllNotifications =
  async () => {
    if (!auth.currentUser) return;
    if (!(window.socialNotifications || []).length) return;
    if (!confirm("Clear all notifications?")) return;
    try {
      const notifs = window.socialNotifications || [];
      for (let i = 0; i < notifs.length; i += 400) {
        const batch = writeBatch(db);
        notifs.slice(i, i + 400).forEach((n) =>
          batch.delete(
            doc(db, "users", auth.currentUser.uid, "notifications", n.id),
          ),
        );
        await batch.commit();
      }
      showToast("Notifications cleared", "success");
    } catch (e) {
      safeSyncError(e, "delete", "notifications");
    }
  });

export const deleteNotification = (window.deleteNotification = async (id) => {
  if (!auth.currentUser || !isValidFirestoreId(id)) return;
  try {
    await deleteDoc(
      doc(db, "users", auth.currentUser.uid, "notifications", id),
    );
  } catch (e) {
    safeSyncError(e, "delete", "notifications");
  }
});

export const acceptFriend = (window.acceptFriend = async (
  friendUid,
  _friendUsername,
) => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  const myUid = auth.currentUser.uid;
  if (!isValidFirestoreId(friendUid) || friendUid === myUid) return;
  if (inFlightFriendOps.has(friendUid)) return;
  inFlightFriendOps.add(friendUid);

  try {
    const myRef = doc(db, "users", myUid, "friends", friendUid);
    const senderRef = doc(db, "users", friendUid, "friends", myUid);
    const [mySnap, senderSnap] = await Promise.all([
      getDoc(myRef),
      getDoc(senderRef),
    ]);

    if (!mySnap.exists()) {
      showToast("Friend request no longer exists", "info");
      return;
    }
    const myStatus = mySnap.data().status;
    if (myStatus === "accepted") {
      showToast("You are already friends!", "info");
      return;
    }
    if (myStatus !== "pending_received") {
      showToast("Cannot accept an outgoing request", "error");
      return;
    }

    const now = Date.now();
    // If sender doc is in an unexpected non-pending_sent/non-accepted state, delete it first
    // so our recovery create rule (`!exists` + pending_received on self) succeeds cleanly.
    if (
      senderSnap.exists() &&
      senderSnap.data().status !== "pending_sent" &&
      senderSnap.data().status !== "accepted"
    ) {
      await deleteDoc(senderRef);
    }

    const batch = writeBatch(db);
    if (!senderSnap.exists()) {
      batch.set(senderRef, { status: "accepted", since: now });
    } else if (senderSnap.data().status === "pending_sent") {
      batch.update(senderRef, { status: "accepted", since: now });
    } else if (senderSnap.data().status !== "accepted") {
      batch.set(senderRef, { status: "accepted", since: now });
    }
    batch.update(myRef, { status: "accepted", since: now });

    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "request_accepted",
      fromUid: myUid,
      fromUsername: getMyUsernameFallback(),
      sentAt: now,
      read: false,
    });
    await batch.commit();
    showToast("Friend accepted!", "success");
    refreshSearchDropdownIfOpen();
  } catch (e) {
    safeSyncError(e, "update", "friends");
  } finally {
    inFlightFriendOps.delete(friendUid);
  }
});

export const declineFriend = (window.declineFriend = async (friendUid) => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  const myUid = auth.currentUser.uid;
  if (!isValidFirestoreId(friendUid) || friendUid === myUid) return;
  if (inFlightFriendOps.has(friendUid)) return;
  inFlightFriendOps.add(friendUid);

  const existing = (window.socialFriends || []).find((f) => f.id === friendUid);
  const wasSent = existing?.status === "pending_sent";

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", myUid, "friends", friendUid));
    batch.delete(doc(db, "users", friendUid, "friends", myUid));
    await batch.commit();
    showToast(wasSent ? "Request cancelled" : "Request declined", "info");
    refreshSearchDropdownIfOpen();
  } catch (e) {
    safeSyncError(e, "delete", "friends");
  } finally {
    inFlightFriendOps.delete(friendUid);
  }
});

export const removeFriend = (window.removeFriend = async (
  friendUid,
  friendUsername,
) => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  const myUid = auth.currentUser.uid;
  if (!isValidFirestoreId(friendUid) || friendUid === myUid) return;
  if (!confirm(`Remove ${friendUsername || "this friend"} from your friends?`))
    return;
  if (inFlightFriendOps.has(friendUid)) return;
  inFlightFriendOps.add(friendUid);

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", myUid, "friends", friendUid));
    batch.delete(doc(db, "users", friendUid, "friends", myUid));
    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "unfriended",
      fromUid: myUid,
      fromUsername: getMyUsernameFallback(),
      sentAt: Date.now(),
      read: false,
    });
    await batch.commit();
    if (window.currentFriendViewUid === friendUid) {
      closeFriendLibrary();
    }
    showToast("Friend removed", "success");
    refreshSearchDropdownIfOpen();
  } catch (e) {
    safeSyncError(e, "delete", "friends");
  } finally {
    inFlightFriendOps.delete(friendUid);
  }
});

export const toggleFavoriteFriend = (window.toggleFavoriteFriend = async (
  friendUid,
  current,
) => {
  if (!auth.currentUser || !isValidFirestoreId(friendUid)) return;
  const friend = (window.socialFriends || []).find((f) => f.id === friendUid);
  if (friend && friend.status !== "accepted") return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "friends", friendUid), {
      isFavorite: !current,
    });
  } catch (e) {
    safeSyncError(e, "update", "friends");
  }
});

export const setFriendNickname = (window.setFriendNickname = async (
  friendUid,
) => {
  if (!auth.currentUser || !isValidFirestoreId(friendUid)) return;
  const friend = (window.socialFriends || []).find((f) => f.id === friendUid);
  if (friend && friend.status !== "accepted") return;
  const newName = prompt(
    "Set nickname (leave empty to clear)",
    friend?.nickname || "",
  );
  if (newName === null) return;
  const cleaned = newName.trim().slice(0, 50);
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "friends", friendUid), {
      nickname: cleaned,
    });
    showToast(cleaned ? "Nickname updated" : "Nickname cleared", "success");
  } catch (e) {
    safeSyncError(e, "update", "friends");
  }
});

export const switchPendingTab = (window.switchPendingTab = (tab) => {
  window.currentPendingTab = tab === "sent" ? "sent" : "received";
  document
    .getElementById("tabReceivedRequests")
    ?.classList.toggle("active", window.currentPendingTab === "received");
  document
    .getElementById("tabSentRequests")
    ?.classList.toggle("active", window.currentPendingTab === "sent");
  renderPendingRequests();
});

export const renderPendingRequests = () => {
  const container = document.getElementById("pendingRequestsContainer");
  const section = document.getElementById("pendingRequestsSection");
  if (!container || !section || !window.socialFriends) return;

  const received = window.socialFriends.filter(
    (f) => f.status === "pending_received",
  );
  const sent = window.socialFriends.filter((f) => f.status === "pending_sent");

  const recCountEl = document.getElementById("tabReceivedCount");
  if (recCountEl) recCountEl.textContent = `(${received.length})`;
  const sentCountEl = document.getElementById("tabSentCount");
  if (sentCountEl) sentCountEl.textContent = `(${sent.length})`;

  const badgeEl = document.getElementById("nav-badge-social");
  if (badgeEl) {
    badgeEl.textContent = received.length;
    badgeEl.style.display = received.length > 0 ? "inline-block" : "none";
  }

  if (received.length === 0 && sent.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }
  section.style.display = "block";

  if (
    window.currentPendingTab === "received" &&
    received.length === 0 &&
    sent.length > 0
  ) {
    window.currentPendingTab = "sent";
  } else if (
    window.currentPendingTab === "sent" &&
    sent.length === 0 &&
    received.length > 0
  ) {
    window.currentPendingTab = "received";
  }

  document
    .getElementById("tabReceivedRequests")
    ?.classList.toggle("active", window.currentPendingTab === "received");
  document
    .getElementById("tabSentRequests")
    ?.classList.toggle("active", window.currentPendingTab === "sent");

  const items = window.currentPendingTab === "received" ? received : sent;
  if (items.length === 0) {
    container.innerHTML = `<div style="padding: 14px; color: var(--text-muted); font-size: 13px;">No ${window.currentPendingTab} requests.</div>`;
    return;
  }

  container.innerHTML = items
    .map((f) => {
      const display = f.displayUsername || f.username || f.id;
      const handle = f.username ? `@${f.username}` : "";
      const hue = getColorForString(f.username || f.id);
      const initial = esc((display || "U")[0].toUpperCase());
      const jsId = escJs(f.id);
      const jsName = escJs(f.username || display);
      const dateStr = f.since ? new Date(f.since).toLocaleDateString() : "";
      return `
          <div class="notification-card" style="display:flex; align-items:center; gap:12px;">
              <div class="friend-avatar" style="background:${hue}; width:40px; height:40px; font-size:16px; margin:0;">${initial}</div>
              <div style="flex:1; min-width:0;">
                  <div style="font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(display)}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${handle ? esc(handle) + (dateStr ? " · " : "") : ""}${esc(dateStr)}</div>
              </div>
              ${
                window.currentPendingTab === "received"
                  ? `
                  <button class="btn btn-primary btn-sm" onclick="window.acceptFriend('${jsId}', '${jsName}')">✓ Accept</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${jsId}')" title="Decline">✕</button>
              `
                  : `
                  <button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${jsId}')">Cancel</button>
              `
              }
          </div>
      `;
    })
    .join("");
};
window.renderPendingRequests = renderPendingRequests;

export const renderFriendsGrid = () => {
  const grid = document.getElementById("friendsGrid");
  const empty = document.getElementById("friendsEmpty");
  if (!grid || !empty || !window.socialFriends) return;

  const q = (
    document.getElementById("localFriendSearch")?.value || ""
  )
    .trim()
    .toLowerCase();

  let accepted = window.socialFriends.filter((f) => f.status === "accepted");

  if (q) {
    accepted = accepted.filter(
      (f) =>
        (f.nickname || "").toLowerCase().includes(q) ||
        (f.displayUsername || "").toLowerCase().includes(q) ||
        (f.username || "").toLowerCase().includes(q) ||
        (f.email || "").toLowerCase().includes(q),
    );
  }

  accepted.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.nickname || a.displayUsername || a.username || "").localeCompare(
      b.nickname || b.displayUsername || b.username || "",
    );
  });

  if (accepted.length === 0) {
    grid.style.display = "none";
    empty.style.display = "flex";
    if (q) {
      empty.innerHTML =
        '<div class="empty-icon">🤝</div><h3>No friends found matching search.</h3>';
    } else {
      empty.innerHTML =
        '<div class="empty-icon">🤝</div><h3>Your codex is empty of companions</h3><p>Search for a username above to begin.</p>';
    }
    return;
  }
  grid.style.display = "grid";
  empty.style.display = "none";

  grid.innerHTML = accepted
    .map((f) => {
      const hue = getColorForString(f.username || f.id);
      const primary = f.nickname || f.displayUsername || f.username || "Unknown";
      const subDisplay = f.username ? `@${f.username}` : "Friend";
      const jsId = escJs(f.id);
      const jsUsername = escJs(f.username || primary);
      const jsPrimary = escJs(primary);
      return `
          <div class="friend-card ${f.isFavorite ? "favorite" : ""}" onclick="window.viewFriendLibrary('${jsId}', '${jsPrimary}')" style="cursor:pointer;">
              <div class="friend-card-top">
                  <button class="icon-btn favorite-btn ${f.isFavorite ? "active" : ""}" title="${f.isFavorite ? "Unfavorite" : "Favorite"}" onclick="event.stopPropagation(); window.toggleFavoriteFriend('${jsId}', ${!!f.isFavorite})">
                      ${f.isFavorite ? "⭐" : "☆"}
                  </button>
                  <button class="icon-btn remove-btn" title="Remove Friend" onclick="event.stopPropagation(); window.removeFriend('${jsId}', '${jsUsername}')">×</button>
              </div>
              <div class="friend-avatar" style="background:${hue}">${esc((primary || "U")[0].toUpperCase())}</div>
              <div style="font-weight:700; font-size:16px; margin-bottom:2px; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(primary)}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-bottom: 8px;">${esc(subDisplay)}</div>
              
              <div class="friend-actions">
                  <button class="btn btn-primary btn-sm" style="width:100%; justify-content:center" onclick="event.stopPropagation(); window.viewFriendLibrary('${jsId}', '${jsPrimary}')">📚 View Codex</button>
                  <div class="friend-action-row">
                      <button class="btn btn-ghost btn-sm btn-icon" title="Recommend" onclick="event.stopPropagation(); window.openRecommendModal(null, '${jsId}')">🎁</button>
                      <button class="btn btn-ghost btn-sm btn-icon" title="Set Nickname" onclick="event.stopPropagation(); window.setFriendNickname('${jsId}')">✏️</button>
                  </div>
              </div>
          </div>
      `;
    })
    .join("");
};
window.renderFriendsGrid = renderFriendsGrid;

export const openDetailModalForRec = (window.openDetailModalForRec = (
  notifId,
) => {
  const n = (window.socialNotifications || []).find((x) => x.id === notifId);
  if (!n) return;
  const mockEntry = {
    title: n.itemTitle || "",
    poster: n.itemPoster || "",
    type: n.itemType || "Anime",
    tier: n.itemTier || "",
    genres: n.itemGenres || [],
    stremioId: n.itemStremioId,
    jikanId: n.itemJikanId,
    malId: n.itemMalId,
    kitsuId: n.itemKitsuId,
    link: n.itemLink || "",
    status: "Recommended",
    notes: n.senderNote
      ? `Rec from ${n.fromUsername}: "${n.senderNote}"`
      : `Rec from ${n.fromUsername}`,
    isRec: true,
    notifId: n.id,
  };
  if (window.openDetailModal) window.openDetailModal(mockEntry);
});

export const openRecommendationsViewer =
  (window.openRecommendationsViewer = () => {
    document.getElementById("recommendationsOverlay")?.classList.add("open");
    renderRecommendationsViewer();
  });

export const closeRecommendationsViewer =
  (window.closeRecommendationsViewer = () => {
    document
      .getElementById("recommendationsOverlay")
      ?.classList.remove("open");
  });

export const renderRecommendationsViewer =
  (window.renderRecommendationsViewer = () => {
    const container = document.getElementById("recommendationsContainerGrid");
    if (!container) return;
    const recommendations = (window.socialNotifications || []).filter(
      (n) => n.type === "recommendation",
    );

    if (recommendations.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><h3>No recommendations yet</h3><p>Recommendations from friends will appear here.</p></div>`;
      return;
    }

    container.innerHTML = recommendations
      .map((n) => {
        const hasLib = isEntryInMyLibrary({
          title: n.itemTitle,
          type: n.itemType,
          stremioId: n.itemStremioId,
          malId: n.itemMalId,
          jikanId: n.itemJikanId,
          kitsuId: n.itemKitsuId,
        });
        const jsId = escJs(n.id);
        return `
    <div class="entry-card" onclick="window.openDetailModalForRec('${jsId}')">
      <div class="not-interested-btn" onclick="event.stopPropagation(); window.deleteNotification('${jsId}')" title="Remove Recommendation">✕</div>
      <div class="card-poster"><img src="${esc(n.itemPoster || "")}" referrerpolicy="no-referrer" onerror="this.outerHTML='🎬'" /></div>
      <div class="card-info">
        <div class="card-title">${esc(n.itemTitle)}</div>
        <div class="card-meta">
          <span class="badge badge-type">${esc(n.itemType)}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Rec by ${esc(n.fromUsername)}</div>
        ${n.itemTier ? `<div style="margin-top:8px"><span class="badge tier-${esc(n.itemTier)}">${esc(n.itemTier)} TIER</span></div>` : ""}
        ${n.senderNote ? `<div style="font-size: 11px; color: var(--text-muted); font-style: italic; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 8px;">"${esc(n.senderNote)}"</div>` : ""}
        <div style="margin-top: auto;">
          ${
            hasLib
              ? `<div style="color:var(--success); font-size:11px; font-weight:700; text-align:center;">✓ In Codex</div>`
              : `<button class="btn btn-primary btn-sm btn-full" onclick="event.stopPropagation(); window.addRecToLibrary('${jsId}')">+ Add to Codex</button>`
          }
        </div>
      </div>
    </div>
        `;
      })
      .join("");
  });

export const renderFriendRecommendations =
  (window.renderFriendRecommendations = () => {
    const btn = document.getElementById("btnViewRecommendations");
    if (!window.socialNotifications) return;

    const recommendations = window.socialNotifications.filter(
      (n) => n.type === "recommendation",
    );
    if (recommendations.length === 0) {
      if (btn) btn.style.display = "none";
    } else {
      if (btn) btn.style.display = "flex";
    }
    if (
      document
        .getElementById("recommendationsOverlay")
        ?.classList.contains("open")
    ) {
      renderRecommendationsViewer();
    }
  });

export const renderNotificationsDrawer = () => {
  renderFriendRecommendations();
  const list = document.getElementById("notificationsList");
  if (!list) return;
  const notifs = [...(window.socialNotifications || [])];
  notifs.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));

  const unreadCount = notifs.filter((n) => !n.read).length;
  const badge = document.getElementById("nav-badge-notif");
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? "inline-block" : "none";
  }

  if (notifs.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:14px;">No notifications.</div>`;
    return;
  }

  list.innerHTML = notifs
    .map((n) => {
      let content = "";
      const cDate = n.sentAt ? new Date(n.sentAt).toLocaleDateString() : "";
      const safeUser = esc(n.fromUsername || "User");
      const hue = getColorForString(n.fromUsername || "U");
      const isRec = n.type === "recommendation";
      const jsId = escJs(n.id);

      if (n.type === "friend_request")
        content = `<b>${safeUser}</b> sent you a friend request.`;
      else if (n.type === "request_accepted")
        content = `<b>${safeUser}</b> accepted your friend request.`;
      else if (n.type === "unfriended")
        content = `<b>${safeUser}</b> unfriended you.`;
      else if (n.type === "recommendation")
        content = `<b>${safeUser}</b> recommended a title!`;

      let recBlock = "";
      if (isRec) {
        const hasLib = isEntryInMyLibrary({
          title: n.itemTitle,
          type: n.itemType,
          stremioId: n.itemStremioId,
          malId: n.itemMalId,
          jikanId: n.itemJikanId,
          kitsuId: n.itemKitsuId,
        });
        recBlock = `
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-top:10px; display:flex; gap:12px; align-items:center;">
                ${n.itemPoster ? `<img src="${esc(n.itemPoster)}" referrerpolicy="no-referrer" style="width:40px; border-radius:4px;" onerror="this.style.display='none'" />` : ""}
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:14px;">${esc(n.itemTitle)}</div>
                    ${n.itemTier ? `<div style="font-size:11px; color:var(--accent);">Rated: ${esc(n.itemTier)} Tier</div>` : ""}
                    ${n.senderNote ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">"${esc(n.senderNote)}"</div>` : ""}
                </div>
            </div>
            <div style="margin-top:10px;">
                ${
                  hasLib
                    ? `<div style="color:var(--success); font-size:12px; font-weight:700;">✓ Already in Library</div>`
                    : `<button class="btn btn-primary btn-sm" onclick="window.addRecToLibrary('${jsId}')">+ Add to Codex</button>`
                }
            </div>
        `;
      }

      return `
          <div class="notification-card ${n.read ? "" : "unread"}">
              <div style="position:absolute; top:10px; right:10px;">
                  <button class="btn-ghost" style="padding:2px 6px; font-size:10px;" onclick="window.deleteNotification('${jsId}')">✕</button>
              </div>
              <div style="display:flex; gap:10px; align-items:flex-start;">
                  <div class="friend-avatar" style="background:${hue}; width:30px; height:30px; font-size:14px; margin:0; flex-shrink:0;">${esc((n.fromUsername || "U")[0].toUpperCase())}</div>
                  <div style="flex:1; font-size:13px; line-height:1.4;">
                      ${content}
                      <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${esc(cDate)}</div>
                      ${recBlock}
                  </div>
              </div>
          </div>
      `;
    })
    .join("");
};

export const addRecToLibrary = (window.addRecToLibrary = (notifId) => {
  const n = (window.socialNotifications || []).find((x) => x.id === notifId);
  if (!n) return;
  if (window.openAddModal) window.openAddModal();
  document.getElementById("field-title").value = n.itemTitle || "";
  document.getElementById("field-type").value = n.itemType || "Anime";
  document.getElementById("field-poster").value = n.itemPoster || "";
  document.getElementById("field-link").value = n.itemLink || "";
  if (n.itemStremioId) window._draftStremioId = n.itemStremioId;
  if (n.itemJikanId) window._draftJikanId = n.itemJikanId;
  if (n.itemMalId) window._draftMalId = n.itemMalId;
  if (n.itemKitsuId) window._draftKitsuId = n.itemKitsuId;
  document.getElementById("field-notes").value =
    `Recommended by ${n.fromUsername || "Friend"}${n.senderNote ? ': "' + n.senderNote + '"' : ""}`;

  if (
    n.itemGenres &&
    n.itemGenres.length > 0 &&
    window.setCurrentDraftGenres
  ) {
    window.setCurrentDraftGenres([...n.itemGenres]);
  }
  const dd = document.getElementById("notificationsDrawerOverlay");
  if (dd?.classList.contains("open")) toggleNotificationsDrawer();
});

export const addFriendLibToCodex = (window.addFriendLibToCodex = (
  entryId,
) => {
  const n = (window.currentFriendLibrary || []).find(
    (x) => String(x.id) === String(entryId),
  );
  if (!n) return;
  if (window.openAddModal) window.openAddModal();
  document.getElementById("field-title").value = n.title || "";
  document.getElementById("field-type").value = n.type || "Anime";
  document.getElementById("field-poster").value = n.poster || "";
  document.getElementById("field-link").value = n.link || "";
  document.getElementById("field-season").value = n.season || "";
  document.getElementById("field-episodes").value = n.episodes || "";
  document.getElementById("field-year").value = n.year || "";
  document.getElementById("field-seasonCount").value = n.seasonCount || "0";
  const scLabel = document.getElementById("seasonCountLabel");
  if (scLabel) scLabel.textContent = n.seasonCount || "0";
  if (n.stremioId) window._draftStremioId = n.stremioId;
  if (n.jikanId) window._draftJikanId = n.jikanId;
  if (n.malId) window._draftMalId = n.malId;
  if (n.kitsuId) window._draftKitsuId = n.kitsuId;
  const friendName =
    window.currentFriendProfile?.displayUsername ||
    window.currentFriendProfile?.username ||
    "friend";
  document.getElementById("field-notes").value = `Found in ${friendName}'s codex`;

  const statusEl = document.getElementById("autofillStatus");
  if (statusEl) {
    statusEl.textContent = `✓ Pre-filled from ${friendName}'s codex`;
    statusEl.style.color = "var(--success)";
  }

  if (n.genres && n.genres.length > 0 && window.setCurrentDraftGenres) {
    window.setCurrentDraftGenres([...n.genres]);
  }
});

// ── FRIEND PROFILE & CODEX VIEWER ─────────────────────────────────

function resetFriendViewerState() {
  const searchEl = document.getElementById("friendSearchInput");
  if (searchEl) searchEl.value = "";
  const clearBtn = document.getElementById("friendClearSearchBtn");
  if (clearBtn) clearBtn.style.display = "none";

  ["friendFilterType", "friendFilterTier", "friendFilterGenre", "friendFilterOverlap", "friendFilterStatus"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    },
  );
  const sortEl = document.getElementById("friendSortBy");
  if (sortEl) sortEl.value = "titleAZ";

  document
    .querySelectorAll("#friendStatusPills .friend-status-pill")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.status === ""));

  const drawer = document.getElementById("friendFiltersDrawer");
  if (drawer) drawer.style.display = "none";
  const toggleBtn = document.getElementById("friendToggleFiltersBtn");
  if (toggleBtn) toggleBtn.classList.remove("active");

  updateFriendFilterBadge();
  setFriendView(window._currentFriendView || "grid");
}

function updateFriendStatsAndPills(libs) {
  const counts = {
    all: libs.length,
    "Plan to Watch": 0,
    Watching: 0,
    Completed: 0,
    "On Hold": 0,
    Dropped: 0,
  };
  const genreCounts = {};
  let sharedCount = 0;

  libs.forEach((item) => {
    if (item.status && counts[item.status] !== undefined) {
      counts[item.status]++;
    }
    if (isEntryInMyLibrary(item)) {
      sharedCount++;
    }
    if (Array.isArray(item.genres)) {
      item.genres.forEach((g) => {
        if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
    }
  });

  const topGenreEntry = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])[0];

  const pillMap = {
    "ff-all": counts.all,
    "ff-ptw": counts["Plan to Watch"],
    "ff-watch": counts.Watching,
    "ff-done": counts.Completed,
    "ff-hold": counts["On Hold"],
    "ff-drop": counts.Dropped,
    friendStatTotal: counts.all,
    friendStatCompleted: counts.Completed,
    friendStatShared: sharedCount,
  };
  Object.entries(pillMap).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });

  const topGenreEl = document.getElementById("friendStatTopGenre");
  if (topGenreEl) topGenreEl.textContent = topGenreEntry ? topGenreEntry[0] : "—";
}

function refreshFriendGenreFilter(libs) {
  const select = document.getElementById("friendFilterGenre");
  if (!select) return;
  const previous = select.value;
  const genres = new Set();
  libs.forEach((e) => {
    if (Array.isArray(e.genres)) e.genres.forEach((g) => g && genres.add(g));
  });
  select.innerHTML =
    '<option value="">All Genres</option>' +
    Array.from(genres)
      .sort()
      .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
      .join("");
  if (previous && genres.has(previous)) {
    select.value = previous;
  } else if (previous) {
    select.value = "";
    updateFriendFilterBadge();
  }
}

export const quickFilterFriendStatus = (window.quickFilterFriendStatus = (
  status,
) => {
  document
    .querySelectorAll("#friendStatusPills .friend-status-pill")
    .forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.status === status),
    );
  const statusInput = document.getElementById("friendFilterStatus");
  if (statusInput) statusInput.value = status;
  renderFriendLibrary();
});

export const toggleFriendFiltersDrawer = (window.toggleFriendFiltersDrawer =
  () => {
    const drawer = document.getElementById("friendFiltersDrawer");
    const btn = document.getElementById("friendToggleFiltersBtn");
    if (!drawer) return;
    const isHidden = drawer.style.display === "none";
    drawer.style.display = isHidden ? "block" : "none";
    if (btn) btn.classList.toggle("active", isHidden);
  });

export const updateFriendFilterBadge = (window.updateFriendFilterBadge = () => {
  const fType = document.getElementById("friendFilterType")?.value || "";
  const fTier = document.getElementById("friendFilterTier")?.value || "";
  const fGenre = document.getElementById("friendFilterGenre")?.value || "";
  const fOverlap = document.getElementById("friendFilterOverlap")?.value || "";
  let count = 0;
  if (fType) count++;
  if (fTier) count++;
  if (fGenre) count++;
  if (fOverlap) count++;
  const badge = document.getElementById("friendActiveFilterBadge");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-flex";
    } else {
      badge.style.display = "none";
    }
  }
});

export const clearFriendFilters = (window.clearFriendFilters = () => {
  ["friendFilterType", "friendFilterTier", "friendFilterGenre", "friendFilterOverlap", "friendFilterStatus"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    },
  );
  const sortEl = document.getElementById("friendSortBy");
  if (sortEl) sortEl.value = "titleAZ";
  document
    .querySelectorAll("#friendStatusPills .friend-status-pill")
    .forEach((btn) => btn.classList.toggle("active", btn.dataset.status === ""));
  updateFriendFilterBadge();
  renderFriendLibrary();
});

export const clearFriendSearch = (window.clearFriendSearch = () => {
  const input = document.getElementById("friendSearchInput");
  if (input) {
    input.value = "";
    renderFriendLibrary();
    input.focus();
  }
});

export const setFriendView = (window.setFriendView = (v) => {
  window._currentFriendView = v === "list" ? "list" : "grid";
  const gridBtn = document.getElementById("friendGridViewBtn");
  const listBtn = document.getElementById("friendListViewBtn");
  if (gridBtn)
    gridBtn.classList.toggle("active", window._currentFriendView === "grid");
  if (listBtn)
    listBtn.classList.toggle("active", window._currentFriendView === "list");

  const grid = document.getElementById("friendLibraryContainer");
  const lv = document.getElementById("friendLibraryListView");
  if (grid)
    grid.style.display = window._currentFriendView === "grid" ? "grid" : "none";
  if (lv) {
    lv.style.display = window._currentFriendView === "list" ? "flex" : "none";
  }
});

export const pickFriendSurprise = (window.pickFriendSurprise = () => {
  const pool =
    window._currentFriendFiltered && window._currentFriendFiltered.length > 0
      ? window._currentFriendFiltered
      : window.currentFriendLibrary || [];
  if (pool.length === 0) {
    return showToast("No entries available to pick from", "info");
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  showToast(`🎲 Surprise pick: ${pick.title}`, "info");
  if (window.openDetailModal) window.openDetailModal(pick.id, true);
});

export const openRecommendFromFriendView =
  (window.openRecommendFromFriendView = () => {
    if (!window.currentFriendViewUid) return;
    openRecommendModal(null, window.currentFriendViewUid);
  });

export const viewFriendLibrary = (window.viewFriendLibrary = async (
  friendUid,
  displayName,
) => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  if (!isValidFirestoreId(friendUid)) return;

  try {
    const snap = await getDoc(doc(db, "users", friendUid, "profile", "main"));
    const isSelf = auth.currentUser.uid === friendUid;
    const isAdminUser =
      auth.currentUser.email === "tanishqt00@gmail.com" &&
      auth.currentUser.emailVerified;

    if (!snap.exists() && !isAdminUser) {
      return showToast("Friend profile not found", "error");
    }

    const profileData = snap.exists() ? snap.data() : { username: displayName || friendUid };
    const pub = profileData.libraryPublic || "public";

    if (!isSelf && !isAdminUser) {
      if (pub === "private") {
        return showToast("This user's library is private", "error");
      }
      if (pub === "friends") {
        let isFriendAccepted = (window.socialFriends || []).some(
          (f) => f.id === friendUid && f.status === "accepted",
        );
        if (!isFriendAccepted) {
          const fSnap = await getDoc(
            doc(db, "users", friendUid, "friends", auth.currentUser.uid),
          );
          isFriendAccepted =
            fSnap.exists() && fSnap.data().status === "accepted";
        }
        if (!isFriendAccepted) {
          return showToast(
            "This user's codex is visible to friends only",
            "error",
          );
        }
      }
    }

    const friendRecord = (window.socialFriends || []).find(
      (f) => f.id === friendUid,
    );
    const resolvedName =
      friendRecord?.nickname ||
      profileData.displayUsername ||
      profileData.username ||
      displayName ||
      "Friend";
    const handle = profileData.username ? `@${profileData.username}` : "";
    const visLabel =
      pub === "friends"
        ? "Friends Only"
        : pub === "private"
          ? "Private"
          : "Public Codex";

    window.currentFriendProfile = { uid: friendUid, ...profileData };
    window.currentFriendViewUid = friendUid;
    window.currentFriendLibrary = [];

    const titleEl = document.getElementById("friendLibraryTitle");
    if (titleEl)
      titleEl.textContent = `${resolvedName.toUpperCase()}'S CODEX`;

    const avatarEl = document.getElementById("friendProfileAvatar");
    if (avatarEl) {
      avatarEl.style.background = getColorForString(
        profileData.username || friendUid,
      );
      avatarEl.textContent = (resolvedName || "U")[0].toUpperCase();
    }
    const nameEl = document.getElementById("friendProfileDisplayName");
    if (nameEl) nameEl.textContent = resolvedName;

    const metaEl = document.getElementById("friendProfileMeta");
    if (metaEl) {
      const parts = [];
      if (handle) parts.push(handle);
      if (friendRecord?.nickname && profileData.displayUsername) {
        parts.push(profileData.displayUsername);
      }
      parts.push(visLabel);
      metaEl.textContent = parts.join(" · ");
    }

    const recBtn = document.getElementById("friendRecommendBtn");
    if (recBtn) {
      const canRec = (window.socialFriends || []).some(
        (f) => f.id === friendUid && f.status === "accepted",
      );
      recBtn.style.display = !isSelf && canRec ? "inline-flex" : "none";
    }

    resetFriendViewerState();
    updateFriendStatsAndPills([]);
    const subEl = document.getElementById("friendLibrarySubtitle");
    if (subEl) subEl.textContent = "Loading codex…";

    const cEl = document.getElementById("friendLibraryContainer");
    if (cEl)
      cEl.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:48px; color:var(--text-muted)">Loading codex…</div>`;

    document.getElementById("friendLibraryOverlay")?.classList.add("open");

    if (window.unsubscribeFriendLibrary) window.unsubscribeFriendLibrary();
    window.unsubscribeFriendLibrary = onSnapshot(
      collection(db, "users", friendUid, "library"),
      (qr) => {
        if (window.currentFriendViewUid !== friendUid) return;
        const libs = qr.docs.map((d) => ({ id: d.id, ...d.data() }));
        window.currentFriendLibrary = libs;
        updateFriendStatsAndPills(libs);
        refreshFriendGenreFilter(libs);
        renderFriendLibrary();
      },
      (error) => {
        safeSyncError(error, "get", `users/${friendUid}/library`);
      },
    );
  } catch (e) {
    safeSyncError(e, "read", "profile");
  }
});

export const closeFriendLibrary = (window.closeFriendLibrary = () => {
  document.getElementById("friendLibraryOverlay")?.classList.remove("open");
  window.currentFriendViewUid = null;
  window.currentFriendProfile = null;
  if (window.unsubscribeFriendLibrary) {
    window.unsubscribeFriendLibrary();
    window.unsubscribeFriendLibrary = null;
  }
});

export const renderFriendLibrary = (window.renderFriendLibrary = () => {
  const c = document.getElementById("friendLibraryContainer");
  const lv = document.getElementById("friendLibraryListView");
  const sub = document.getElementById("friendLibrarySubtitle");
  if (!c) return;

  const qs = (document.getElementById("friendSearchInput")?.value || "")
    .trim()
    .toLowerCase();
  const clearBtn = document.getElementById("friendClearSearchBtn");
  if (clearBtn) clearBtn.style.display = qs.length > 0 ? "block" : "none";

  const t = document.getElementById("friendFilterType")?.value || "";
  const s = document.getElementById("friendFilterStatus")?.value || "";
  const tier = document.getElementById("friendFilterTier")?.value || "";
  const genre = document.getElementById("friendFilterGenre")?.value || "";
  const overlap = document.getElementById("friendFilterOverlap")?.value || "";
  const sortBy = document.getElementById("friendSortBy")?.value || "titleAZ";

  const allItems = window.currentFriendLibrary || [];
  let items = allItems.filter((x) => {
    if (qs && !(x.title || "").toLowerCase().includes(qs)) return false;
    if (t && x.type !== t) return false;
    if (s && x.status !== s) return false;
    if (tier && x.tier !== tier) return false;
    if (genre && (!Array.isArray(x.genres) || !x.genres.includes(genre)))
      return false;
    if (overlap === "shared" && !isEntryInMyLibrary(x)) return false;
    if (overlap === "unowned" && isEntryInMyLibrary(x)) return false;
    return true;
  });

  if (sortBy === "titleAZ") {
    items.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else if (sortBy === "year") {
    items.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (sortBy === "tier") {
    const p = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, "": 0 };
    items.sort((a, b) => (p[b.tier || ""] || 0) - (p[a.tier || ""] || 0));
  } else {
    items.sort(
      (a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0),
    );
  }

  window._currentFriendFiltered = items;

  if (sub) {
    sub.textContent = `Showing ${items.length} of ${allItems.length} entries`;
  }

  if (items.length === 0) {
    const emptyHtml =
      allItems.length === 0
        ? `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📚</div><h3>This codex is empty</h3><p>No titles have been added yet.</p></div>`
        : `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">📂</div><h3>No entries match your filters</h3><p>Try clearing filters or picking another status tab.</p></div>`;
    c.innerHTML = emptyHtml;
    if (lv) lv.innerHTML = emptyHtml;
    return;
  }

  c.innerHTML = items
    .map((e) => {
      const owned = isEntryInMyLibrary(e);
      const jsId = escJs(e.id);
      return `
      <div class="entry-card" onclick="window.openDetailModal('${jsId}', true)">
        ${owned ? `<div class="friend-owned-tag">✓ In Codex</div>` : ""}
        <div class="card-poster">
          ${
            e.poster
              ? `<img src="${esc(e.poster)}" referrerpolicy="no-referrer" onerror="this.outerHTML='🎬'" />`
              : "🎬"
          }
        </div>
        <div class="card-info">
          <div class="card-title">${esc(e.title)}</div>
          <div class="card-meta">
            <span class="badge badge-type">${esc(e.type || "Anime")}</span>
            ${e.tier ? `<span class="badge tier-${esc(e.tier)}" style="border-radius:4px;padding:2px 7px;">${esc(e.tier)}</span>` : ""}
          </div>
        </div>
        <div class="card-overlay">
          <div style="font-size:12px;color:#fff;font-weight:600;margin-bottom:auto;">${esc(e.status || "")}</div>
          <div class="card-actions">
            ${
              owned
                ? `<button class="btn btn-ghost btn-sm" style="width:100%; justify-content:center; font-size:11px; padding:5px 8px;" onclick="event.stopPropagation(); window.openDetailModal('${jsId}', true)">View Details</button>`
                : `<button class="btn btn-primary btn-sm" style="width:100%; justify-content:center; font-size:11px; padding:5px 8px;" onclick="event.stopPropagation(); window.addFriendLibToCodex('${jsId}')">+ Add to Codex</button>`
            }
          </div>
        </div>
      </div>
  `;
    })
    .join("");

  if (lv) {
    lv.innerHTML = items
      .map((e) => {
        const owned = isEntryInMyLibrary(e);
        const jsId = escJs(e.id);
        return `
      <div class="list-row" onclick="window.openDetailModal('${jsId}', true)">
        <div class="list-poster">
          ${
            e.poster
              ? `<img src="${esc(e.poster)}" referrerpolicy="no-referrer" onerror="this.outerHTML='🎬'" />`
              : "🎬"
          }
        </div>
        <div class="list-title">
          ${esc(e.title)}
          ${e.tier ? `<span class="badge tier-${esc(e.tier)}" style="margin-left:6px">${esc(e.tier)}</span>` : ""}
        </div>
        <span class="badge badge-type" style="margin-right:8px;">${esc(e.type || "Anime")}</span>
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-right:auto">${esc(e.status || "")}</div>
        <div class="list-row-actions" style="opacity:1;">
          ${
            owned
              ? `<span style="color:var(--success); font-size:11px; font-weight:700; padding:0 6px;">✓ In Codex</span>`
              : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.addFriendLibToCodex('${jsId}')">+ Add</button>`
          }
        </div>
      </div>
    `;
      })
      .join("");
  }
});

// Recommend Flow
let recTargetFriendUid = null;
let recTargetItem = null;
let selectedRecData = null;

export const openRecommendModalById = (window.openRecommendModalById = (
  id,
) => {
  let entry = (window.library || []).find((l) => String(l.id) === String(id));
  if (!entry && window.currentFriendLibrary) {
    entry = window.currentFriendLibrary.find(
      (l) => String(l.id) === String(id),
    );
  }
  if (entry) openRecommendModal(entry, null);
});

export const openRecommendModal = (window.openRecommendModal = (
  itemObj,
  explicitFriendUid,
) => {
  const m = document.getElementById("recommendModalOverlay");
  if (!m) return;
  document.getElementById("recommendNote").value = "";
  document.getElementById("recommendSearchInput").value = "";
  const res = document.getElementById("recommendSearchResults");
  if (res) res.style.display = "none";

  const targetInfo = document.getElementById("recommendTargetInfo");
  recTargetFriendUid = explicitFriendUid;
  recTargetItem = itemObj;
  selectedRecData = null;

  if (itemObj) {
    document.getElementById("recommendModalTitle").textContent =
      "SEND " + (itemObj.title || "TITLE").toUpperCase();
    targetInfo.innerHTML = `
        <div style="display:flex; gap:12px; background:var(--bg-elevated); padding:10px; border-radius:8px;">
            ${itemObj.poster ? `<img src="${esc(itemObj.poster)}" referrerpolicy="no-referrer" style="width:40px; height:60px; object-fit:cover; border-radius:4px;" onerror="this.style.display='none'" />` : ""}
            <div>
               <div style="font-weight:700;">${esc(itemObj.title)}</div>
               <div style="font-size:12px; color:var(--text-muted);">${esc(itemObj.type)}${itemObj.tier ? " - " + esc(itemObj.tier) + " Tier" : ""}</div>
            </div>
        </div>
    `;
    document.getElementById("recommendSearchInput").placeholder =
      "Search friends...";
  } else {
    const f = (window.socialFriends || []).find(
      (x) => x.id === explicitFriendUid,
    );
    document.getElementById("recommendModalTitle").textContent =
      "RECOMMEND TO " +
      (f
        ? (f.nickname || f.displayUsername || f.username || "FRIEND").toUpperCase()
        : "FRIEND");
    targetInfo.innerHTML = "";
    document.getElementById("recommendSearchInput").placeholder =
      "Search your library...";
  }
  m.classList.add("open");
});

export const closeRecommendModal = (window.closeRecommendModal = () => {
  document.getElementById("recommendModalOverlay")?.classList.remove("open");
});

export const onRecommendSearchInput = (window.onRecommendSearchInput = () => {
  const q = document
    .getElementById("recommendSearchInput")
    .value.toLowerCase();
  const res = document.getElementById("recommendSearchResults");
  if (!res) return;
  res.style.display = "block";

  if (recTargetItem) {
    let matched = (window.socialFriends || []).filter(
      (f) => f.status === "accepted",
    );
    if (q) {
      matched = matched.filter((f) =>
        (f.nickname || f.displayUsername || f.username || "")
          .toLowerCase()
          .includes(q),
      );
    } else {
      matched = matched.sort(
        (a, b) =>
          (b.isFavorite === true ? 1 : 0) - (a.isFavorite === true ? 1 : 0),
      );
    }
    res.innerHTML =
      matched
        .map(
          (f) => `
        <div style="padding:10px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px;" onclick="window.completeRecommendSelection('${escJs(f.id)}')">
            <div style="flex:1;">
                ${esc(f.nickname || f.displayUsername || f.username || f.id)} ${f.isFavorite ? "⭐" : ""}
            </div>
        </div>
    `,
        )
        .join("") ||
      `<div style="padding:10px; color:var(--text-muted); font-size:12px;">No friends found.</div>`;
  } else {
    if (!q) {
      res.style.display = "none";
      return;
    }
    const matched = (window.library || [])
      .filter((l) => (l.title || "").toLowerCase().includes(q))
      .slice(0, 20);
    res.innerHTML =
      matched
        .map(
          (l) => `
        <div style="padding:10px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center;" onclick="window.completeRecommendSelection('${escJs(l.id)}')">
            ${l.poster ? `<img src="${esc(l.poster)}" referrerpolicy="no-referrer" style="width:24px; height:36px; object-fit:cover; border-radius:3px;" onerror="this.style.display='none'" />` : ""}
            <div>
               <div style="font-size:14px; font-weight:600;">${esc(l.title)}</div>
               <div style="font-size:11px; color:var(--text-muted);">${esc(l.type)}</div>
            </div>
        </div>
    `,
        )
        .join("") ||
      `<div style="padding:10px; color:var(--text-muted); font-size:12px;">No titles found.</div>`;
  }
});

export const completeRecommendSelection =
  (window.completeRecommendSelection = (id) => {
    if (recTargetItem) {
      selectedRecData = id;
      const f = (window.socialFriends || []).find((x) => x.id === id);
      if (f)
        document.getElementById("recommendSearchInput").value =
          f.nickname || f.displayUsername || f.username;
    } else {
      selectedRecData = id;
      const l = (window.library || []).find((x) => String(x.id) === String(id));
      if (l) {
        document.getElementById("recommendSearchInput").value = l.title;
        recTargetItem = l;
      }
    }
    const res = document.getElementById("recommendSearchResults");
    if (res) res.style.display = "none";
  });

export const sendRecommendation = (window.sendRecommendation = async () => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  if (!selectedRecData && (!recTargetFriendUid || !recTargetItem))
    return showToast("Select a target first", "error");

  const friendUid =
    recTargetItem && !recTargetFriendUid ? selectedRecData : recTargetFriendUid;
  const item = recTargetItem;
  if (!isValidFirestoreId(friendUid) || !item)
    return showToast("Invalid recommendation target", "error");

  const note = (document.getElementById("recommendNote")?.value || "")
    .trim()
    .slice(0, 500);

  try {
    const batch = writeBatch(db);
    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "recommendation",
      fromUid: auth.currentUser.uid,
      fromUsername: getMyUsernameFallback(),
      sentAt: Date.now(),
      read: false,
      itemTitle: String(item.title || "Untitled").slice(0, 500),
      itemPoster: item.poster ? String(item.poster).slice(0, 2000) : "",
      itemTier: item.tier ? String(item.tier).slice(0, 10) : "",
      itemType: item.type ? String(item.type).slice(0, 60) : "",
      itemGenres: Array.isArray(item.genres) ? item.genres.slice(0, 30) : [],
      itemStremioId: item.stremioId || null,
      itemJikanId: item.jikanId || null,
      itemMalId: item.malId || null,
      itemKitsuId: item.kitsuId || null,
      itemLink: item.link ? String(item.link).slice(0, 2000) : "",
      senderNote: note,
    });
    await batch.commit();
    showToast("Recommendation sent!", "success");
    closeRecommendModal();
  } catch (e) {
    safeSyncError(e, "create", "notifications");
  }
});

export const sendFriendReq = (window.sendFriendReq = async (
  targetUid,
  targetUsername,
) => {
  if (!auth.currentUser) return showToast("Please sign in first", "error");
  const myUid = auth.currentUser.uid;
  if (!isValidFirestoreId(targetUid)) {
    return showToast("Invalid user ID", "error");
  }
  if (targetUid === myUid) {
    return showToast("You cannot add yourself as a friend", "error");
  }
  if (inFlightFriendOps.has(targetUid)) return;
  inFlightFriendOps.add(targetUid);

  try {
    const myRef = doc(db, "users", myUid, "friends", targetUid);
    const targetRef = doc(db, "users", targetUid, "friends", myUid);
    const targetProfileRef = doc(db, "users", targetUid, "profile", "main");

    const [mySnap, targetSnap, targetProfileSnap] = await Promise.all([
      getDoc(myRef),
      getDoc(targetRef),
      getDoc(targetProfileRef),
    ]);

    if (mySnap.exists()) {
      const status = mySnap.data().status;
      if (status === "accepted") {
        showToast("You are already friends!", "info");
        return;
      }
      if (status === "pending_sent") {
        showToast("Friend request already sent", "info");
        return;
      }
      if (status === "pending_received") {
        inFlightFriendOps.delete(targetUid);
        await acceptFriend(targetUid, targetUsername);
        return;
      }
    }

    if (
      targetProfileSnap.exists() &&
      targetProfileSnap.data().allowRequests === false
    ) {
      showToast("This user is not accepting friend requests", "error");
      return;
    }

    const now = Date.now();
    // Clean up any stale target doc unless it is already pending_received
    const targetAlreadyPendingReceived =
      targetSnap.exists() && targetSnap.data().status === "pending_received";
    if (targetSnap.exists() && !targetAlreadyPendingReceived) {
      await deleteDoc(targetRef);
    }

    const batch = writeBatch(db);
    batch.set(myRef, {
      status: "pending_sent",
      since: now,
    });
    if (!targetAlreadyPendingReceived) {
      batch.set(targetRef, {
        status: "pending_received",
        since: now,
      });
    }

    const notifRef = doc(collection(db, "users", targetUid, "notifications"));
    batch.set(notifRef, {
      type: "friend_request",
      fromUid: myUid,
      fromUsername: getMyUsernameFallback(),
      sentAt: now,
      read: false,
    });
    await batch.commit();
    showToast("Friend request sent!", "success");
    const dd = document.getElementById("socialSearchDropdown");
    if (dd) dd.style.display = "none";
    const inp = document.getElementById("socialSearchInput");
    if (inp) inp.value = "";
  } catch (e) {
    safeSyncError(e, "create", "friends");
  } finally {
    inFlightFriendOps.delete(targetUid);
  }
});

// ── USER SEARCH HELPERS ───────────────────────────────────────────

async function fetchSearchableProfiles() {
  const now = Date.now();
  if (now - profileSearchCache.ts < 60000 && profileSearchCache.items.length > 0) {
    return profileSearchCache.items;
  }
  const snap = await getDocs(collectionGroup(db, "profile"));
  const items = snap.docs
    .map((d) => {
      const data = d.data();
      const uid = d.ref.parent.parent ? d.ref.parent.parent.id : "";
      return uid ? { uid, ...data } : null;
    })
    .filter(Boolean);
  profileSearchCache = { ts: now, items };
  return items;
}

function buildSearchUserRow(u) {
  const uid = u.uid;
  const display = u.displayUsername || u.username || "User";
  const jsUid = escJs(uid);
  const jsUsername = escJs(u.username || display);
  const jsDisplay = escJs(display);
  const existingReq = (window.socialFriends || []).find((f) => f.id === uid);
  const hue = getColorForString(u.username || uid);
  const initial = esc((display || "U")[0].toUpperCase());

  let actionHtml = `<button class="btn btn-primary btn-sm" onclick="window.sendFriendReq('${jsUid}', '${jsUsername}')">Add Friend</button>`;
  if (existingReq) {
    if (existingReq.status === "accepted") {
      actionHtml = `
        <button class="btn btn-ghost btn-sm" onclick="window.viewFriendLibrary('${jsUid}', '${jsDisplay}')">View Codex</button>
        <span style="color:var(--success); font-size:12px; font-weight:700;">Friends ✓</span>
      `;
    } else if (existingReq.status === "pending_sent") {
      actionHtml = `<button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${jsUid}')">Cancel Request</button>`;
    } else if (existingReq.status === "pending_received") {
      actionHtml = `
        <button class="btn btn-primary btn-sm" onclick="window.acceptFriend('${jsUid}', '${jsUsername}')">✓ Accept</button>
        <button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${jsUid}')">✕</button>
      `;
    }
  } else if (u.allowRequests === false) {
    actionHtml = `<span style="color:var(--danger); font-size:12px;">Requests Off</span>`;
  }

  return `
    <div style="padding:10px 12px; display:flex; align-items:center; gap:10px; border-bottom:1px solid var(--border);">
        <div class="friend-avatar" style="background:${hue}; width:36px; height:36px; font-size:16px; margin:0;">${initial}</div>
        <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(display)}</div>
            <div style="color:var(--text-muted); font-size:11px;">@${esc(u.username || "")}</div>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
          ${actionHtml}
        </div>
    </div>
  `;
}

async function runSocialSearch(rawQuery) {
  const q = (rawQuery || "").trim().toLowerCase();
  const res = document.getElementById("socialSearchDropdown");
  if (!res) return;
  if (!auth.currentUser || q.length < 2) {
    res.style.display = "none";
    return;
  }

  res.style.display = "block";
  const myUid = auth.currentUser.uid;

  try {
    const matches = new Map();

    // 1. Instant exact username lookup if query is a valid username doc ID
    if (/^[a-z0-9_]{3,20}$/.test(q)) {
      const exactSnap = await getDoc(doc(db, "usernames", q));
      if (exactSnap.exists()) {
        const uid = exactSnap.data().uid;
        if (uid === myUid && q.length >= 3) {
          res.innerHTML = `<div style="padding:12px; color:var(--text-muted); font-size:13px;">This is you!</div>`;
          return;
        }
        const pSnap = await getDoc(doc(db, "users", uid, "profile", "main"));
        if (pSnap.exists() && pSnap.data().showInSearch !== false) {
          matches.set(uid, { uid, ...pSnap.data() });
        }
      }
    }

    // 2. Prefix / partial / email / displayName search across profiles
    try {
      const allProfiles = await fetchSearchableProfiles();
      for (const p of allProfiles) {
        if (!p.uid || p.uid === myUid || p.showInSearch === false) continue;
        const uname = (p.username || "").toLowerCase();
        const dname = (p.displayUsername || "").toLowerCase();
        const email = (p.email || "").toLowerCase();
        if (
          uname.includes(q) ||
          dname.includes(q) ||
          email === q ||
          (q.includes("@") && email.includes(q))
        ) {
          matches.set(p.uid, p);
          if (matches.size >= 8) break;
        }
      }
    } catch (groupErr) {
      // Fallback gracefully to exact match results if collectionGroup fails
      console.warn("Profile search fallback:", groupErr);
    }

    // Check if query matches currently typed input still
    const currentVal = (
      document.getElementById("socialSearchInput")?.value || ""
    )
      .trim()
      .toLowerCase();
    if (currentVal !== q) return;

    const list = Array.from(matches.values());
    if (list.length === 0) {
      res.innerHTML = `<div style="padding:12px; color:var(--text-muted); font-size:13px;">No users found matching "${esc(rawQuery.trim())}".</div>`;
      return;
    }

    res.innerHTML = list.map((u) => buildSearchUserRow(u)).join("");
  } catch (err) {
    console.error("Search error:", err);
    res.innerHTML = `<div style="padding:12px; color:var(--danger); font-size:13px;">Could not search users right now.</div>`;
  }
}

function refreshSearchDropdownIfOpen() {
  const res = document.getElementById("socialSearchDropdown");
  const inp = document.getElementById("socialSearchInput");
  if (res && res.style.display === "block" && inp && inp.value.trim().length >= 2) {
    runSocialSearch(inp.value);
  }
}

export const initAdminPanel = (window.initAdminPanel = async () => {
  try {
    const qSnap = await getDocs(collectionGroup(db, "profile"));
    const users = qSnap.docs.map((d) => {
      const data = d.data();
      const uid = d.ref.parent.parent ? d.ref.parent.parent.id : "";
      return { uid, ...data };
    });

    const list = document.getElementById("adminUserList");
    if (list) {
      document.getElementById("adminTotalUsers").textContent = users.length;
      list.innerHTML = users
        .map(
          (u) => `
              <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center; flex-direction:row;">
                  <div>
                      <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px">@${esc(u.username)} ${u.displayUsername && u.displayUsername !== u.username ? "(" + esc(u.displayUsername) + ")" : ""}</div>
                      <div style="font-size:12px; color:var(--text-muted)">${esc(u.email || "No email")} | UID: ${esc(u.uid)}</div>
                  </div>
                  <button class="btn btn-primary btn-sm" onclick="window.viewFriendLibrary('${escJs(u.uid)}', '${escJs(u.displayUsername || u.username)}')">View Codex</button>
              </div>
         `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Failed collectionGroup Profile", err);
    try {
      const usernamesSnap = await getDocs(collection(db, "usernames"));
      const users = usernamesSnap.docs.map((d) => ({
        uid: d.data().uid,
        username: d.id,
      }));
      const list = document.getElementById("adminUserList");
      if (list) {
        document.getElementById("adminTotalUsers").textContent = users.length;
        list.innerHTML = users
          .map(
            (u) => `
                  <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center; flex-direction:row;">
                      <div>
                          <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px">@${esc(u.username)}</div>
                          <div style="font-size:12px; color:var(--text-muted)">UID: ${esc(u.uid)}</div>
                      </div>
                      <button class="btn btn-primary btn-sm" onclick="window.viewFriendLibrary('${escJs(u.uid)}', '${escJs(u.username)}')">View Codex</button>
                  </div>
             `,
          )
          .join("");
      }
    } catch (e) {
      console.error("Admin Load Error", e);
    }
  }
});

let searchDebounceTimer = null;

export function setupSocialListeners() {
  const searchInput = document.getElementById("socialSearchInput");
  if (searchInput && !searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", (e) => {
      const val = e.target.value;
      clearTimeout(searchDebounceTimer);
      if (val.trim().length < 2) {
        const res = document.getElementById("socialSearchDropdown");
        if (res) res.style.display = "none";
        return;
      }
      searchDebounceTimer = setTimeout(() => runSocialSearch(val), 180);
    });
  }

  const setupInput = document.getElementById("setupUsername");
  if (setupInput && !setupInput.dataset.bound) {
    setupInput.dataset.bound = "true";
    setupInput.addEventListener("keydown", (e) => {
      if (e.key === " ") e.preventDefault();
    });

    setupInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      const stat = document.getElementById("setupUsernameStatus");
      const btn = document.getElementById("btnSetUsername");
      if (!stat || !btn) return;
      if (val.length < 3 || val.length > 20 || !/^[a-z0-9_]+$/.test(val)) {
        stat.textContent = "Must be 3-20 lowercase letters, numbers, or underscores.";
        stat.style.color = "var(--danger)";
        btn.disabled = true;
        return;
      }
      stat.textContent = "Checking availability...";
      stat.style.color = "var(--text-muted)";
      clearTimeout(window._unameCheck);
      window._unameCheck = setTimeout(async () => {
        try {
          const snap = await getDoc(doc(db, "usernames", val));
          if (snap.exists()) {
            stat.textContent = "Username taken.";
            stat.style.color = "var(--danger)";
            btn.disabled = true;
          } else {
            stat.textContent = "Username is available!";
            stat.style.color = "var(--success)";
            btn.disabled = false;
            btn.onclick = async () => {
              if (!auth.currentUser) return;
              btn.disabled = true;
              try {
                const numericCode = Math.floor(
                  100000000 + Math.random() * 900000000,
                ).toString();
                const batch = writeBatch(db);
                batch.set(doc(db, "usernames", val), {
                  uid: auth.currentUser.uid,
                });
                batch.set(
                  doc(db, "users", auth.currentUser.uid, "profile", "main"),
                  {
                    username: val,
                    displayUsername: val,
                    email: auth.currentUser.email || null,
                    friendCode: numericCode,
                    joinedAt: Date.now(),
                    libraryPublic: "public",
                    allowRequests: true,
                    showInSearch: true,
                  },
                  { merge: true },
                );
                await batch.commit();
                profileSearchCache.ts = 0;
                showToast("Username claimed!", "success");
              } catch (err) {
                btn.disabled = false;
                stat.textContent = "Failed to save username. Try again.";
                stat.style.color = "var(--danger)";
                safeSyncError(err, "write", "usernames/profile");
              }
            };
          }
        } catch (err) {
          console.error(err);
          stat.textContent = "Error checking availability.";
          stat.style.color = "var(--danger)";
        }
      }, 400);
    });
  }
}

export const initSocial = (window.initSocial = () => {
  if (!auth || !auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const docRef = doc(db, "users", uid, "profile", "main");
  if (window.unsubscribeProfile) window.unsubscribeProfile();
  window.unsubscribeProfile = onSnapshot(
    docRef,
    (snap) => {
      const promptEl = document.getElementById("socialSetupPrompt");
      const content = document.getElementById("socialAppContent");
      const unDisplay = document.getElementById("userUsernameDisplay");

      if (!snap.exists() || !snap.data().username) {
        if (promptEl) promptEl.style.display = "flex";
        if (content) content.style.display = "none";
        window.socialProfile = null;
        if (unDisplay) unDisplay.textContent = "";
      } else {
        window.socialProfile = snap.data();
        if (promptEl) promptEl.style.display = "none";
        if (content) content.style.display = "block";
        if (unDisplay)
          unDisplay.textContent = "@" + window.socialProfile.username;

        if (window.unsubscribeFriends) window.unsubscribeFriends();
        window.unsubscribeFriends = onSnapshot(
          collection(db, "users", uid, "friends"),
          async (qSnap) => {
            const fs = await Promise.all(
              qSnap.docs.map(async (d) => {
                const obj = { id: d.id, ...d.data() };
                try {
                  const pf = await getDoc(
                    doc(db, "users", obj.id, "profile", "main"),
                  );
                  if (pf.exists()) {
                    const pd = pf.data();
                    obj.username = pd.username || "";
                    obj.displayUsername = pd.displayUsername || pd.username || "";
                    obj.email = pd.email || "";
                    obj.libraryPublic = pd.libraryPublic || "public";
                  }
                } catch (e) {
                  // Ignore missing/unreadable profile gracefully
                }
                return obj;
              }),
            );
            window.socialFriends = fs;
            renderPendingRequests();
            renderFriendsGrid();
          },
          (error) => {
            safeSyncError(error, "get", "users/[uid]/friends");
          },
        );

        if (window.unsubscribeNotifs) window.unsubscribeNotifs();
        window.unsubscribeNotifs = onSnapshot(
          collection(db, "users", uid, "notifications"),
          (qSnap) => {
            window.socialNotifications = qSnap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }));
            renderNotificationsDrawer();
          },
          (error) => {
            safeSyncError(error, "get", "users/[uid]/notifications");
          },
        );
      }
    },
    (error) => {
      safeSyncError(error, "get", "users/[uid]/profile/main");
    },
  );
});
