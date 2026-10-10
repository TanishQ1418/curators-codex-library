// ── EXTERNAL MEDIA APIS & AUTOCOMPLETE SERVICE ──────────────────
// Sources: Kitsu (anime) · TVMaze (series) · Cinemeta (movies)

import { esc } from "../utils/helpers.js";

/* ───────────────────────── Tunables ───────────────────────── */
const DEBOUNCE_MS = 110; // wait between keystrokes while typing fast
const LEADING_IDLE_MS = 350; // if idle longer than this, fire instantly (no debounce)
const REQUEST_TIMEOUT_MS = 4500; // one hanging API can never hold the UI hostage
const MAX_RESULTS = 8;
const MIN_RELEVANCE = 200; // below this a title is noise and is dropped
const POPULARITY_WEIGHT = 120; // max points popularity can add (relevance is 0-1000)
const TYPE_BOOST = 60; // applied only if the title is already relevant
const CACHE_LIMIT = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;
const KNOWN_LIMIT = 600;

/* ───────────────────────── Small helpers ───────────────────────── */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const httpsify = (u) => (u ? String(u).replace(/^http:\/\//i, "https://") : "");
const yearOf = (v) => (String(v ?? "").match(/\d{4}/) || [""])[0];

/** fetch → JSON with timeout + parent-abort support. Throws on HTTP errors. */
async function fetchJSON(url, parentSignal, timeoutMs = REQUEST_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (parentSignal) {
    if (parentSignal.aborted) ctrl.abort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

// Open the TCP/TLS connections early so the first search doesn't pay for them.
(function warmConnections() {
  if (typeof document === "undefined" || !document.head) return;
  [
    "https://kitsu.io",
    "https://api.tvmaze.com",
    "https://v3-cinemeta.strem.io",
  ].forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "preconnect";
    l.href = href;
    l.crossOrigin = "anonymous";
    document.head.appendChild(l);
  });
})();

/* ───────────────────────── Jikan (kept for other modules) ─────────────────────────
   Spaces calls ~350ms apart ONLY when needed (the old code slept 400ms before
   every call, even on an empty queue) and retries 429s with back-off.        */
let jikanQueue = Promise.resolve();
let jikanLastCall = 0;
const JIKAN_GAP_MS = 350;

export const fetchJikan = (url, options = {}) => {
  const run = async () => {
    const wait = JIKAN_GAP_MS - (Date.now() - jikanLastCall);
    if (wait > 0) await sleep(wait);
    jikanLastCall = Date.now();
    let res = await fetch(url, options);
    for (let attempt = 1; res.status === 429 && attempt <= 2; attempt++) {
      await sleep(1000 * attempt);
      jikanLastCall = Date.now();
      res = await fetch(url, options);
    }
    return res;
  };
  const p = jikanQueue.then(run);
  jikanQueue = p.catch(() => {}); // a failed call must not break the queue
  return p;
};
window.fetchJikan = fetchJikan;

/* ───────────────────────── Discover defaults ─────────────────────────
   TVMaze posters switched from `original_untouched` (multi-MB) to
   `medium_portrait` (tiny, same image).                                      */
export const DEFAULT_DISCOVER = {
  anime: [
    {
      title: "Frieren: Beyond Journey's End",
      poster: "https://cdn.myanimelist.net/images/anime/1015/138006l.jpg",
      genres: ["Adventure", "Drama", "Fantasy"],
    },
    {
      title: "Fullmetal Alchemist: Brotherhood",
      poster: "https://cdn.myanimelist.net/images/anime/1208/94745l.jpg",
      genres: ["Action", "Adventure", "Drama"],
    },
    {
      title: "Steins;Gate",
      poster: "https://cdn.myanimelist.net/images/anime/1935/127974l.jpg",
      genres: ["Sci-Fi", "Suspense"],
    },
    {
      title: "Attack on Titan",
      poster: "https://cdn.myanimelist.net/images/anime/10/47347l.jpg",
      genres: ["Action", "Drama"],
    },
    {
      title: "Jujutsu Kaisen",
      poster: "https://cdn.myanimelist.net/images/anime/1171/109222l.jpg",
      genres: ["Action", "Fantasy"],
    },
  ],
  movie: [
    {
      title: "Inception",
      poster:
        "https://m.media-amazon.com/images/M/MV5BMjAxMzY3NjcxNF5BMl5BanBnXkFtZTcwNTI5OTM0Mw@@._V1_SX300.jpg",
      genres: ["Action", "Adventure", "Sci-Fi"],
    },
    {
      title: "Interstellar",
      poster:
        "https://m.media-amazon.com/images/M/MV5BZjdkOTU3MDktN2IxOS00OGEyLWFmMjktY2FiMmZkNWIyODZiXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg",
      genres: ["Adventure", "Drama", "Sci-Fi"],
    },
    {
      title: "The Dark Knight",
      poster:
        "https://m.media-amazon.com/images/M/MV5BMTMxNTMwODM0NF5BMl5BanBnXkFtZTcwODAyMTk2Mw@@._V1_SX300.jpg",
      genres: ["Action", "Crime", "Drama"],
    },
    {
      title: "Spirited Away",
      poster:
        "https://m.media-amazon.com/images/M/MV5BMjlmZmI5MDctNDE2YS00YWE0LWE5ZWItZDBhYWQ0NTcxNTEhXkEyXkFqcGdeQXVyMTMxODk2OTU@._V1_SX300.jpg",
      genres: ["Animation", "Adventure", "Family"],
    },
    {
      title: "Parasite",
      poster:
        "https://m.media-amazon.com/images/M/MV5BYWZjMjk3ZTItODQ2ZC00NTY5LWE0ZDYtZTI3MjcwN2Q5NTVkXkEyXkFqcGdeQXVyODk4OTc3MTY@._V1_SX300.jpg",
      genres: ["Comedy", "Drama", "Thriller"],
    },
  ],
  series: [
    {
      title: "Breaking Bad",
      poster: "https://static.tvmaze.com/uploads/images/medium_portrait/0/2400.jpg",
      genres: ["Drama", "Crime"],
    },
    {
      title: "Game of Thrones",
      poster: "https://static.tvmaze.com/uploads/images/medium_portrait/190/476117.jpg",
      genres: ["Drama", "Adventure", "Fantasy"],
    },
    {
      title: "Chernobyl",
      poster: "https://static.tvmaze.com/uploads/images/medium_portrait/192/481977.jpg",
      genres: ["Drama", "History"],
    },
    {
      title: "Stranger Things",
      poster: "https://static.tvmaze.com/uploads/images/medium_portrait/200/501942.jpg",
      genres: ["Drama", "Fantasy", "Sci-Fi"],
    },
    {
      title: "The Office",
      poster: "https://static.tvmaze.com/uploads/images/medium_portrait/85/213184.jpg",
      genres: ["Comedy"],
    },
  ],
};
window.DEFAULT_DISCOVER = DEFAULT_DISCOVER;

/* ───────────────────────── Text normalisation ─────────────────────────
   Unicode-aware: keeps Hindi/Tamil/Japanese letters, strips Latin accents
   (Pokémon → pokemon), drops apostrophes (Journey's → journeys).            */
export function normalize(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLE_RE = /^(the|a|an)\s+/;
// Filler words count for little, so "the office" can't match every title containing "the".
const STOPWORDS = new Set(["the", "a", "an", "of", "on", "in", "and", "to", "no", "wa", "ga", "ni"]);

/** Bounded Levenshtein: bails out as soon as distance must exceed `max`. */
function levenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (Math.abs(al - bl) > max) return max + 1;
  if (!al) return bl;
  if (!bl) return al;
  let prev = new Array(bl + 1);
  let cur = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    let rowMin = i;
    const ac = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ac === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[bl];
}

const typoBudget = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/* ───────────────────────── Relevance scoring (0-1000) ─────────────────────────
   1000 exact · ~900 prefix · ~700 phrase at word start · ~620 all words (any order)
   · ~450 substring inside a word · fuzzy/typo scores stay below prefix.        */
function tokenScore(q, t) {
  const qt = q.split(" ");
  const tt = t.split(" ");
  const used = new Set();
  let total = 0;
  let weightSum = 0;
  let lastIdx = -1;
  let inOrder = true;

  qt.forEach((qw, qi) => {
    const isLast = qi === qt.length - 1; // last word may still be mid-typing
    const weight = STOPWORDS.has(qw) && qt.length > 1 ? 0.3 : 1;
    weightSum += weight;
    let best = 0;
    let bestIdx = -1;
    tt.forEach((tw, ti) => {
      if (used.has(ti)) return;
      let s = 0;
      if (tw === qw) s = 1;
      else if (tw.startsWith(qw)) s = isLast ? 0.9 : 0.75;
      else if (qw.length >= 4) {
        const budget = typoBudget(qw.length);
        const d = levenshtein(qw, tw, budget);
        if (d <= budget) s = 0.8 - 0.15 * d;
        else if (tw.includes(qw)) s = 0.4;
      }
      if (s > best) {
        best = s;
        bestIdx = ti;
      }
    });
    if (best > 0) {
      used.add(bestIdx);
      if (bestIdx < lastIdx) inOrder = false;
      lastIdx = bestIdx;
    }
    total += best * weight;
  });

  const coverage = total / weightSum;
  if (coverage < 0.5) return 0;
  const precision = Math.min(1, used.size / tt.length); // penalise very long titles
  return 620 * coverage * (0.65 + 0.35 * precision) * (inOrder ? 1 : 0.85);
}

// Typo while typing: "atack on tit" vs "attack on titan"
function typoPrefixScore(q, t) {
  if (q.length < 4) return 0;
  const budget = Math.max(1, Math.floor(q.length * 0.2));
  let d = Infinity;
  for (let L = q.length - 1; L <= q.length + 1; L++) {
    if (L <= 0) continue;
    d = Math.min(d, levenshtein(q, t.slice(0, L), budget));
  }
  return d > budget ? 0 : 800 - 110 * d;
}

function scoreOne(q, t) {
  if (!q || !t) return 0;
  if (q === t) return 1000;
  const gap = t.length - q.length;
  if (t.startsWith(q)) return 900 - Math.min(150, gap * 2);

  // "spiderman" ↔ "Spider-Man", "rezero" ↔ "Re:Zero"
  const qc = q.replace(/ /g, "");
  const tc = t.replace(/ /g, "");
  if (qc.length >= 4) {
    if (tc === qc) return 960;
    if (tc.startsWith(qc)) return 820 - Math.min(120, (tc.length - qc.length) * 2);
  }

  const at = t.indexOf(q);
  if (at > 0) {
    const boundary = t[at - 1] === " ";
    return (boundary ? 700 : 400) - Math.min(100, Math.max(0, gap) * 2);
  }
  return Math.max(tokenScore(q, t), typoPrefixScore(q, t));
}

function textScore(q, t) {
  let s = scoreOne(q, t);
  const qb = q.replace(ARTICLE_RE, "");
  const tb = t.replace(ARTICLE_RE, "");
  if (qb && tb && (qb !== q || tb !== t)) s = Math.max(s, scoreOne(qb, tb));
  return s;
}

function ensureNorm(item) {
  if (!item._n) {
    const main = normalize(item.title);
    item._n = {
      main,
      alts: (item.altTitles || []).map(normalize).filter(Boolean),
      key: main.replace(/ /g, ""),
    };
  }
  return item._n;
}

function relevance(qn, item) {
  const n = ensureNorm(item);
  let best = textScore(qn, n.main);
  for (const alt of n.alts) {
    const s = textScore(qn, alt) - 15; // romaji / abbreviations ("AoT") count a bit less
    if (s > best) best = s;
  }
  return best;
}

function canonicalType(t) {
  const s = String(t || "").toLowerCase();
  if (/anime/.test(s)) return "Anime";
  if (/movie|film/.test(s)) return "Movie";
  if (/series|show|tv/.test(s)) return "Web Series";
  return "";
}

const itemKey = (it) => `${it.type}|${ensureNorm(it).key}|${it.year || ""}`;

/** Same work from different sources/queries → keep the more popular copy. */
function dedupe(items) {
  const animeTitles = new Set();
  for (const it of items) if (it.type === "Anime") animeTitles.add(ensureNorm(it).key);
  const out = new Map();
  for (const it of items) {
    // TVMaze also lists anime; Kitsu's copy is richer (episodes, categories).
    if (
      it.type === "Web Series" &&
      it.genres?.includes("Anime") &&
      animeTitles.has(ensureNorm(it).key)
    )
      continue;
    const k = itemKey(it);
    const prev = out.get(k);
    if (!prev || (it.pop ?? 0) > (prev.pop ?? 0)) out.set(k, it);
  }
  return [...out.values()];
}

/** Make sure the best match of each type is visible, not just one type's flood. */
function pickDiverse(sorted, limit) {
  if (sorted.length <= limit) return sorted;
  const top = sorted[0].matchScore;
  const chosen = new Set();
  const seen = new Set();
  for (const r of sorted) {
    if (!seen.has(r.type) && r.matchScore >= top * 0.6) {
      seen.add(r.type);
      chosen.add(r);
    }
  }
  for (const r of sorted) {
    if (chosen.size >= limit) break;
    chosen.add(r);
  }
  return sorted.filter((r) => chosen.has(r)).slice(0, limit);
}

/** relevance (dominant) + popularity prior + gentle type-filter boost */
export function rankResults(query, items, selectedType = "") {
  const qn = normalize(query);
  if (!qn) return [];
  const wantType = canonicalType(selectedType);
  const scored = [];
  for (const item of dedupe(Array.from(items))) {
    const rel = relevance(qn, item);
    if (rel < MIN_RELEVANCE) continue; // type boost can no longer rescue noise
    const score =
      rel +
      POPULARITY_WEIGHT * (item.pop ?? 0.2) +
      (wantType && item.type === wantType ? TYPE_BOOST : 0);
    scored.push({ ...item, matchScore: score, relevance: rel });
  }
  scored.sort((a, b) => b.matchScore - a.matchScore || (b.pop ?? 0) - (a.pop ?? 0));
  return pickDiverse(scored, MAX_RESULTS);
}

// If the APIs return nothing (heavy typo), retry once with a "safer" query.
function fallbackQuery(qn) {
  const tokens = qn.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const longest = [...tokens].sort((a, b) => b.length - a.length)[0];
    return longest.length >= 3 ? longest : "";
  }
  return qn.length >= 5 ? qn.slice(0, Math.ceil(qn.length * 0.6)) : "";
}

/* ───────────────────────── Source fetchers ─────────────────────────
   Each returns normalised items and THROWS on network/HTTP failure, so a
   failure is never mistaken for "no results".                              */
async function fetchAnime(q, signal) {
  // include=categories → genres arrive in the same request (no 2nd call on select)
  // fields[...]        → smaller payload → faster
  const url =
    `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}` +
    `&page[limit]=8&include=categories` +
    `&fields[anime]=titles,canonicalTitle,abbreviatedTitles,posterImage,startDate,episodeCount,slug,popularityRank,categories` +
    `&fields[categories]=title`;
  const json = await fetchJSON(url, signal);
  const catTitle = new Map(
    (json.included || [])
      .filter((x) => x.type === "categories")
      .map((x) => [x.id, x.attributes?.title]),
  );
  return (json.data || []).map((item) => {
    const a = item.attributes || {};
    const t = a.titles || {};
    const title = t.en || t.en_us || a.canonicalTitle || t.en_jp || "Unknown Anime";
    const altTitles = [
      ...new Set(
        [a.canonicalTitle, t.en_jp, t.en_us, t.en, t.ja_jp, ...(a.abbreviatedTitles || [])].filter(
          (x) => x && x !== title,
        ),
      ),
    ];
    const genres = (item.relationships?.categories?.data || [])
      .map((c) => catTitle.get(c.id))
      .filter(Boolean)
      .slice(0, 4);
    const rank = Number(a.popularityRank) || 0; // 1 = most popular
    const img = a.posterImage || {};
    return {
      title,
      altTitles,
      poster: httpsify(img.large || img.medium || img.original || ""),
      thumb: httpsify(img.tiny || img.small || img.medium || ""),
      year: a.startDate ? a.startDate.slice(0, 4) : "",
      episodes: a.episodeCount || "",
      link: `https://kitsu.io/anime/${a.slug || item.id}`,
      genres,
      season: "",
      type: "Anime",
      kitsuId: item.id,
      jikanId: `kitsu_${item.id}`,
      malId: null,
      pop: rank ? clamp01(1 - Math.log(rank) / Math.log(25000)) : 0.15,
    };
  });
}

async function fetchSeries(q, signal) {
  const json = await fetchJSON(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
    signal,
  );
  if (!Array.isArray(json)) return [];
  return json.slice(0, 8).map(({ show = {} }) => ({
    title: show.name || "Unknown",
    altTitles: [],
    poster: httpsify(show.image?.original || show.image?.medium || ""),
    thumb: httpsify(show.image?.medium || show.image?.original || ""), // small image for the dropdown
    year: yearOf(show.premiered),
    episodes: "",
    link: show.url || "",
    genres: show.genres || [],
    season: "",
    type: "Web Series",
    pop: clamp01((show.weight ?? 20) / 100),
  }));
}

async function fetchMovies(q, signal) {
  const json = await fetchJSON(
    `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`,
    signal,
  );
  const metas = (json.metas || []).slice(0, 8);
  return metas.map((m, i) => {
    const rating = parseFloat(m.imdbRating);
    const posFactor = 1 - i / Math.max(metas.length, 1);
    const poster = httpsify(m.poster || "");
    return {
      title: m.name || "Unknown Title",
      altTitles: [],
      poster,
      thumb: poster.replace("/poster/medium/", "/poster/small/"),
      year: yearOf(m.releaseInfo || m.year),
      episodes: 1,
      link: m.id ? `https://www.imdb.com/title/${m.id}` : "",
      genres: m.genre || m.genres || [],
      season: "",
      type: "Movie",
      stremioId: m.id,
      pop: clamp01(0.5 * posFactor + 0.5 * (Number.isFinite(rating) ? rating / 10 : 0.4)),
    };
  });
}

const SOURCES = [fetchAnime, fetchSeries, fetchMovies];

/* ───────────────────────── Caches & state ───────────────────────── */
let searchDebounce = null;
let activeController = null;
let lastFireAt = 0;
let selectedDropdownIndex = -1;
let lastRenderSig = "";
let selectToken = 0;

const rawCache = new Map(); // normalized query → { items, at }  (raw items; ranked at read time)
const knownItems = new Map(); // everything seen so far → instant local type-ahead
const genreCache = new Map();

function remember(items) {
  for (const it of items) {
    const k = itemKey(it);
    knownItems.delete(k); // refresh recency
    knownItems.set(k, it);
  }
  while (knownItems.size > KNOWN_LIMIT) {
    knownItems.delete(knownItems.keys().next().value);
  }
}

/* ───────────────────────── Rendering ───────────────────────── */
function setSpinner(on) {
  const spin = $("titleSpinner");
  if (spin) spin.style.display = on ? "block" : "none";
}

function hideDropdown() {
  const dd = $("searchDropdown");
  if (dd) dd.style.display = "none";
  window._tempSearchResults = [];
  selectedDropdownIndex = -1;
  lastRenderSig = "";
}

function renderSearchResults(results, state = "done", q = "") {
  const dd = $("searchDropdown");
  if (!dd) return;
  results = results || [];
  window._tempSearchResults = results;

  // Progressive painting calls this often — skip DOM work if nothing changed.
  const sig = state + "|" + results.map((r) => `${r.type}:${r.title}:${r.year}`).join("|");
  if (sig === lastRenderSig && dd.style.display !== "none") return;
  lastRenderSig = sig;
  selectedDropdownIndex = -1;

  if (!results.length) {
    const msg =
      state === "loading"
        ? "Searching…"
        : state === "error"
          ? "Couldn't reach the search services. Check your connection."
          : `No matches for “${esc(q)}”`;
    dd.innerHTML = `<div class="search-empty" style="padding:10px 12px;font-size:12px;color:var(--text-muted)">${msg}</div>`;
    dd.style.display = "block";
    return;
  }

  dd.innerHTML = results
    .map((r, i) => {
      const img = r.thumb || r.poster;
      const thumb = img
        ? `<img src="${esc(img)}" alt="" decoding="async" referrerpolicy="no-referrer" onerror="this.outerHTML='🎬'" />`
        : "🎬";
      const meta = [
        `<span style="color:var(--accent);font-weight:600;">${esc(r.type || "Media")}</span>`,
        r.year ? esc(String(r.year)) : "",
        r.episodes && r.type !== "Movie" ? `${esc(String(r.episodes))} eps` : "",
        r.genres && r.genres.length ? esc(String(r.genres[0])) : "",
      ].filter(Boolean);
      return `
    <div class="search-row" id="searchRow-${i}" onclick="window.selectSearch(${i})" onmouseenter="window.prefetchGenres(${i})">
      <div class="search-row-thumb">${thumb}</div>
      <div style="min-width:0;flex:1;">
        <div class="search-row-title">${esc(r.title)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${meta.join(" • ")}</div>
      </div>
    </div>`;
    })
    .join("");
  dd.style.display = "block";
}

function paint(q, state = "loading") {
  const type = $("field-type")?.value || "";
  renderSearchResults(rankResults(q, knownItems.values(), type), state, q);
}

/* ───────────────────────── Search orchestration ───────────────────────── */
async function runSearch(q, qNorm, controller) {
  const { signal } = controller;
  const pool = [];
  let failed = 0;
  let succeeded = 0;

  // Every source paints the moment IT answers — the slowest API no longer
  // decides how fast the first results appear.
  const runSource = async (fetcher, query) => {
    try {
      const items = await fetcher(query, signal);
      if (signal.aborted) return;
      succeeded++;
      pool.push(...items);
      remember(items);
      paint(q, "loading");
    } catch (e) {
      if (signal.aborted) return;
      failed++;
      console.warn(`[media-search] ${fetcher.name} failed:`, e?.message || e);
    }
  };

  try {
    await Promise.all(SOURCES.map((f) => runSource(f, q)));
    if (signal.aborted) return;

    let ranked = rankResults(q, knownItems.values(), $("field-type")?.value || "");
    if (!ranked.length && succeeded > 0) {
      const fb = fallbackQuery(qNorm);
      if (fb && fb !== qNorm) {
        await Promise.all(SOURCES.map((f) => runSource(f, fb))); // still ranked against the ORIGINAL query
        if (signal.aborted) return;
        ranked = rankResults(q, knownItems.values(), $("field-type")?.value || "");
      }
    }

    // Only cache complete, successful lookups — never a failure disguised as "empty".
    if (failed === 0) {
      rawCache.set(qNorm, { items: pool, at: Date.now() });
      while (rawCache.size > CACHE_LIMIT) rawCache.delete(rawCache.keys().next().value);
    }

    renderSearchResults(ranked, succeeded === 0 && failed > 0 ? "error" : "done", q);
  } finally {
    // Only the *current* request may touch the spinner (old bug: an aborted
    // request's `finally` switched off the spinner of the newer one).
    if (activeController === controller) {
      activeController = null;
      setSpinner(false);
    }
  }
}

function startSearch(q, qNorm) {
  const controller = new AbortController();
  activeController = controller;
  lastFireAt = Date.now();
  runSearch(q, qNorm, controller);
}

export const onTitleInput = (window.onTitleInput = () => {
  const field = $("field-title");
  if (!field) return;
  const q = field.value.trim();
  const autofill = $("autofillStatus");
  if (autofill) autofill.innerHTML = "";

  // User is typing a new title → IDs from a previously selected result are stale.
  window._draftStremioId = null;
  window._draftJikanId = null;
  window._draftMalId = null;
  window._draftKitsuId = null;

  clearTimeout(searchDebounce);
  if (activeController) {
    activeController.abort();
    activeController = null;
  }

  const qNorm = normalize(q);
  if (qNorm.length < 2) {
    hideDropdown();
    setSpinner(false);
    return;
  }

  // 1) Cache hit → instant, and re-ranked with the *current* type filter.
  const cached = rawCache.get(qNorm);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    remember(cached.items);
    paint(q, "done");
    setSpinner(false);
    return;
  }

  // 2) Instant local type-ahead from everything seen so far, while the network works.
  paint(q, "loading");
  setSpinner(true);

  // 3) Fire immediately if the user was idle, otherwise a short debounce.
  const idle = Date.now() - lastFireAt > LEADING_IDLE_MS;
  if (idle) startSearch(q, qNorm);
  else searchDebounce = setTimeout(() => startSearch(q, qNorm), DEBOUNCE_MS);
});

