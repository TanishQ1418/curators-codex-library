// ── DISCOVERY & RECOMMENDATION ENGINE MODULE ────────────────────────

import { fetchJikan } from "../services/api.js";

export let currentDiscoverType = "anime";
let pendingBucketPromise = null;
let discoverObserver = null;
let discoverCache = {};
let tasteCache = null;

export const switchDiscoverType = (window.switchDiscoverType = (type) => {
  currentDiscoverType = type;
  document
    .querySelectorAll(".discover-pill")
    .forEach((el) =>
      el.classList.toggle("active", el.dataset.type === type),
    );
  renderDiscover(true);
});

export const getTasteProfile = (window.getTasteProfile = () => {
  const scores = {};
  const yearBuckets = {
    "classic (<2000)": 0,
    "2000s": 0,
    "2010s": 0,
    "recent (>=2020)": 0,
  };
  const statuses = {
    Completed: 1.5,
    Watching: 1.2,
    "Plan to Watch": 1.0,
    "On Hold": 0.5,
    Dropped: -1.0,
    "": 1.0,
  };
  const tiers = { S: 5, A: 4, B: 3, C: 1, D: -1, E: -2, F: -3, "": 1 };

  (window.library || []).forEach((l) => {
    const tierVal = tiers[l.tier] !== undefined ? tiers[l.tier] : 1;
    const statusVal =
      statuses[l.status] !== undefined ? statuses[l.status] : 1.0;
    let w = tierVal * statusVal;
    if (l.genres) {
      l.genres.forEach((g) => {
        scores[g] = (scores[g] || 0) + w;
      });
    }

    if (l.year) {
      if (l.year < 2000) yearBuckets["classic (<2000)"] += w;
      else if (l.year < 2010) yearBuckets["2000s"] += w;
      else if (l.year < 2020) yearBuckets["2010s"] += w;
      else yearBuckets["recent (>=2020)"] += w;
    }
  });

  const rejections = window.getRejections
    ? window.getRejections()
    : { genres: {}, timestamps: {} };
  const now = Date.now();
  Object.keys(rejections.genres || {}).forEach((g) => {
    if (scores[g]) {
      let penalty = rejections.genres[g] * 1.5;
      const ts = rejections.timestamps[g] || 0;
      if (now - ts > 60 * 24 * 60 * 60 * 1000) {
        penalty = penalty * 0.5;
      }
      scores[g] -= penalty;
    }
  });

  return {
    genres: Object.entries(scores).sort((a, b) => b[1] - a[1]),
    years: yearBuckets,
  };
});

export const isSequelOrRelated = (window.isSequelOrRelated = (
  title,
  libraryTitlesSet,
) => {
  if (!title) return false;
  const tLower = title.toLowerCase().trim();
  if (libraryTitlesSet.has(tLower)) return true;

  const getBase = (str) => {
    return str
      .replace(
        /(?:\s*(?:the\s+)?\d+(?:st|nd|rd|th)\s+)?(?:season|part|cour|chapter|movie)(?:\s+\d+)?(?:\s*p(?:ar)?t\s*\d+)?/gi,
        "",
      )
      .replace(/:\s*.*$/, "")
      .replace(/[-~]\s*.*$/, "")
      .replace(/\s+(?:ii|iii|iv|v|vi|vii|\d+)(?:\s+part\s+\d+)?$/i, "")
      .replace(/!+$/, "")
      .trim();
  };
  const baseNew = getBase(tLower);
  if (baseNew.length < 4) return false;

  for (const libTit of libraryTitlesSet) {
    const baseLib = getBase(libTit);
    if (
      baseLib === baseNew ||
      (baseLib.length > 5 &&
        (tLower.startsWith(baseLib) || libTit.startsWith(baseNew)))
    ) {
      return true;
    }
  }
  return false;
});

export const getRejections = (window.getRejections = () => {
  const stored = localStorage.getItem("codex_rejected");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        ids: new Set(parsed.ids || []),
        genres: parsed.genres || {},
        timestamps: parsed.timestamps || {},
      };
    } catch (e) {}
  }
  return { ids: new Set(), genres: {}, timestamps: {} };
});

const saveRejections = (rej) => {
  if (rej.ids.size > 500) {
    const idsArray = Array.from(rej.ids);
    const oldest = idsArray.slice(0, idsArray.length - 500);
    oldest.forEach((id) => rej.ids.delete(id));
  }
  localStorage.setItem(
    "codex_rejected",
    JSON.stringify({
      ids: Array.from(rej.ids),
      genres: rej.genres,
      timestamps: rej.timestamps,
    }),
  );
};

