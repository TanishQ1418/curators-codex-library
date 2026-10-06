// ── STATS & ANALYTICS MODULE (CHART.JS) ───────────────────────────

export let tierChartInstance = null;
export let statusChartInstance = null;

export const renderStats = (window.renderStats = () => {
  const lib = window.library || [];
  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.textContent = lib.length;
  const statCompleted = document.getElementById("stat-completed");
  if (statCompleted)
    statCompleted.textContent = lib.filter(
      (l) => l.status === "Completed",
    ).length;

  let totalEpisodes = 0;
  let totalMinutes = 0;

  lib.forEach((l) => {
    let eps = parseInt(l.episodes) || 0;
    totalEpisodes += eps;

    if (eps === 0 && l.status === "Completed") {
      eps = 1;
    }

    if (l.type === "Movie") {
      totalMinutes += eps > 0 ? eps * 120 : 120;
    } else if (l.type === "Web Series" || l.type === "Series") {
      totalMinutes += eps * 45;
    } else {
      totalMinutes += eps * 24;
    }
  });

  const statEps = document.getElementById("stat-episodes");
  if (statEps) statEps.textContent = totalEpisodes;

  const statTime = document.getElementById("stat-time");
  if (statTime) {
    if (totalMinutes > 60 * 24) {
      statTime.textContent = (totalMinutes / (60 * 24)).toFixed(1) + "d";
    } else {
      statTime.textContent = Math.round(totalMinutes / 60) + "h";
    }
  }

  // Top genre
  const gCount = {};
  lib.forEach((l) => {
    if (l.genres)
      l.genres.forEach((g) => {
        gCount[g] = (gCount[g] || 0) + 1;
      });
  });
  const sortedG = Object.entries(gCount).sort((a, b) => b[1] - a[1]);
  const statGenre = document.getElementById("stat-genre");
  const statGenreCount = document.getElementById("stat-genre-count");
  if (sortedG.length) {
    if (statGenre) statGenre.textContent = sortedG[0][0];
    if (statGenreCount)
      statGenreCount.textContent = `${sortedG[0][1]} appearances`;
  } else {
    if (statGenre) statGenre.textContent = "—";
    if (statGenreCount) statGenreCount.textContent = "appearances";
  }

  // Generate Analysis Context
  const activeEntries = lib.filter(
    (l) => l.status === "Completed" || l.status === "Watching",
  );
  const sTierCount = lib.filter(
    (l) => l.tier === "S" || l.tier === "A",
  ).length;
  let analysisStr = "";
  if (lib.length === 0) {
    analysisStr =
      "Your codex is empty. Add some entries to start discovering your unique taste profile.";
  } else if (sortedG.length >= 2) {
    analysisStr = `Based on your library of ${lib.length} entries, you have a strong affinity for <strong style="color:var(--accent)">${sortedG[0][0]}</strong> and <strong style="color:var(--accent)">${sortedG[1][0]}</strong>. `;
    if (sTierCount > 0)
      analysisStr += `You've reserved top ratings (S/A tier) for ${sTierCount} titles, suggesting a refined standard for quality. `;
    let planCount = lib.filter((l) => l.status === "Plan to Watch").length;
    if (planCount > 0)
      analysisStr += `With ${planCount} titles remaining on your watchlist, there are still plenty of adventures ahead.`;
    else
      analysisStr += `Your watchlist is clear – it's the perfect time to explore new discoveries!`;
  } else {
    analysisStr =
      "Your library is growing. Add more diverse titles and ratings for a deeper taste analysis.";
  }
  const statAnalysis = document.getElementById("stat-analysis");
  if (statAnalysis) statAnalysis.innerHTML = analysisStr;

  // Render Charts
  setTimeout(() => {
    const tCtx = document.getElementById("tierChart");
    const sCtx = document.getElementById("statusChart");
    if (!tCtx || !sCtx || typeof Chart === "undefined") return;

    Chart.defaults.color = "#9CA3AF";
    Chart.defaults.font.family = "'Outfit', sans-serif";

    if (tierChartInstance) tierChartInstance.destroy();
    if (statusChartInstance) statusChartInstance.destroy();

    const tiers = ["S", "A", "B", "C", "D", "E", "F"];
    const tParams = {
      S: "#c084fc", // Amethyst / Violet
      A: "#06b6d4", // Cyan
      B: "#34D399",
      C: "#FBBF24",
      D: "#F97316",
      E: "#F87171",
      F: "#a1a1aa", // Zinc
    };

    tierChartInstance = new Chart(tCtx, {
      type: "bar",
      data: {
        labels: tiers,
        datasets: [
          {
            label: "Entries",
            data: tiers.map(
              (t) => lib.filter((l) => l.tier === t).length,
            ),
            backgroundColor: tiers.map((t) => tParams[t] + "AA"),
            borderColor: tiers.map((t) => tParams[t]),
            borderWidth: 1,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255,255,255,0.05)" },
          },
          x: { grid: { display: false } },
        },
      },
    });

    const statuses = [
      "Plan to Watch",
      "Watching",
      "Completed",
      "On Hold",
      "Dropped",
    ];
    const sColors = [
      "#8B5CF6",
      "#22D3EE",
      "#34D399",
      "#FBBF24",
      "#F87171",
    ];

    statusChartInstance = new Chart(sCtx, {
      type: "doughnut",
      data: {
        labels: statuses,
        datasets: [
          {
            data: statuses.map(
              (s) => lib.filter((l) => l.status === s).length,
            ),
            backgroundColor: sColors.map((c) => c + "CC"),
            borderColor: "#161B22",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: {
              color: "#E6EDF3",
              boxWidth: 12,
              font: { size: 11 },
            },
          },
        },
        cutout: "70%",
      },
    });

    // Type Breakdown
    const types = ["Anime", "Movie", "Web Series", "OVA", "Special"];
    let typeHtml = "";
    types.forEach((t) => {
      const count = lib.filter((l) => l.type === t).length;
      const pct = lib.length ? Math.round((count / lib.length) * 100) : 0;
      typeHtml += `
          <div class="breakdown-row">
              <div class="breakdown-label">${t}</div>
              <div class="breakdown-bar-track">
                  <div class="breakdown-bar-fill" style="width: ${pct}%"></div>
              </div>
              <div class="breakdown-count">${count}</div>
          </div>
      `;
    });
    const typeBd = document.getElementById("typeBreakdown");
    if (typeBd)
      typeBd.innerHTML =
        typeHtml ||
        '<div style="color:var(--text-muted);font-size:13px">No data</div>';

    // Genre Breakdown
    let genreHtml = "";
    sortedG.slice(0, 5).forEach((g) => {
      const pct = lib.length ? Math.round((g[1] / lib.length) * 100) : 0;
      genreHtml += `
          <div class="breakdown-row">
              <div class="breakdown-label">${g[0]}</div>
              <div class="breakdown-bar-track">
                  <div class="breakdown-bar-fill" style="width: ${pct}%; background:rgba(34,211,238,0.12); border-color:#22D3EE;"></div>
              </div>
              <div class="breakdown-count">${g[1]}</div>
          </div>
      `;
    });
    const genreBd = document.getElementById("genreBreakdown");
    if (genreBd)
      genreBd.innerHTML =
        genreHtml ||
        '<div style="color:var(--text-muted);font-size:13px">No data</div>';
  }, 100);
});