/* ───────────────────────── Genres (lazy, prefetched on hover) ───────────────────────── */
function loadGenres(r) {
  if (r.genres && r.genres.length) return Promise.resolve(r.genres);
  let key, url, pick;
  if (r.type === "Movie" && r.stremioId) {
    key = `movie:${r.stremioId}`;
    url = `https://v3-cinemeta.strem.io/meta/movie/${r.stremioId}.json`;
    pick = (j) => j?.meta?.genre || j?.meta?.genres || [];
  } else if (r.type === "Anime" && r.kitsuId) {
    key = `anime:${r.kitsuId}`;
    url = `https://kitsu.io/api/edge/anime/${r.kitsuId}/categories?page[limit]=4&fields[categories]=title`;
    pick = (j) => (j?.data || []).map((c) => c.attributes?.title).filter(Boolean);
  } else {
    return Promise.resolve([]);
  }
  if (!genreCache.has(key)) {
    genreCache.set(
      key,
      fetchJSON(url, null)
        .then(pick)
        .catch((e) => {
          console.warn("[media-search] genre fetch failed:", e?.message || e);
          genreCache.delete(key); // allow retry
          return [];
        }),
    );
  }
  return genreCache.get(key);
}

window.prefetchGenres = (idx) => {
  const r = (window._tempSearchResults || [])[idx];
  if (r) loadGenres(r);
};