export const rejectItem = (window.rejectItem = (
  e,
  cardEl,
  itemSrcId,
  genresStr,
) => {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  if (!cardEl) return;
  cardEl.style.pointerEvents = "none";
  cardEl.style.transform = "scale(0.92)";
  cardEl.style.opacity = "0";

  setTimeout(() => {
    cardEl.remove();
  }, 260);

  const rej = getRejections();
  rej.ids.add(itemSrcId);
  const genres = genresStr ? genresStr.split(",") : [];
  genres.forEach((g) => {
    rej.genres[g] = (rej.genres[g] || 0) + 1;
    rej.timestamps[g] = Date.now();
  });
  saveRejections(rej);

  const t = document.createElement("div");
  t.className = "toast toast-success";
  t.innerHTML = `Removed. <span style="text-decoration:underline; cursor:pointer;" onclick="window.undoRejectItem('${itemSrcId}', '${genresStr}', this)">Undo?</span>`;
  document.getElementById("toast-container")?.appendChild(t);
  setTimeout(() => {
    if (t.parentElement) {
      t.classList.add("toast-dismiss");
      setTimeout(() => t.remove(), 300);
    }
  }, 4000);
});

export const undoRejectItem = (window.undoRejectItem = (
  itemSrcId,
  genresStr,
  el,
) => {
  const rej = getRejections();
  rej.ids.delete(itemSrcId);
  const genres = genresStr ? genresStr.split(",") : [];
  genres.forEach((g) => {
    if (rej.genres[g]) {
      rej.genres[g] = Math.max(0, rej.genres[g] - 1);
    }
  });
  saveRejections(rej);

  if (el && el.parentElement) {
    el.parentElement.innerHTML = "Restored. Refresh Picks to see it again.";
  }
});

export const scrollRow = (window.scrollRow = (rowId, direction) => {
  const track = document.getElementById(`track-${rowId}`);
  if (track) {
    const scrollAmount = track.clientWidth * 0.8;
    track.scrollBy({
      left: scrollAmount * direction,
      behavior: "smooth",
    });
  }
});

export const handleRowWheel = (window.handleRowWheel = (e) => {
  const track = e.currentTarget;
  if (
    Math.abs(e.deltaX) === 0 &&
    Math.abs(e.deltaY) > 0 &&
    track.scrollWidth > track.clientWidth
  ) {
    const atLeft = track.scrollLeft <= 0;
    const atRight =
      Math.ceil(track.scrollLeft + track.clientWidth) >= track.scrollWidth - 1;

    if (!((atLeft && e.deltaY < 0) || (atRight && e.deltaY > 0))) {
      e.preventDefault();
      track.scrollLeft += e.deltaY;
    }
  }
});

const createRowHTML = (rowId, title) => {
  return `
    <div class="discover-row" id="row-${rowId}" data-type="${rowId}" data-page="1" data-loading="false" data-exhausted="false">
       <div class="discover-row-title">${title}</div>
       <div class="row-track-container">
           <div class="row-track" id="track-${rowId}" onwheel="window.handleRowWheel(event)">
               ${Array(6)
                 .fill()
                 .map(() => `<div class="skeleton-card dom-skel"></div>`)
                 .join("")}
           </div>
       </div>
       <div class="row-nav-controls">
           <button class="row-nav-btn" onclick="window.scrollRow('${rowId}', -1)">‹</button>
           <button class="row-nav-btn" onclick="window.scrollRow('${rowId}', 1)">›</button>
       </div>
    </div>
  `;
};

const createCardHTML = (r) => {
  const titleSafe = (r.title || "")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
  const genresStr = (r.genres || []).join(",");
  const srcId = r.id;
  const exists = (window.library || []).find(
    (l) => (l.title || "").toLowerCase() === (r.title || "").toLowerCase(),
  );

  return `
    <div class="rec-card" data-srcid="${srcId}">
      ${!exists ? `<div class="not-interested-btn" onclick="window.rejectItem(event, this.closest('.rec-card'), '${srcId}', '${genresStr}')">✕</div>` : ""}
      ${r.score && r.score !== "0.0" && r.score !== "N/A" ? `<div class="rec-score">⭐ ${r.score}</div>` : ""}
      ${exists ? `<div class="rec-owned">✓ IN LIBRARY</div>` : ""}
      <div class="rec-card-poster"><img src="${r.poster}" loading="lazy" onerror="this.outerHTML='🎬'" /></div>
      <div class="rec-card-overlay" onclick="window.prepareAddFromDiscover('${titleSafe}', '${r.poster}')">
        <div class="rec-overlay-title">${r.title}</div>
        <div class="rec-overlay-genres">${(r.genres || [])
          .slice(0, 3)
          .map(
            (g) =>
              `<span style="font-size:10px;padding:2px 5px;background:rgba(255,255,255,0.15);border-radius:3px;">${g}</span>`,
          )
          .join("")}</div>
        <button class="rec-overlay-add ${exists ? "added" : ""}" 
                onclick="event.stopPropagation();${exists ? "" : `window.prepareAddFromDiscover('${titleSafe}', '${r.poster}')`}">
          ${exists ? "Already Added" : "Add to Codex"}
        </button>
      </div>
    </div>
  `;
};

