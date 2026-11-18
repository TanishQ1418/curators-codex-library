// ── SURPRISE ME PICKER MODULE ─────────────────────────────────────

import {
  esc,
  safeUrl,
  registerActions,
  openOverlay,
  closeOverlay,
} from "../utils/helpers.js";

export const openSurpriseModal = (window.openSurpriseModal = () => {
  const wrap = document.getElementById("surpriseGenrePills");
  if (!wrap) return;
  const genres = new Set();
  (window.library || []).forEach((e) => {
    if (Array.isArray(e.genres)) e.genres.forEach((g) => g && genres.add(g));
  });

  wrap.innerHTML = Array.from(genres)
    .sort()
    .map(
      (g) =>
        `<button type="button" class="genre-toggle-pill" data-act="toggleSurpriseGenre">${esc(g)}</button>`,
    )
    .join("");
  const res = document.getElementById("surpriseResult");
  if (res) res.innerHTML = "";
  openOverlay("surpriseModalOverlay");
});

export const closeSurpriseModal = (window.closeSurpriseModal = () => {
  closeOverlay("surpriseModalOverlay");
});

export const pickSurprise = (window.pickSurprise = () => {
  const statusEl = document.getElementById("surpriseStatus");
  const status = statusEl ? statusEl.value : "";
  const selectedGenres = Array.from(
    document.querySelectorAll(".genre-toggle-pill.selected"),
  ).map((el) => el.textContent.trim());

  const pool = (window.library || []).filter((l) => {
    if (status && l.status !== status) return false;
    if (
      selectedGenres.length > 0 &&
      !(l.genres && selectedGenres.some((g) => l.genres.includes(g)))
    )
      return false;
    return true;
  });

  const resDiv = document.getElementById("surpriseResult");
  if (!resDiv) return;
  if (!pool.length) {
    resDiv.innerHTML = `<div style="text-align:center;padding:10px;color:var(--danger)">No entries match these filters!</div>`;
    return;
  }

  const pick = pool[Math.floor(Math.random() * pool.length)];
  const poster = safeUrl(pick.poster);
  const safeId = esc(String(pick.id || ""));
  resDiv.innerHTML = `
    <div class="surprise-result" data-act="openDetail" data-id="${safeId}" style="cursor:pointer">
        <div class="surprise-poster">${
          poster
            ? `<img src="${esc(poster)}" alt="${esc(pick.title)} poster" referrerpolicy="no-referrer" data-fallback="emoji" />`
            : "🎬"
        }</div>
        <div>
            <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;letter-spacing:1px">YOUR NEXT WATCH:</div>
            <div style="font-family:var(--font-display);font-size:20px;color:var(--text-primary);letter-spacing:1px;line-height:1">${esc(pick.title)}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">${esc(pick.type)} • ${esc(pick.year || "N/A")}</div>
        </div>
    </div>
  `;
});

registerActions({
  toggleSurpriseGenre: (_d, el) => el?.classList.toggle("selected"),
});
