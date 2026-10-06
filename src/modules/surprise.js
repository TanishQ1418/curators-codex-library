// ── SURPRISE ME PICKER MODULE ─────────────────────────────────────

export const openSurpriseModal = (window.openSurpriseModal = () => {
  const wrap = document.getElementById("surpriseGenrePills");
  if (!wrap) return;
  const genres = new Set();
  (window.library || []).forEach((e) => {
    if (e.genres) e.genres.forEach((g) => genres.add(g));
  });

  wrap.innerHTML = Array.from(genres)
    .sort()
    .map(
      (g) => `
    <div class="genre-toggle-pill" onclick="this.classList.toggle('selected')">${g}</div>
`,
    )
    .join("");
  const res = document.getElementById("surpriseResult");
  if (res) res.innerHTML = "";
  document.getElementById("surpriseModalOverlay")?.classList.add("open");
});

export const closeSurpriseModal = (window.closeSurpriseModal = () => {
  document.getElementById("surpriseModalOverlay")?.classList.remove("open");
});

export const pickSurprise = (window.pickSurprise = () => {
  const statusEl = document.getElementById("surpriseStatus");
  const status = statusEl ? statusEl.value : "";
  const selectedGenres = Array.from(
    document.querySelectorAll(".genre-toggle-pill.selected"),
  ).map((el) => el.textContent.trim());

  let pool = (window.library || []).filter((l) => {
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
  resDiv.innerHTML = `
    <div class="surprise-result" onclick="window.openDetailModal('${pick.id}')" style="cursor:pointer">
        <div class="surprise-poster"><img src="${pick.poster}" onerror="this.outerHTML='🎬'" /></div>
        <div>
            <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;letter-spacing:1px">YOUR NEXT WATCH:</div>
            <div style="font-family:var(--font-display);font-size:20px;color:var(--text-primary);letter-spacing:1px;line-height:1">${pick.title}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:6px">${pick.type} • ${pick.year || "N/A"}</div>
        </div>
    </div>
  `;
});