const getTopSTier = () => {
  let sTier = (window.library || []).filter((l) => l.tier === "S");
  if (currentDiscoverType === "movie") {
    let mTier = sTier.filter((l) => l.type === "Movie");
    if (mTier.length > 0) sTier = mTier;
  } else if (currentDiscoverType === "series") {
    let sTierFiltered = sTier.filter(
      (l) => l.type === "Web Series" || l.type === "Series",
    );
    if (sTierFiltered.length > 0) sTier = sTierFiltered;
  } else {
    let aTier = sTier.filter(
      (l) =>
        l.type !== "Movie" && l.type !== "Web Series" && l.type !== "Series",
    );
    if (aTier.length > 0) sTier = aTier;
  }

  if (sTier.length === 0)
    sTier = (window.library || []).filter((l) => {
      if (currentDiscoverType === "movie") return l.type === "Movie";
      if (currentDiscoverType === "series")
        return l.type === "Web Series" || l.type === "Series";
      return (
        l.type !== "Movie" && l.type !== "Web Series" && l.type !== "Series"
      );
    });

  if (sTier.length === 0) return null;
  return [...sTier].sort(() => 0.5 - Math.random())[0];
};

const getGenreIdsMap = () => ({
  action: 1,
  adventure: 2,
  comedy: 4,
  drama: 8,
  fantasy: 10,
  horror: 14,
  mystery: 17,
  romance: 22,
  "sci-fi": 24,
  "slice of life": 36,
  sports: 30,
  supernatural: 37,
  suspense: 41,
  thriller: 41,
});