/* ───────────────────────── Selecting a result ───────────────────────── */
export const selectSearch = (window.selectSearch = async (idx) => {
  const r = (window._tempSearchResults || [])[idx];
  if (!r) return;
  const token = ++selectToken;

  const setVal = (id, v) => {
    const el = $(id);
    if (el) el.value = v ?? "";
  };
  const status = (html) => {
    const el = $("autofillStatus");
    if (el) el.innerHTML = html;
  };
  const OK =
    '<span style="color:var(--success);font-size:11px;font-weight:600">✨ Auto-filled from database</span>';
  const LOADING =
    '<span style="color:var(--accent);font-size:11px;font-weight:600">⏳ Loading genres…</span>';

  // Fill everything we already know IMMEDIATELY — no waiting on the network.
  // Fields are overwritten (even with "") so data from the previous pick can't leak in.
  setVal("field-title", r.title);
  if (r.type) setVal("field-type", r.type);
  setVal("field-poster", r.poster);
  setVal("field-year", r.year);
  setVal("field-episodes", r.episodes);
  setVal("field-link", r.link);
  if (r.season) setVal("field-season", r.season);

  window._draftStremioId = r.stremioId || null;
  window._draftJikanId = r.jikanId || null;
  window._draftMalId = r.malId || null;
  window._draftKitsuId = r.kitsuId || null;

  const applyGenres = (g) => {
    if (window.setCurrentDraftGenres) window.setCurrentDraftGenres([...(g || [])]);
    if (window.onTypeChange) window.onTypeChange();
  };

  hideDropdown();

  if (r.genres && r.genres.length) {
    applyGenres(r.genres);
    status(OK);
  } else {
    applyGenres([]);
    status(LOADING);
    const genres = await loadGenres(r); // usually already prefetched on hover
    if (token !== selectToken) return; // user picked something else meanwhile
    applyGenres(genres);
    status(OK);
  }
});

/* ───────────────────────── Keyboard navigation ───────────────────────── */
export const handleTitleKey = (window.handleTitleKey = (e) => {
  if (e.isComposing) return; // IME (Japanese/Hindi/etc.) composition
  const dd = $("searchDropdown");
  if (!dd || dd.style.display === "none") return;
  const rows = dd.querySelectorAll(".search-row");
  if (!rows.length) return;

  const highlight = () => {
    rows.forEach((r, idx) => r.classList.toggle("highlighted", idx === selectedDropdownIndex));
    rows[selectedDropdownIndex]?.scrollIntoView({ block: "nearest" });
    window.prefetchGenres(selectedDropdownIndex);
  };

  if (e.key === "ArrowDown") {
    e.preventDefault();
    selectedDropdownIndex = (selectedDropdownIndex + 1) % rows.length;
    highlight();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    selectedDropdownIndex = (selectedDropdownIndex - 1 + rows.length) % rows.length;
    highlight();
  } else if (e.key === "Enter") {
    if (selectedDropdownIndex >= 0 && selectedDropdownIndex < rows.length) {
      e.preventDefault();
      selectSearch(selectedDropdownIndex);
    }
  } else if (e.key === "Escape") {
    hideDropdown();
  }
});
