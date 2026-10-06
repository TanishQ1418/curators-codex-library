// ── SOCIAL & COMMUNITY MODULE ─────────────────────────────────────

import {
  auth,
  db,
  doc,
  collection,
  collectionGroup,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  handleFirestoreError,
} from "../config/firebase.js";
import { showToast, getColorForString } from "../utils/helpers.js";

window.socialProfile = null;
window.socialFriends = [];
window.socialNotifications = [];
window.currentPendingTab = "received";

export const openSocialSettings = (window.openSocialSettings = () => {
  if (!window.socialProfile) return;
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
    const val = document
      .getElementById("socialSettingsDisplayName")
      ?.value.trim();
    if (!val || val.length < 3) return showToast("Name too short", "error");
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { displayUsername: val },
      );
      showToast("Saved!", "success");
    } catch (e) {
      handleFirestoreError(e, "update", "profile");
    }
  });

export const saveSocialSettingsVisibility =
  (window.saveSocialSettingsVisibility = async (val) => {
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { libraryPublic: val },
      );
    } catch (e) {
      handleFirestoreError(e, "update", "profile");
    }
  });

export const saveSocialSettingsToggle = (window.saveSocialSettingsToggle =
  async (field, val) => {
    try {
      await updateDoc(
        doc(db, "users", auth.currentUser.uid, "profile", "main"),
        { [field]: val },
      );
    } catch (e) {
      handleFirestoreError(e, "update", "profile");
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

      // Mark all as read when opening
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
    if (!confirm("Clear all notifications?")) return;
    try {
      const batch = writeBatch(db);
      (window.socialNotifications || []).forEach((n) =>
        batch.delete(
          doc(db, "users", auth.currentUser.uid, "notifications", n.id),
        ),
      );
      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, "delete", "notifications");
    }
  });

export const deleteNotification = (window.deleteNotification = async (id) => {
  try {
    await deleteDoc(
      doc(db, "users", auth.currentUser.uid, "notifications", id),
    );
  } catch (e) {
    handleFirestoreError(e, "delete", "notifications");
  }
});

export const acceptFriend = (window.acceptFriend = async (
  friendUid,
  friendUsername,
) => {
  try {
    const batch = writeBatch(db);
    const myUid = auth.currentUser.uid;
    batch.update(doc(db, "users", myUid, "friends", friendUid), {
      status: "accepted",
      since: Date.now(),
    });
    batch.update(doc(db, "users", friendUid, "friends", myUid), {
      status: "accepted",
      since: Date.now(),
    });

    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "request_accepted",
      fromUid: myUid,
      fromUsername: window.socialProfile?.username || "Friend",
      sentAt: Date.now(),
      read: false,
    });
    await batch.commit();
    showToast("Friend accepted!", "success");
  } catch (e) {
    handleFirestoreError(e, "update", "friends");
  }
});

export const declineFriend = (window.declineFriend = async (friendUid) => {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", auth.currentUser.uid, "friends", friendUid));
    batch.delete(doc(db, "users", friendUid, "friends", auth.currentUser.uid));
    await batch.commit();
  } catch (e) {
    handleFirestoreError(e, "delete", "friends");
  }
});

export const removeFriend = (window.removeFriend = async (
  friendUid,
  friendUsername,
) => {
  if (!confirm(`Remove ${friendUsername} from your friends?`)) return;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, "users", auth.currentUser.uid, "friends", friendUid));
    batch.delete(doc(db, "users", friendUid, "friends", auth.currentUser.uid));
    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "unfriended",
      fromUid: auth.currentUser.uid,
      fromUsername: window.socialProfile?.username || "Friend",
      sentAt: Date.now(),
      read: false,
    });
    await batch.commit();
    showToast("Friend removed", "success");
  } catch (e) {
    handleFirestoreError(e, "delete", "friends");
  }
});

export const toggleFavoriteFriend = (window.toggleFavoriteFriend = async (
  friendUid,
  current,
) => {
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "friends", friendUid), {
      isFavorite: !current,
    });
  } catch (e) {
    handleFirestoreError(e, "update", "friends");
  }
});

export const setFriendNickname = (window.setFriendNickname = async (
  friendUid,
) => {
  const friend = (window.socialFriends || []).find((f) => f.id === friendUid);
  const newName = prompt(
    "Set nickname (leave empty to clear)",
    friend?.nickname || "",
  );
  if (newName === null) return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid, "friends", friendUid), {
      nickname: newName,
    });
  } catch (e) {
    handleFirestoreError(e, "update", "friends");
  }
});