const buildNonAnimeBuckets = async (type) => {
  let pool = [];
  if (type === "series") {
    const rPage = Math.floor(Math.random() * 5);
    const promises = [
      rPage,
      rPage + 1,
      rPage + 2,
      rPage + 3,
      rPage + 4,
      rPage + 5,
    ].map((p) =>
      fetch(`https://api.tvmaze.com/shows?page=${p}`)
        .then((r) => r.json())
        .catch(() => []),
    );
    const res = await Promise.all(promises);
    res.forEach((d) => {
      if (d && Array.isArray(d)) {
        pool = pool.concat(
          d.map((item) => ({
            id: `tvmaze_${item.id}`,
            title: item.name,
            poster: item.image?.original || item.image?.medium || "",
            genres: item.genres || [],
            score: (item.rating?.average || 0).toFixed(1),
            year: item.premiered ? parseInt(item.premiered.split("-")[0]) : 2000,
          })),
        );
      }
    });
  } else {
    const rSkip = Math.floor(Math.random() * 5) * 50;
    const promises = [
      0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550,
    ].map((skipVal) =>
      fetch(
        `https://v3-cinemeta.strem.io/catalog/movie/top/skip=${rSkip + skipVal}.json`,
      )
        .then((r) => r.json())
        .catch(() => ({})),
    );
    const res = await Promise.all(promises);
    res.forEach((d) => {
      if (d && d.metas) {
        pool = pool.concat(
          d.metas.map((item) => ({
            id: item.imdb_id ? `imdb_${item.imdb_id}` : `cinemeta_${item.id}`,
            title: item.name || "Unknown Title",
            poster: item.poster || "",
            genres: item.genre || [],
            score: item.imdbRating || "0.0",
            year: parseInt(item.year) || 2000,
          })),
        );
      }
    });
  }

  const buckets = {
    r_recommended: [],
    r0_personalized: [],
    r1_loved: [],
    r2_trending: [],
    r3_top_genre1: [],
    r4_top_genre2: [],
    r5_hidden: [],
    r6_expand: [],
    r7_era: [],
    r8_acclaimed: [],
  };

  const tp = tasteCache || getTasteProfile();
  const topG1 = (tp.genres[0] ? tp.genres[0][0] : "").toLowerCase();
  const topG2 = (tp.genres[1] ? tp.genres[1][0] : "").toLowerCase();
  const sTierMatch = getTopSTier();
  const lovedGenres =
    sTierMatch && sTierMatch.genres
      ? sTierMatch.genres.map((g) => g.toLowerCase())
      : [];

  const personalizedGenresSet = new Set();
  (window.library || []).forEach((l) => {
    let matchType = false;
    if (type === "movie" && l.type === "Movie") matchType = true;
    else if (
      type === "series" &&
      (l.type === "Web Series" || l.type === "Series")
    )
      matchType = true;
    else if (
      type === "anime" &&
      l.type !== "Movie" &&
      l.type !== "Web Series" &&
      l.type !== "Series"
    )
      matchType = true;
    else if (type !== "anime" && type !== "movie" && type !== "series")
      matchType = true;

    if (matchType) {
      if (
        (l.status === "Completed" && (l.tier === "S" || l.tier === "A")) ||
        l.status === "Plan to Watch"
      ) {
        (l.genres || []).forEach((g) =>
          personalizedGenresSet.add(g.toLowerCase()),
        );
      }
    }
  });
  const personalizedGenres = Array.from(personalizedGenresSet);

  pool.sort(
    (a, b) => parseFloat(b.score || 0) - parseFloat(a.score || 0),
  );

  pool.forEach((item) => {
    const ig = (item.genres || []).map((g) => g.toLowerCase());
    const sc = parseFloat(item.score || 0);

    if (
      (ig.includes(topG1) || ig.includes(topG2)) &&
      sc >= 8.0 &&
      buckets["r_recommended"].length < 300
    ) {
      buckets["r_recommended"].push(item);
    }

    if (
      ig.some((g) => personalizedGenres.includes(g)) &&
      buckets["r0_personalized"].length < 300
    )
      buckets["r0_personalized"].push(item);

    if (
      ig.some((g) => lovedGenres.includes(g)) &&
      buckets["r1_loved"].length < 300
    )
      buckets["r1_loved"].push(item);
    if (item.year >= 2023 && buckets["r2_trending"].length < 300)
      buckets["r2_trending"].push(item);
    if (ig.includes(topG1) && buckets["r3_top_genre1"].length < 300)
      buckets["r3_top_genre1"].push(item);
    if (ig.includes(topG2) && buckets["r4_top_genre2"].length < 300)
      buckets["r4_top_genre2"].push(item);

    if (sc >= 7.5 && sc <= 8.5 && buckets["r5_hidden"].length < 300)
      buckets["r5_hidden"].push(item);

    const excluded = tp.genres.slice(0, 3).map((g) => g[0].toLowerCase());
    if (
      !ig.some((g) => excluded.includes(g)) &&
      sc >= 7.0 &&
      buckets["r6_expand"].length < 300
    )
      buckets["r6_expand"].push(item);

    let highestBucket = Object.keys(tp.years).reduce(
      (a, b) => (tp.years[a] > tp.years[b] ? a : b),
      "recent (>=2020)",
    );
    let targetYear = 2021;
    if (highestBucket.includes("classic")) targetYear = 1995;
    else if (highestBucket.includes("2000s")) targetYear = 2005;
    else if (highestBucket.includes("2010s")) targetYear = 2015;
    if (
      item.year >= targetYear - 4 &&
      item.year <= targetYear + 4 &&
      buckets["r7_era"].length < 300
    )
      buckets["r7_era"].push(item);

    if (sc >= 8.5 && buckets["r8_acclaimed"].length < 300)
      buckets["r8_acclaimed"].push(item);
  });

  Object.values(buckets).forEach((b) => b.sort(() => 0.5 - Math.random()));
  return buckets;
};

