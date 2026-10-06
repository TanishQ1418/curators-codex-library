// ── EXTERNAL MEDIA APIS & AUTOCOMPLETE SERVICE ──────────────────

let searchDebounce = null;
let jikanQueue = Promise.resolve();

export const fetchJikan = (url) => {
  return new Promise((resolve, reject) => {
    jikanQueue = jikanQueue.then(async () => {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const res = await fetch(url);
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000));
          resolve(await fetch(url));
        } else {
          resolve(res);
        }
      } catch (e) {
        reject(e);
      }
    });
  });
};
window.fetchJikan = fetchJikan;

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
      poster:
        "https://static.tvmaze.com/uploads/images/original_untouched/0/2400.jpg",
      genres: ["Drama", "Crime"],
    },
    {
      title: "Game of Thrones",
      poster:
        "https://static.tvmaze.com/uploads/images/original_untouched/190/476117.jpg",
      genres: ["Drama", "Adventure", "Fantasy"],
    },
    {
      title: "Chernobyl",
      poster:
        "https://static.tvmaze.com/uploads/images/original_untouched/192/481977.jpg",
      genres: ["Drama", "History"],
    },
    {
      title: "Stranger Things",
      poster:
        "https://static.tvmaze.com/uploads/images/original_untouched/200/501942.jpg",
      genres: ["Drama", "Fantasy", "Sci-Fi"],
    },
    {
      title: "The Office",
      poster:
        "https://static.tvmaze.com/uploads/images/original_untouched/85/213184.jpg",
      genres: ["Comedy"],
    },
  ],
};
window.DEFAULT_DISCOVER = DEFAULT_DISCOVER;

// Autocomplete search for add entry modal
export const onTitleInput = (window.onTitleInput = () => {
  const titleField = document.getElementById("field-title");
  if (!titleField) return;
  const q = titleField.value.trim();
  const spin = document.getElementById("titleSpinner");
  const autofill = document.getElementById("autofillStatus");
  if (autofill) autofill.innerHTML = "";

  clearTimeout(searchDebounce);

  if (q.length < 2) {
    const dd = document.getElementById("searchDropdown");
    if (dd) dd.style.display = "none";
    if (spin) spin.style.display = "none";
    return;
  }

  if (spin) spin.style.display = "block";
  searchDebounce = setTimeout(async () => {
    try {
      let mixedResults = [];

      const fetchAnimeSearch = async () => {
        try {
          const jRes = await fetch(
            `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=5`,
          );
          const jData = await jRes.json();
          if (jData && jData.data && jData.data.length > 0) return jData;
          throw new Error("Jikan failed or empty");
        } catch (e) {
          try {
            const kRes = await fetch(
              `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=5`,
            );
            const kData = await kRes.json();
            if (kData && kData.data) {
              return {
                data: kData.data.map((item) => ({
                  title_english: item.attributes.canonicalTitle,
                  title: item.attributes.canonicalTitle,
                  images: {
                    jpg: {
                      large_image_url: item.attributes.posterImage?.large || "",
                    },
                  },
                  year: item.attributes.startDate
                    ? parseInt(item.attributes.startDate.substring(0, 4))
                    : "",
                  episodes: item.attributes.episodeCount || "",
                  url: `https://kitsu.io/anime/${item.attributes.slug}`,
                  genres: [],
                  season: "",
                  mal_id: null,
                  kitsu_id: item.id,
                })),
              };
            }
          } catch (err) {
            return { data: [] };
          }
        }
        return { data: [] };
      };

      const [animeRes, tvRes, movieRes] = await Promise.allSettled([
        fetchAnimeSearch(),
        fetch(
          `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`,
        ).then((r) => r.json()),
        fetch(
          `https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(q)}.json`,
        ).then((r) => r.json()),
      ]);

      if (
        animeRes.status === "fulfilled" &&
        animeRes.value &&
        animeRes.value.data
      ) {
        mixedResults = mixedResults.concat(
          animeRes.value.data.map((item) => ({
            title: item.title_english || item.title,
            poster:
              item.images?.jpg?.large_image_url ||
              item.images?.jpg?.image_url ||
              "",
            year: item.year || item.aired?.prop?.from?.year || "",
            episodes: item.episodes || "",
            link: item.url,
            genres: item.genres?.map((g) => g.name) || [],
            season:
              item.season && item.year
                ? `${item.season.charAt(0).toUpperCase() + item.season.slice(1)} ${item.year}`
                : "",
            type: "Anime",
            jikanId: item.mal_id
              ? `mal_${item.mal_id}`
              : item.kitsu_id
                ? `kitsu_${item.kitsu_id}`
                : null,
            malId: item.mal_id || null,
            kitsuId: item.kitsu_id || null,
          })),
        );
      }

      if (tvRes.status === "fulfilled" && Array.isArray(tvRes.value)) {
        mixedResults = mixedResults.concat(
          tvRes.value.slice(0, 5).map((item) => ({
            title: item.show?.name || "Unknown",
            poster:
              item.show?.image?.original || item.show?.image?.medium || "",
            year: item.show?.premiered
              ? item.show.premiered.substring(0, 4)
              : "",
            episodes: "",
            link: item.show?.url || "",
            genres: item.show?.genres || [],
            season: "",
            type: "Web Series",
          })),
        );
      }

      if (
        movieRes.status === "fulfilled" &&
        movieRes.value &&
        movieRes.value.metas
      ) {
        mixedResults = mixedResults.concat(
          movieRes.value.metas.slice(0, 5).map((item) => ({
            title: item.name || "Unknown Title",
            poster: item.poster || "",
            year: item.releaseInfo || item.year || "",
            episodes: 1,
            link: item.id ? `https://www.imdb.com/title/${item.id}` : "",
            genres: item.genre || [],
            season: "",
            type: "Movie",
            stremioId: item.id,
          })),
        );
      }

      // Sort mixed results to bring exact or prefix matches to top
      const qLower = (q || "").toLowerCase();
      mixedResults.sort((a, b) => {
        const aLower = (a.title || "").toLowerCase();
        const bLower = (b.title || "").toLowerCase();
        const aMatch =
          aLower === qLower ? 2 : aLower.startsWith(qLower) ? 1 : 0;
        const bMatch =
          bLower === qLower ? 2 : bLower.startsWith(qLower) ? 1 : 0;
        return bMatch - aMatch;
      });

      let results = mixedResults.slice(0, 10);

      const dd = document.getElementById("searchDropdown");
      if (spin) spin.style.display = "none";
      if (!results.length) {
        if (dd) dd.style.display = "none";
        return;
      }
      if (dd) {
        dd.innerHTML = results
          .map(
            (r, i) => `
        <div class="search-row" onclick="window.selectSearch(${i})">
          <div class="search-row-thumb"><img src="${r.poster}" onerror="this.outerHTML='🎬'" /></div>
          <div style="min-width:0;flex:1;">
             <div class="search-row-title">${r.title}</div>
             <div style="font-size:11px;color:var(--text-muted);margin-top:2px"><span style="color:var(--accent)">${r.type}</span> ${r.year ? "• " + r.year : ""} ${r.genres && r.genres.length ? "• " + r.genres[0] : ""}</div>
          </div>
        </div>
      `,
          )
          .join("");
        window._tempSearchResults = results;
        dd.style.display = "block";
      }
    } catch (e) {
      console.error("Search auto-complete API error:", e);
      if (spin) spin.style.display = "none";
    }
  }, 600);
});