export const switchPendingTab = (window.switchPendingTab = (tab) => {
  window.currentPendingTab = tab;
  document
    .getElementById("tabReceivedRequests")
    ?.classList.toggle("active", tab === "received");
  document
    .getElementById("tabSentRequests")
    ?.classList.toggle("active", tab === "sent");
  renderPendingRequests();
});

export const renderPendingRequests = () => {
  const container = document.getElementById("pendingRequestsContainer");
  const section = document.getElementById("pendingRequestsSection");
  if (!container || !section || !window.socialFriends) return;

  const items = window.socialFriends.filter(
    (f) => f.status === `pending_${window.currentPendingTab}`,
  );
  const badgeCount = window.socialFriends.filter(
    (f) => f.status === "pending_received",
  ).length;

  const badgeEl = document.getElementById("nav-badge-social");
  if (badgeEl) {
    badgeEl.textContent = badgeCount;
    badgeEl.style.display = badgeCount > 0 ? "inline-block" : "none";
  }

  const allPending = window.socialFriends.filter(
    (f) => f.status !== "accepted",
  );
  if (allPending.length === 0) {
    section.style.display = "none";
    return;
  }
  section.style.display = "block";

  container.innerHTML = items
    .map((f) => {
      const hue = getColorForString(f.username || f.id);
      const initial = (f.username || "U")[0].toUpperCase();
      return `
          <div class="notification-card" style="display:flex; align-items:center; gap:12px;">
              <div class="friend-avatar" style="background:${hue}; width:40px; height:40px; font-size:16px; margin:0;">${initial}</div>
              <div style="flex:1;">
                  <div style="font-weight:600; font-size:14px;">${f.username || f.id}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${new Date(f.since).toLocaleDateString()}</div>
              </div>
              ${
                window.currentPendingTab === "received"
                  ? `
                  <button class="btn btn-primary btn-sm" onclick="window.acceptFriend('${f.id}', '${f.username || ""}')">✓ Accept</button>
                  <button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${f.id}')">✕</button>
              `
                  : `
                  <button class="btn btn-ghost btn-sm" onclick="window.declineFriend('${f.id}')">Cancel</button>
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
  ).toLowerCase();

  let accepted = window.socialFriends.filter((f) => f.status === "accepted");

  if (q) {
    accepted = accepted.filter(
      (f) =>
        (f.nickname || "").toLowerCase().includes(q) ||
        (f.username || "").toLowerCase().includes(q) ||
        (f.email || "").toLowerCase().includes(q),
    );
  }

  accepted.sort((a, b) => {
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    return (a.nickname || a.username || "").localeCompare(
      b.nickname || b.username || "",
    );
  });

  if (accepted.length === 0) {
    grid.style.display = "none";
    empty.style.display = "flex";
    if (q)
      empty.innerHTML =
        '<div class="empty-icon">🤝</div><h3>No friends found matching search.</h3>';
    else
      empty.innerHTML =
        '<div class="empty-icon">🤝</div><h3>Your codex is empty of companions</h3><p>Search for a username above to begin.</p>';
    return;
  }
  grid.style.display = "grid";
  empty.style.display = "none";

  grid.innerHTML = accepted
    .map((f) => {
      const hue = getColorForString(f.username || f.id);
      const nameDisplay = f.nickname ? f.nickname : f.username || "Unknown";
      const subDisplay = f.nickname ? `@${f.username}` : `Friend`;
      return `
          <div class="friend-card ${f.isFavorite ? "favorite" : ""}">
              <div class="friend-card-top">
                  <button class="icon-btn favorite-btn ${f.isFavorite ? "active" : ""}" title="${f.isFavorite ? "Unfavorite" : "Favorite"}" onclick="window.toggleFavoriteFriend('${f.id}', ${!!f.isFavorite})">
                      ${f.isFavorite ? "⭐" : "☆"}
                  </button>
                  <button class="icon-btn remove-btn" title="Remove Friend" onclick="window.removeFriend('${f.id}', '${f.username || ""}')">×</button>
              </div>
              <div class="friend-avatar" style="background:${hue}">${nameDisplay[0].toUpperCase()}</div>
              <div style="font-weight:700; font-size:16px; margin-bottom:2px;">${nameDisplay}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-bottom: 8px;">${subDisplay}</div>
              
              <div class="friend-actions">
                  <button class="btn btn-primary btn-sm" style="width:100%; justify-content:center" onclick="window.viewFriendLibrary('${f.id}', '${nameDisplay}')">📚 View Codex</button>
                  <div class="friend-action-row">
                      <button class="btn btn-ghost btn-sm btn-icon" title="Recommend" onclick="window.openRecommendModal(null, '${f.id}')">🎁</button>
                      <button class="btn btn-ghost btn-sm btn-icon" title="Set Nickname" onclick="window.setFriendNickname('${f.id}')">✏️</button>
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

    container.innerHTML = recommendations
      .map((n) => {
        const hasLib = (window.library || []).some(
          (l) => l.title === n.itemTitle && l.type === n.itemType,
        );
        return `
    <div class="entry-card" onclick="window.openDetailModalForRec('${n.id}')">
      <div class="not-interested-btn" onclick="event.stopPropagation(); window.deleteNotification('${n.id}')" title="Remove Recommendation">✕</div>
      <div class="card-poster"><img src="${n.itemPoster}" onerror="this.outerHTML='🎬'" /></div>
      <div class="card-info">
        <div class="card-title">${n.itemTitle}</div>
        <div class="card-meta">
          <span class="badge badge-type">${n.itemType}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 4px;">Rec by ${n.fromUsername}</div>
        ${n.itemTier ? `<div style="margin-top:8px"><span class="badge tier-${n.itemTier}">${n.itemTier} TIER</span></div>` : ""}
        <div style="font-size: 11px; color: var(--text-muted); font-style: italic; white-space: normal; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 8px;">"${n.senderNote || ""}"</div>
        <div style="margin-top: auto;">
          ${
            hasLib
              ? `<div style="color:var(--success); font-size:11px; font-weight:700; text-align:center;">✓ In Codex</div>`
              : `<button class="btn btn-primary btn-sm btn-full" onclick="event.stopPropagation(); window.addRecToLibrary('${n.id}')">Add to Codex</button>`
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
      return;
    }
    if (btn) btn.style.display = "flex";
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
  const notifs = window.socialNotifications || [];
  notifs.sort((a, b) => b.sentAt - a.sentAt);

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
      const cDate = new Date(n.sentAt).toLocaleDateString();
      const hue = getColorForString(n.fromUsername || "U");
      const isRec = n.type === "recommendation";

      if (n.type === "friend_request")
        content = `<b>${n.fromUsername}</b> sent you a friend request.`;
      else if (n.type === "request_accepted")
        content = `<b>${n.fromUsername}</b> accepted your friend request.`;
      else if (n.type === "unfriended")
        content = `<b>${n.fromUsername}</b> unfriended you.`;
      else if (n.type === "recommendation")
        content = `<b>${n.fromUsername}</b> recommended a title!`;

      let recBlock = "";
      if (isRec) {
        const hasLib = (window.library || []).some(
          (l) =>
            (l.title || "").toLowerCase() === (n.itemTitle || "").toLowerCase(),
        );
        recBlock = `
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-top:10px; display:flex; gap:12px; align-items:center;">
                ${n.itemPoster ? `<img src="${n.itemPoster}" style="width:40px; border-radius:4px;" />` : ""}
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:14px;">${n.itemTitle}</div>
                    ${n.itemTier ? `<div style="font-size:11px; color:var(--accent);">Rated: ${n.itemTier} Tier</div>` : ""}
                    ${n.senderNote ? `<div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">"${n.senderNote}"</div>` : ""}
                </div>
            </div>
            <div style="margin-top:10px;">
                ${
                  hasLib
                    ? `<div style="color:var(--success); font-size:12px; font-weight:700;">✓ Already in Library</div>`
                    : `<button class="btn btn-primary btn-sm" onclick="window.addRecToLibrary('${n.id}')">Add to Codex</button>`
                }
            </div>
        `;
      }

      return `
          <div class="notification-card ${n.read ? "" : "unread"}">
              <div style="position:absolute; top:10px; right:10px;">
                  <button class="btn-ghost" style="padding:2px 6px; font-size:10px;" onclick="window.deleteNotification('${n.id}')">✕</button>
              </div>
              <div style="display:flex; gap:10px; align-items:flex-start;">
                  <div class="friend-avatar" style="background:${hue}; width:30px; height:30px; font-size:14px; margin:0; flex-shrink:0;">${(n.fromUsername || "U")[0].toUpperCase()}</div>
                  <div style="flex:1; font-size:13px; line-height:1.4;">
                      ${content}
                      <div style="font-size:11px; color:var(--text-muted); margin-top:4px;">${cDate}</div>
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
  document.getElementById("field-notes").value =
    `Recommended by ${n.fromUsername}${n.senderNote ? ': "' + n.senderNote + '"' : ""}`;

  if (
    n.itemGenres &&
    n.itemGenres.length > 0 &&
    window.setCurrentDraftGenres
  ) {
    window.setCurrentDraftGenres([...n.itemGenres]);
  }
  toggleNotificationsDrawer();
});

export const addFriendLibToCodex = (window.addFriendLibToCodex = (
  entryId,
) => {
  const n = (window.currentFriendLibrary || []).find((x) => x.id === entryId);
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
  document.getElementById("seasonCountLabel").textContent =
    n.seasonCount || "0";
  if (n.stremioId) window._draftStremioId = n.stremioId;
  if (n.jikanId) window._draftJikanId = n.jikanId;
  if (n.malId) window._draftMalId = n.malId;
  document.getElementById("field-notes").value = `Found in friend's codex`;

  if (n.genres && n.genres.length > 0 && window.setCurrentDraftGenres) {
    window.setCurrentDraftGenres([...n.genres]);
  }
});

export const viewFriendLibrary = (window.viewFriendLibrary = async (
  friendUid,
  displayName,
) => {
  try {
    const snap = await getDoc(doc(db, "users", friendUid, "profile", "main"));
    if (!snap.exists()) return showToast("Friend profile not found", "error");
    const pub = snap.data().libraryPublic || "public";
    if (pub === "private") {
      return showToast("This user's library is private", "error");
    }

    const titleEl = document.getElementById("friendLibraryTitle");
    if (titleEl)
      titleEl.textContent = `${displayName.toUpperCase()}'S LIBRARY`;
    const cEl = document.getElementById("friendLibraryContainer");
    if (cEl)
      cEl.innerHTML = `<div style="text-align:center; padding:40px; width:100%; color:var(--text-muted)">Loading...</div>`;
    document.getElementById("friendLibraryOverlay")?.classList.add("open");

    window.currentFriendViewUid = friendUid;
    if (window.unsubscribeFriendLibrary) window.unsubscribeFriendLibrary();

    window.unsubscribeFriendLibrary = onSnapshot(
      collection(db, "users", friendUid, "library"),
      (qr) => {
        if (window.currentFriendViewUid !== friendUid) return;
        const libs = qr.docs.map((d) => ({ id: d.id, ...d.data() }));
        window.currentFriendLibrary = libs;
        renderFriendLibrary();
      },
      (error) => {
        handleFirestoreError(error, "get", `users/${friendUid}/library`);
      },
    );
  } catch (e) {
    handleFirestoreError(e, "read", "profile");
  }
});

export const closeFriendLibrary = (window.closeFriendLibrary = () => {
  document.getElementById("friendLibraryOverlay")?.classList.remove("open");
  if (window.unsubscribeFriendLibrary) {
    window.unsubscribeFriendLibrary();
    window.unsubscribeFriendLibrary = null;
  }
});

export const renderFriendLibrary = (window.renderFriendLibrary = () => {
  const c = document.getElementById("friendLibraryContainer");
  if (!c) return;
  const t = document.getElementById("friendFilterType")?.value || "";
  const s = document.getElementById("friendFilterStatus")?.value || "";
  const tier = document.getElementById("friendFilterTier")?.value || "";
  let items = window.currentFriendLibrary || [];

  if (t) items = items.filter((x) => x.type === t);
  if (s) items = items.filter((x) => x.status === s);
  if (tier) items = items.filter((x) => x.tier === tier);

  if (items.length === 0) {
    c.innerHTML = `<div style="text-align:center; padding:40px; width:100%; color:var(--text-muted)">Library is empty</div>`;
    return;
  }

  c.innerHTML = items
    .map(
      (e) => `
      <div class="entry-card" onclick="window.openDetailModal('${e.id}', true)">
        <div class="card-poster"><img src="${e.poster}" onerror="this.outerHTML='🎬'" /></div>
        <div class="card-info">
          <div class="card-title">${e.title}</div>
          <div class="card-meta">
            <span class="badge badge-type">${e.type}</span>
            ${e.status ? `<span class="badge" style="background:var(--bg-elevated);border:1px solid var(--border)">${e.status}</span>` : ""}
          </div>
          ${e.tier ? `<div style="margin-top:8px"><span class="badge tier-${e.tier}">${e.tier} TIER</span></div>` : ""}
        </div>
      </div>
  `,
    )
    .join("");
});

// Recommend Flow
let recTargetFriendUid = null;
let recTargetItem = null;

export const openRecommendModalById = (window.openRecommendModalById = (
  id,
) => {
  let entry = (window.library || []).find((l) => l.id === String(id));
  if (!entry && window.currentFriendLibrary) {
    entry = window.currentFriendLibrary.find((l) => l.id === String(id));
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

  if (itemObj) {
    document.getElementById("recommendModalTitle").textContent =
      "SEND " + itemObj.title.toUpperCase();
    targetInfo.innerHTML = `
        <div style="display:flex; gap:12px; background:var(--bg-elevated); padding:10px; border-radius:8px;">
            <img src="${itemObj.poster}" style="width:40px; height:60px; object-fit:cover; border-radius:4px;" />
            <div>
               <div style="font-weight:700;">${itemObj.title}</div>
               <div style="font-size:12px; color:var(--text-muted);">${itemObj.type} ${itemObj.tier ? "- " + itemObj.tier + " Tier" : ""}</div>
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
      (f ? (f.nickname || f.username).toUpperCase() : "FRIEND");
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
        (f.nickname || f.username || "").toLowerCase().includes(q),
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
        <div style="padding:10px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px;" onclick="window.completeRecommendSelection('${f.id}')">
            <div style="flex:1;">
                ${f.nickname || f.username} ${f.isFavorite ? "⭐" : ""}
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
    const matched = (window.library || []).filter((l) =>
      (l.title || "").toLowerCase().includes(q),
    );
    res.innerHTML =
      matched
        .map(
          (l) => `
        <div style="padding:10px; cursor:pointer; border-bottom:1px solid var(--border); display:flex; gap:10px;" onclick="window.completeRecommendSelection('${l.id}')">
            <img src="${l.poster}" style="width:24px; height:36px; object-fit:cover;" />
            <div>
               <div style="font-size:14px; font-weight:600;">${l.title}</div>
               <div style="font-size:11px; color:var(--text-muted);">${l.type}</div>
            </div>
        </div>
    `,
        )
        .join("") ||
      `<div style="padding:10px; color:var(--text-muted); font-size:12px;">No titles found.</div>`;
  }
});

let selectedRecData = null;
export const completeRecommendSelection =
  (window.completeRecommendSelection = (id) => {
    if (recTargetItem) {
      selectedRecData = id;
      const f = (window.socialFriends || []).find((x) => x.id === id);
      if (f)
        document.getElementById("recommendSearchInput").value =
          f.nickname || f.username;
    } else {
      selectedRecData = id;
      const l = (window.library || []).find((x) => x.id === String(id));
      if (l) {
        document.getElementById("recommendSearchInput").value = l.title;
        recTargetItem = l;
      }
    }
    const res = document.getElementById("recommendSearchResults");
    if (res) res.style.display = "none";
  });

export const sendRecommendation = (window.sendRecommendation = async () => {
  if (!selectedRecData && (!recTargetFriendUid || !recTargetItem))
    return showToast("Select a target first", "error");

  const friendUid =
    recTargetItem && !recTargetFriendUid ? selectedRecData : recTargetFriendUid;
  const item = recTargetItem;
  const note = document.getElementById("recommendNote").value.trim();

  try {
    const batch = writeBatch(db);
    const notifRef = doc(collection(db, "users", friendUid, "notifications"));
    batch.set(notifRef, {
      type: "recommendation",
      fromUid: auth.currentUser.uid,
      fromUsername: window.socialProfile?.username || "Friend",
      sentAt: Date.now(),
      read: false,
      itemTitle: item.title || "",
      itemPoster: item.poster || "",
      itemTier: item.tier || "",
      itemType: item.type || "",
      itemGenres: item.genres || [],
      itemStremioId: item.stremioId || null,
      itemJikanId: item.jikanId || null,
      itemMalId: item.malId || null,
      itemLink: item.link || "",
      senderNote: note,
    });
    await batch.commit();
    showToast("Recommendation sent!", "success");
    closeRecommendModal();
  } catch (e) {
    handleFirestoreError(e, "create", "notifications");
  }
});

export const sendFriendReq = (window.sendFriendReq = async (
  targetUid,
  targetUsername,
) => {
  try {
    const batch = writeBatch(db);
    const myUid = auth.currentUser.uid;
    batch.set(doc(db, "users", myUid, "friends", targetUid), {
      status: "pending_sent",
      since: Date.now(),
    });
    batch.set(doc(db, "users", targetUid, "friends", myUid), {
      status: "pending_received",
      since: Date.now(),
    });

    const notifRef = doc(collection(db, "users", targetUid, "notifications"));
    batch.set(notifRef, {
      type: "friend_request",
      fromUid: myUid,
      fromUsername: window.socialProfile?.username || "User",
      sentAt: Date.now(),
      read: false,
    });
    await batch.commit();
    showToast("Request sent!", "success");
    const dd = document.getElementById("socialSearchDropdown");
    if (dd) dd.style.display = "none";
    const inp = document.getElementById("socialSearchInput");
    if (inp) inp.value = "";
  } catch (e) {
    handleFirestoreError(e, "create", "friends");
  }
});

export const initAdminPanel = (window.initAdminPanel = async () => {
  try {
    const qSnap = await getDocs(collectionGroup(db, "profile"));
    const users = qSnap.docs.map((d) => {
      let data = d.data();
      let uid = d.ref.parent.parent ? d.ref.parent.parent.id : "";
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
                      <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px">@${u.username} ${u.displayUsername && u.displayUsername !== u.username ? "(" + u.displayUsername + ")" : ""}</div>
                      <div style="font-size:12px; color:var(--text-muted)">${u.email || "No email"} | UID: ${u.uid}</div>
                  </div>
                  <button class="btn btn-primary btn-sm" onclick="window.viewFriendLibrary('${u.uid}', '${(u.displayUsername || u.username).replace(/'/g, "\\'")}')">View Codex</button>
              </div>
         `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Failed collectionGroup Profile", err);
    try {
      const usernamesSnap = await getDocs(collection(db, "usernames"));
      const users = [];
      for (let d of usernamesSnap.docs) {
        let uid = d.data().uid;
        let un = d.id;
        users.push({ uid, username: un });
      }
      const list = document.getElementById("adminUserList");
      if (list) {
        document.getElementById("adminTotalUsers").textContent = users.length;
        list.innerHTML = users
          .map(
            (u) => `
                  <div class="stat-card" style="display:flex; justify-content:space-between; align-items:center; flex-direction:row;">
                      <div>
                          <div style="font-weight:600; color:var(--text-primary); margin-bottom:4px">@${u.username}</div>
                          <div style="font-size:12px; color:var(--text-muted)">UID: ${u.uid}</div>
                      </div>
                      <button class="btn btn-primary btn-sm" onclick="window.viewFriendLibrary('${u.uid}', '${u.username.replace(/'/g, "\\'")}')">View Codex</button>
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

export function setupSocialListeners() {
  const searchInput = document.getElementById("socialSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", async (e) => {
      const q = e.target.value.trim().toLowerCase();
      const res = document.getElementById("socialSearchDropdown");
      if (!res) return;
      if (q.length < 3) {
        res.style.display = "none";
        return;
      }

      try {
        const docRef = doc(db, "usernames", q);
        const snap = await getDoc(docRef);
        res.style.display = "block";
        if (snap.exists()) {
          const uid = snap.data().uid;
          if (uid === auth.currentUser?.uid) {
            res.innerHTML = `<div style="padding:10px; color:var(--text-muted); font-size:13px;">This is you!</div>`;
            return;
          }
          const pSnap = await getDoc(doc(db, "users", uid, "profile", "main"));
          if (pSnap.exists() && pSnap.data().showInSearch !== false) {
            const u = pSnap.data();
            const existingReq = (window.socialFriends || []).find(
              (f) => f.id === uid,
            );
            let btn = `<button class="btn btn-primary btn-sm" onclick="window.sendFriendReq('${uid}', '${u.username}')">Add Friend</button>`;
            if (existingReq) {
              if (existingReq.status === "accepted")
                btn = `<span style="color:var(--success); font-size:12px; font-weight:700;">Friends ✓</span>`;
              else if (existingReq.status === "pending_sent")
                btn = `<span style="color:var(--text-muted); font-size:12px;">Request Sent</span>`;
              else if (existingReq.status === "pending_received")
                btn = `<button class="btn btn-primary btn-sm" onclick="window.acceptFriend('${uid}', '${u.username}')">Accept</button>`;
            } else if (u.allowRequests === false) {
              btn = `<span style="color:var(--danger); font-size:12px;">Not accepting requests</span>`;
            }

            res.innerHTML = `
                <div style="padding:10px; display:flex; align-items:center; gap:10px;">
                    <div class="friend-avatar" style="background:${getColorForString(u.username)}; width:36px; height:36px; font-size:16px; margin:0;">${u.username[0].toUpperCase()}</div>
                    <div style="flex:1;">
                        <div style="font-weight:700; font-size:14px;">${u.displayUsername || u.username}</div>
                        <div style="color:var(--text-muted); font-size:11px;">@${u.username}</div>
                    </div>
                    ${btn}
                </div>
            `;
          } else {
            res.innerHTML = `<div style="padding:10px; color:var(--text-muted); font-size:13px;">User not found or hidden.</div>`;
          }
        } else {
          res.innerHTML = `<div style="padding:10px; color:var(--text-muted); font-size:13px;">No users found with exactly that username.</div>`;
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  const setupInput = document.getElementById("setupUsername");
  if (setupInput) {
    setupInput.addEventListener("keydown", (e) => {
      if (e.key === " ") e.preventDefault();
    });

    setupInput.addEventListener("input", (e) => {
      const val = e.target.value.toLowerCase().trim();
      const stat = document.getElementById("setupUsernameStatus");
      const btn = document.getElementById("btnSetUsername");
      if (!stat || !btn) return;
      if (val.length < 3 || val.length > 20 || !/^[a-zA-Z0-9_]+$/.test(val)) {
        stat.textContent = "Must be 3-20 letters/numbers/underscores.";
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
                    email: auth.currentUser.email,
                    friendCode: numericCode,
                    joinedAt: Date.now(),
                    libraryPublic: "public",
                    allowRequests: true,
                    showInSearch: true,
                  },
                  { merge: true },
                );
                await batch.commit();
                showToast("Setup complete!", "success");
              } catch (err) {
                btn.disabled = false;
                stat.textContent = "Failed to save username. Try again.";
                stat.style.color = "var(--danger)";
                handleFirestoreError(err, "write", "usernames/profile");
              }
            };
          }
        } catch (err) {
          console.error(err);
          stat.textContent = "Error checking availability.";
          stat.style.color = "var(--danger)";
        }
      }, 500);
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
      const prompt = document.getElementById("socialSetupPrompt");
      const content = document.getElementById("socialAppContent");
      const unDisplay = document.getElementById("userUsernameDisplay");

      if (!snap.exists() || !snap.data().username) {
        if (prompt) prompt.style.display = "flex";
        if (content) content.style.display = "none";
        window.socialProfile = null;
        if (unDisplay) unDisplay.textContent = "";
      } else {
        window.socialProfile = snap.data();
        if (prompt) prompt.style.display = "none";
        if (content) content.style.display = "block";
        if (unDisplay)
          unDisplay.textContent = "@" + window.socialProfile.username;

        if (window.unsubscribeFriends) window.unsubscribeFriends();
        window.unsubscribeFriends = onSnapshot(
          collection(db, "users", uid, "friends"),
          async (qSnap) => {
            const fs = await Promise.all(
              qSnap.docs.map(async (d) => {
                let obj = { id: d.id, ...d.data() };
                try {
                  const pf = await getDoc(
                    doc(db, "users", obj.id, "profile", "main"),
                  );
                  if (pf.exists()) {
                    obj.username = pf.data().username;
                    if (!obj.nickname && pf.data().displayUsername)
                      obj.username = pf.data().displayUsername;
                    obj.email = pf.data().email;
                  }
                } catch (e) {}
                return obj;
              }),
            );
            window.socialFriends = fs;
            renderPendingRequests();
            renderFriendsGrid();
          },
          (error) => {
            handleFirestoreError(error, "get", "users/[uid]/friends");
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
            handleFirestoreError(error, "get", "users/[uid]/notifications");
          },
        );
      }
    },
    (error) => {
      handleFirestoreError(error, "get", "users/[uid]/profile/main");
    },
  );
});