const fetchDiscoverRow = async (rowType, page) => {
  if (currentDiscoverType !== "anime") {
    if (!discoverCache[currentDiscoverType + "_buckets"]) {
      if (!pendingBucketPromise) {
        pendingBucketPromise = buildNonAnimeBuckets(currentDiscoverType).then(
          (res) => {
            discoverCache[currentDiscoverType + "_buckets"] = res;
            pendingBucketPromise = null;
            return res;
          },
        );
      }
      await pendingBucketPromise;
    }
    const bucket =
      discoverCache[currentDiscoverType + "_buckets"][rowType] || [];
    return bucket.slice((page - 1) * 25, page * 25);
  }

  const tP = tasteCache || getTasteProfile();
  tasteCache = tP;

  const topGenres = tP.genres.map((g) => g[0].toLowerCase());
  const gMap = getGenreIdsMap();
  const pMod = page + (window.animeBasePages?.[rowType] || 0);

  let url = "";

  if (rowType === "r_recommended") {
    const g1 = topGenres.length > 0 ? gMap[topGenres[0]] : null;
    if (g1) {
      url = `https://api.jikan.moe/v4/anime?type=tv&genres=${g1}&order_by=score&sort=desc&min_score=8.0&limit=25&page=${pMod}`;
    } else {
      url = `https://api.jikan.moe/v4/top/anime?type=tv&limit=25&page=${pMod}`;
    }
  } else if (rowType === "r0_personalized") {
    const freq = {};
    (window.library || []).forEach((l) => {
      let matchType = false;
      if (currentDiscoverType === "movie" && l.type === "Movie")
        matchType = true;
      else if (
        currentDiscoverType === "series" &&
        (l.type === "Web Series" || l.type === "Series")
      )
        matchType = true;
      else if (
        currentDiscoverType === "anime" &&
        l.type !== "Movie" &&
        l.type !== "Web Series" &&
        l.type !== "Series"
      )
        matchType = true;

      if (matchType) {
        if (
          (l.status === "Completed" && (l.tier === "S" || l.tier === "A")) ||
          l.status === "Plan to Watch"
        ) {
          (l.genres || []).forEach((g) => {
            const gLower = g.toLowerCase();
            freq[gLower] = (freq[gLower] || 0) + 1;
          });
        }
      }
    });
    const sorted = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    const gIds = sorted
      .slice(0, 3)
      .map((g) => gMap[g])
      .filter(Boolean)
      .join(",");
    if (!gIds) {
      if (topGenres.length > 0 && gMap[topGenres[0]]) {
        url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gMap[topGenres[0]]}&order_by=popularity&sort=asc&min_score=7.0&limit=25&page=${pMod}`;
      } else {
        url = `https://api.jikan.moe/v4/anime?type=tv&order_by=popularity&sort=asc&min_score=8.5&limit=25&page=${pMod}`;
      }
    } else {
      url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gIds}&order_by=popularity&sort=asc&min_score=7.0&limit=25&page=${pMod}`;
    }
  } else if (rowType === "r1_loved") {
    const topTitle = getTopSTier();
    if (!topTitle || !topTitle.genres || topTitle.genres.length === 0) {
      url = `https://api.jikan.moe/v4/seasons/now?page=${pMod}&limit=25`;
    } else {
      const gIds = topTitle.genres
        .map((g) => gMap[g.toLowerCase()])
        .filter((x) => x)
        .join(",");
      if (!gIds) {
        url = `https://api.jikan.moe/v4/seasons/now?page=${pMod}&limit=25`;
      } else {
        url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gIds}&order_by=popularity&sort=asc&min_score=7.5&limit=25&page=${pMod}`;
      }
    }
  } else if (rowType === "r2_trending") {
    url = `https://api.jikan.moe/v4/seasons/now?page=${pMod}&limit=25`;
  } else if (rowType === "r_trending_global") {
    url = `kitsu_trending_${pMod}`;
  } else if (rowType === "r3_top_genre1") {
    if (topGenres.length < 1 || !gMap[topGenres[0]]) {
      url = `https://api.jikan.moe/v4/anime?type=tv&order_by=score&sort=desc&min_score=8.0&limit=25&page=${pMod}`;
    } else {
      const gid = gMap[topGenres[0]];
      url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gid}&order_by=popularity&sort=asc&min_score=7.5&limit=25&page=${pMod}`;
    }
  } else if (rowType === "r4_top_genre2") {
    if (topGenres.length < 2 || !gMap[topGenres[1]]) {
      url = `https://api.jikan.moe/v4/anime?type=tv&order_by=favorites&sort=desc&limit=25&page=${pMod}`;
    } else {
      const gid = gMap[topGenres[1]];
      url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gid}&order_by=popularity&sort=asc&min_score=7.5&limit=25&page=${pMod}`;
    }
  } else if (rowType === "r5_hidden") {
    url = `https://api.jikan.moe/v4/anime?type=tv&order_by=score&sort=desc&min_score=8.2&max_score=8.8&limit=25&page=${pMod}`;
  } else if (rowType === "r6_expand") {
    const excluded = topGenres.slice(0, 3);
    const allG = Object.keys(gMap);
    const avail = allG.filter((g) => !excluded.includes(g));
    if (avail.length === 0) {
      url = `https://api.jikan.moe/v4/anime?type=tv&order_by=popularity&sort=asc&min_score=8.0&limit=25&page=${pMod}`;
    } else {
      const ran = avail[Math.floor(Math.random() * avail.length)];
      const gid = gMap[ran];
      url = `https://api.jikan.moe/v4/anime?type=tv&genres=${gid}&order_by=popularity&sort=asc&min_score=7.5&limit=25&page=${pMod}`;
    }
  } else if (rowType === "r7_era") {
    let buckets = tP.years || {};
    let targetYear = 2021;
    if (Object.keys(buckets).length > 0) {
      let highest = Object.keys(buckets).reduce(
        (a, b) => (buckets[a] > buckets[b] ? a : b),
        "recent (>=2020)",
      );
      if (highest.includes("classic")) targetYear = 1995;
      else if (highest.includes("2000s")) targetYear = 2005;
      else if (highest.includes("2010s")) targetYear = 2015;
    }
    url = `https://api.jikan.moe/v4/anime?type=tv&start_date=${targetYear - 3}-01-01&end_date=${targetYear + 3}-12-31&order_by=popularity&sort=asc&min_score=7.5&limit=25&page=${pMod}`;
  } else if (rowType === "r8_acclaimed") {
    url = `https://api.jikan.moe/v4/top/anime?type=tv&limit=25&page=${pMod}`;
  } else {
    return [];
  }

  const key = url;
  if (discoverCache[key]) {
    return discoverCache[key];
  }

  if (url.startsWith("kitsu_trending")) {
    try {
      const offset = (pMod - 1) * 20;
      const kRes = await fetch(
        `https://kitsu.io/api/edge/trending/anime?limit=20&offset=${offset}`,
      );
      const kData = await kRes.json();
      const mapped = (kData.data || []).map((item) => ({
        id: `kitsu_${item.id}`,
        title: item.attributes.canonicalTitle,
        poster: item.attributes.posterImage?.large || "",
        genres: [],
        score: (
          parseFloat(item.attributes.averageRating || 0) / 10
        ).toFixed(1),
      }));
      discoverCache[key] = mapped;
      return mapped;
    } catch (e) {
      console.error("Kitsu fetch failed", e);
      return [];
    }
  }

  try {
    let res = await fetchJikan(url);
    let data = await res.json();
    let rawData = data.data || [];

    if (rawData.length === 0 && currentDiscoverType === "anime") {
      const fallbackUrl = `https://api.jikan.moe/v4/top/anime?page=${pMod}`;
      res = await fetchJikan(fallbackUrl);
      data = await res.json();
      rawData = data.data || [];
    }

    const mapped = rawData.map((item) => ({
      id: `mal_${item.mal_id}`,
      title: item.title_english || item.title,
      poster: item.images?.jpg?.large_image_url || "",
      genres: item.genres?.map((g) => g.name) || [],
      score: (item.score || 0).toFixed(1),
    }));

    discoverCache[key] = mapped;
    return mapped;
  } catch (e) {
    console.error(e);
    if (currentDiscoverType === "anime") {
      try {
        const fRes = await fetchJikan(`https://api.jikan.moe/v4/seasons/now`);
        const fData = await fRes.json();
        const fRaw = fData.data || [];
        if (fRaw.length > 0) {
          return fRaw.map((item) => ({
            id: `mal_${item.mal_id}`,
            title: item.title_english || item.title,
            poster: item.images?.jpg?.large_image_url || "",
            genres: item.genres?.map((g) => g.name) || [],
            score: (item.score || 0).toFixed(1),
          }));
        }
      } catch (err) {}
      try {
        const kRes = await fetch(
          `https://kitsu.io/api/edge/trending/anime?limit=20`,
        );
        const kData = await kRes.json();
        const kRaw = kData.data || [];
        return kRaw.map((item) => ({
          id: `kitsu_${item.id}`,
          title: item.attributes.canonicalTitle,
          poster: item.attributes.posterImage?.large || "",
          genres: [],
          score: (
            parseFloat(item.attributes.averageRating || 0) / 10
          ).toFixed(1),
        }));
      } catch (kErr) {}
    }
    return [];
  }
};