export const selectSearch = (window.selectSearch = async (idx) => {
  const r = (window._tempSearchResults || [])[idx];
  if (!r) return;

  const autofill = document.getElementById("autofillStatus");
  if (autofill) {
    autofill.innerHTML =
      '<span style="color:var(--accent);font-size:11px;font-weight:600">⏳ Fetching detailed info...</span>';
  }

  let genresToUse = r.genres || [];

  if (
    r.type === "Movie" &&
    (!genresToUse || !genresToUse.length) &&
    r.stremioId
  ) {
    try {
      const metaRes = await fetch(
        `https://v3-cinemeta.strem.io/meta/movie/${r.stremioId}.json`,
      );
      const metaData = await metaRes.json();
      if (metaData && metaData.meta && metaData.meta.genre) {
        genresToUse = metaData.meta.genre;
      }
    } catch (e) {
      console.error("Failed to fetch detailed movie metadata:", e);
    }
  }

  const fieldTitle = document.getElementById("field-title");
  if (fieldTitle) fieldTitle.value = r.title;
  if (r.type && document.getElementById("field-type"))
    document.getElementById("field-type").value = r.type;
  if (r.poster && document.getElementById("field-poster"))
    document.getElementById("field-poster").value = r.poster;
  if (r.year && document.getElementById("field-year"))
    document.getElementById("field-year").value = r.year;
  if (r.episodes && document.getElementById("field-episodes"))
    document.getElementById("field-episodes").value = r.episodes;
  if (r.link && document.getElementById("field-link"))
    document.getElementById("field-link").value = r.link;
  if (r.season && document.getElementById("field-season"))
    document.getElementById("field-season").value = r.season;

  window._draftStremioId = r.stremioId || null;
  window._draftJikanId = r.jikanId || null;
  window._draftMalId = r.malId || null;
  window._draftKitsuId = r.kitsuId || null;

  if (genresToUse && genresToUse.length && window.setCurrentDraftGenres) {
    window.setCurrentDraftGenres([...genresToUse]);
  }
  if (window.onTypeChange) window.onTypeChange();
  const dd = document.getElementById("searchDropdown");
  if (dd) dd.style.display = "none";
  if (autofill) {
    autofill.innerHTML =
      '<span style="color:var(--success);font-size:11px;font-weight:600">✨ Auto-filled from database</span>';
  }
});

export const handleTitleKey = (window.handleTitleKey = (e) => {
  if (e.key === "Escape") {
    const dd = document.getElementById("searchDropdown");
    if (dd) dd.style.display = "none";
  }
});