const loadMoreForRow = async (rowObj) => {
  if (
    rowObj.dataset.loading === "true" ||
    rowObj.dataset.exhausted === "true"
  )
    return;

  const rowType = rowObj.dataset.type;
  let page = parseInt(rowObj.dataset.page);

  rowObj.dataset.loading = "true";
  const track = rowObj.querySelector(".row-track");

  if (page > 1) {
    for (let i = 0; i < 3; i++) {
      let skel = document.createElement("div");
      skel.className = "skeleton-card dom-skel";
      track.insertBefore(skel, track.querySelector(".row-sentinel"));
    }
  }

  const items = await fetchDiscoverRow(rowType, page);

  if (page === 1) track.innerHTML = "";
  track.querySelectorAll(".dom-skel").forEach((e) => e.remove());

  const rejections = getRejections();
  const libTitles = new Set(
    (window.library || []).map((l) => (l.title || "").toLowerCase().trim()),
  );
  const allowSequels =
    document.getElementById("allowSequelsToggle")?.checked;

  let usable = [];
  if (items && items.length > 0) {
    usable = items.filter((it) => {
      let t = (it.title || "").toLowerCase().trim();
      let srcId = it.id;
      if (rejections.ids.has(srcId)) return false;

      if (window._discoverSeenIds && window._discoverSeenIds.has(srcId)) {
        return false;
      }

      if (
        window._discoverSeenBases &&
        isSequelOrRelated(t, window._discoverSeenBases)
      ) {
        return false;
      }

      if (allowSequels) {
        if (libTitles.has(t)) return false;
      } else {
        if (isSequelOrRelated(t, libTitles)) {
          return false;
        }
      }

      if (window._discoverSeenIds) window._discoverSeenIds.add(srcId);
      if (window._discoverSeenBases) window._discoverSeenBases.add(t);
      return true;
    });
  }

  if (usable.length > 0) {
    const sentinel = track.querySelector(".row-sentinel");
    usable.forEach((u) => {
      const tpl = document.createElement("template");
      tpl.innerHTML = createCardHTML(u).trim();
      if (sentinel) track.insertBefore(tpl.content.firstChild, sentinel);
      else track.appendChild(tpl.content.firstChild);
    });
    rowObj.dataset.page = (page + 1).toString();
  }

  if (!track.querySelector(".row-sentinel")) {
    let sent = document.createElement("div");
    sent.className = "row-sentinel";
    track.appendChild(sent);
    if (discoverObserver) discoverObserver.observe(sent);
  }

  const cardsLimit = rowObj.querySelectorAll(".rec-card:not(.dom-skel)").length;
  if (
    items.length === 0 ||
    cardsLimit >= 200 ||
    (usable.length === 0 && items.length < 20)
  ) {
    rowObj.dataset.exhausted = "true";
    const sent = track.querySelector(".row-sentinel");
    if (sent) sent.remove();

    let end = document.createElement("div");
    end.className = "row-exhausted-indicator";
    end.innerText = "· end ·";
    track.appendChild(end);

    if (page === 1 && cardsLimit === 0) {
      rowObj.style.display = "none";
    }
  } else if (usable.length === 0 && items.length > 0) {
    rowObj.dataset.page = (page + 1).toString();
    rowObj.dataset.loading = "false";
    loadMoreForRow(rowObj);
    return;
  }

  rowObj.dataset.loading = "false";
};

export const renderDiscover = (window.renderDiscover = async (
  forceRefresh = false,
) => {
  const container = document.getElementById("discoverRowsContainer");
  const sourceLabel = document.getElementById("discoverSourceLabel");
  if (!container) return;

  if (sourceLabel) {
    if (currentDiscoverType === "anime") {
      sourceLabel.textContent = "Sourced from MyAnimeList (Jikan v4)";
    } else if (currentDiscoverType === "movie") {
      sourceLabel.textContent = "Sourced from iTunes Store / TMDb";
    } else {
      sourceLabel.textContent = "Sourced from TVMaze / Trakt";
    }
  }

  if (forceRefresh) {
    discoverCache = {};
    tasteCache = null;
    window.animeBasePages = {
      r_recommended: Math.floor(Math.random() * 5) + 1,
      r0_personalized: Math.floor(Math.random() * 8) + 1,
      r1_loved: Math.floor(Math.random() * 8) + 1,
      r2_trending: Math.floor(Math.random() * 2) + 1,
      r3_top_genre1: Math.floor(Math.random() * 10) + 1,
      r4_top_genre2: Math.floor(Math.random() * 10) + 1,
      r5_hidden: Math.floor(Math.random() * 15) + 1,
      r6_expand: Math.floor(Math.random() * 20) + 1,
      r7_era: Math.floor(Math.random() * 10) + 1,
      r8_acclaimed: Math.floor(Math.random() * 10) + 1,
    };
  }

  window._discoverSeenIds = new Set();
  window._discoverSeenBases = new Set();

  const tp = getTasteProfile();
  tasteCache = tp;

  if (!window.animeBasePages) {
    window.animeBasePages = {
      r_recommended: Math.floor(Math.random() * 5) + 1,
      r0_personalized: Math.floor(Math.random() * 8) + 1,
      r1_loved: Math.floor(Math.random() * 8) + 1,
      r2_trending: Math.floor(Math.random() * 2) + 1,
      r3_top_genre1: Math.floor(Math.random() * 10) + 1,
      r4_top_genre2: Math.floor(Math.random() * 10) + 1,
      r5_hidden: Math.floor(Math.random() * 15) + 1,
      r6_expand: Math.floor(Math.random() * 20) + 1,
      r7_era: Math.floor(Math.random() * 10) + 1,
      r8_acclaimed: Math.floor(Math.random() * 10) + 1,
    };
  }

  const tasteEmpty = document.getElementById("tasteEmpty");
  const tasteTags = document.getElementById("tasteTagsContainer");
  if (tp.genres.length > 0) {
    if (tasteEmpty) tasteEmpty.style.display = "none";
    if (tasteTags) {
      tasteTags.innerHTML = tp.genres
        .slice(0, 5)
        .map(
          (t) =>
            `<span style="font-size:11px; font-weight:600; padding:4px 10px; border-radius:6px; background:var(--bg-elevated); border:1px solid var(--border-active); color:var(--text-primary)">${t[0]}</span>`,
        )
        .join("");
    }
  } else {
    if (tasteEmpty) tasteEmpty.style.display = "inline";
    if (tasteTags) tasteTags.innerHTML = "";
  }

  const sTierMatch = getTopSTier();
  const topG1 = tp.genres[0] ? tp.genres[0][0] : "Favorites";
  const topG2 = tp.genres[1] ? tp.genres[1][0] : "Hits";

  const rowsToBuild = [
    {
      id: "r_recommended",
      title: tp.genres.length > 0 ? "RECOMMENDED FOR YOU" : "BEST OF ALL TIME",
    },
    {
      id: "r0_personalized",
      title: tp.genres.length > 0 ? "PERSONALIZED FOR YOU" : "HIGHLY RATED PICKS",
    },
    {
      id: "r1_loved",
      title: sTierMatch
        ? `BECAUSE YOU LOVED ${sTierMatch.title}`
        : "POPULAR RELEASES",
    },
    { id: "r2_trending", title: "TRENDING THIS SEASON" },
    { id: "r_trending_global", title: "GLOBAL TRENDING NOW" },
    {
      id: "r3_top_genre1",
      title: tp.genres[0]
        ? `TOP ${topG1.toUpperCase()} PICKS`
        : "CRITICALLY ACCLAIMED",
    },
    {
      id: "r4_top_genre2",
      title: tp.genres[1]
        ? `TOP ${topG2.toUpperCase()} PICKS`
        : "MOST FAVORITED",
    },
    {
      id: "r5_hidden",
      title: "HIDDEN GEMS — Rated 8+ But Under the Radar",
    },
    {
      id: "r6_expand",
      title:
        tp.genres.length >= 3
          ? "EXPAND YOUR RANGE — Outside Your Usual Genres"
          : "TRENDING NOW",
    },
    { id: "r7_era", title: "FROM YOUR FAVORITE ERA" },
    {
      id: "r8_acclaimed",
      title: "ALL-TIME ESSENTIALS",
    },
  ];

  container.innerHTML = rowsToBuild
    .map((r) => createRowHTML(r.id, r.title))
    .join("");

  if (discoverObserver) discoverObserver.disconnect();

  discoverObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const rowContainer = entry.target.closest(".discover-row");
          if (
            rowContainer &&
            rowContainer.dataset.loading === "false" &&
            rowContainer.dataset.exhausted === "false"
          ) {
            loadMoreForRow(rowContainer);
          }
        }
      });
    },
    { root: null, rootMargin: "0px", threshold: 0.1 },
  );

  const rowKeys = rowsToBuild.map((r) => r.id);
  const top3 = rowKeys.slice(0, 3);
  const lazies = rowKeys.slice(3);

  top3.forEach((key) => {
    const el = document.getElementById(`row-${key}`);
    if (el) {
      if (!el.querySelector(".row-sentinel")) {
        const sent = document.createElement("div");
        sent.className = "row-sentinel";
        el.querySelector(".row-track")?.appendChild(sent);
      }
      loadMoreForRow(el);
    }
  });

  if (window._rowObserver) window._rowObserver.disconnect();
  window._rowObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((ent) => {
        if (ent.isIntersecting) {
          const rId = ent.target.id;
          const targetEl = document.getElementById(rId);
          if (targetEl && targetEl.dataset.page === "1") {
            loadMoreForRow(targetEl);
          }
          window._rowObserver.unobserve(ent.target);
        }
      });
    },
    { rootMargin: "200px" },
  );

  lazies.forEach((key) => {
    const el = document.getElementById(`row-${key}`);
    if (el) window._rowObserver.observe(el);
  });
});

export const prepareAddFromDiscover = (window.prepareAddFromDiscover = (
  title,
  poster,
) => {
  if (window.openAddModal) window.openAddModal();
  const ft = document.getElementById("field-title");
  const fp = document.getElementById("field-poster");
  if (ft) ft.value = title;
  if (fp) fp.value = poster;
  if (window.onTitleInput) window.onTitleInput();
});
