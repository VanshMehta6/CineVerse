"use strict";

// ---------- State ----------
const State = {
  watchlist: JSON.parse(localStorage.getItem("cv_watchlist") || "[]"),
  ratings: JSON.parse(localStorage.getItem("cv_ratings") || "{}"),
  activeSection: "discover",
  heroItem: null,
  tooltip: null,
  currentFilters: { genre: "", year: "", rating: "", lang: "", ott: [] },
  searchDebounce: null,
};

// ---------- Utils ----------
function saveWatchlist() {
  localStorage.setItem("cv_watchlist", JSON.stringify(State.watchlist));
  updateWLCount();
}
function saveRatings() {
  localStorage.setItem("cv_ratings", JSON.stringify(State.ratings));
}
function isInWL(id) {
  return State.watchlist.some((x) => x.id === id);
}
function updateWLCount() {
  document.getElementById("wl-count").textContent = State.watchlist.length;
}
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

// Escape HTML for SVG text
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

// Generate SVG fallback (only for empty posters)
function generatePosterSVG(item) {
  const title = escapeHtml(item.title || item.name || "Untitled");
  const rating = item.rating || (item.vote_average?.toFixed(1) ?? "?");
  const year = item.year || item.release_date?.slice(0,4) || item.first_air_date?.slice(0,4) || "?";
  const svg = `
    <svg width="185" height="278" viewBox="0 0 185 278" xmlns="http://www.w3.org/2000/svg">
      <rect width="185" height="278" fill="#0e1520"/>
      <text x="92.5" y="120" font-family="Bebas Neue, sans-serif" font-size="16" fill="#e8b84b" text-anchor="middle">${title}</text>
      <text x="92.5" y="150" font-family="DM Sans, sans-serif" font-size="12" fill="#7a8499" text-anchor="middle">⭐ ${rating}</text>
      <text x="92.5" y="170" font-family="DM Sans, sans-serif" font-size="10" fill="#4a5568" text-anchor="middle">${year}</text>
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// Main poster function – use local file if available, else SVG
function getPosterURL(item) {
  const poster = item.poster;
  // If we have a local path (starts with 'posters/') or an http URL, use it
  if (poster && (poster.startsWith('posters/') || poster.startsWith('http'))) {
    return poster;
  }
  // Otherwise (empty or placeholder), use SVG fallback
  return generatePosterSVG(item);
}

// Backdrop – only use if it's a local or custom URL (ignore TMDB)
function getBackdropURL(item) {
  if (item.backdrop && !item.backdrop.includes("image.tmdb.org")) {
    return item.backdrop;
  }
  return "";
}

// ---------- Card Creation ----------
function createCard(item, showRank = false) {
  const card = document.createElement("div");
  card.className = `card ${parseFloat(item.rating) >= 8.5 ? "is-top" : ""}`;
  card.tabIndex = 0;
  const posterUrl = getPosterURL(item);
  card.innerHTML = `
    <img class="card-poster" src="${posterUrl}" alt="${item.title}" loading="lazy"/>
    <div class="card-glow"></div>
    <div class="card-info"><div class="card-title">${item.title}</div><div class="card-meta">${item.year} · ${item.type === "series" ? "TV" : "Film"}</div></div>
    <div class="card-score${parseFloat(item.rating) >= 9.0 ? " top" : ""}">⭐ ${item.rating}</div>
    <button class="card-wl-btn${isInWL(item.id) ? " in-wl" : ""}" data-id="${item.id}">${isInWL(item.id) ? "✓" : "🔖"}</button>
    ${showRank && item.rank ? `<div class="card-rank">${item.rank}</div>` : ""}
  `;
  const wlBtn = card.querySelector(".card-wl-btn");
  wlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWatchlist(item, wlBtn);
  });
  card.addEventListener("click", () => openModal(item));
  card.addEventListener("mouseenter", () => {
    const backdrop = getBackdropURL(item);
    if (backdrop) setBg(backdrop);
    showTooltip(item, card);
  });
  card.addEventListener("mouseleave", () => {
    clearBg();
    hideTooltip();
  });
  return card;
}

// ---------- Rendering (redesigned Discover with grids) ----------
function addGrid(container, title, items, showRank = false) {
  if (!items.length) return;
  const section = document.createElement("section");
  section.className = "grid-section";
  section.innerHTML = `
    <div class="grid-header">
      <h2 class="grid-title"><span class="accent-dot"></span>${title}</h2>
    </div>
    <div class="grid-results"></div>
  `;
  const gridDiv = section.querySelector(".grid-results");
  items.forEach((item) => gridDiv.appendChild(createCard(item, showRank)));
  container.appendChild(section);
}

function renderDiscover() {
  document.getElementById("hero").classList.remove("hero-hidden");
  document.getElementById("hero").classList.add("hero-discover");
  const container = document.getElementById("dynamic-content");
  container.innerHTML = "";

  // Trending Now
  const trendingItems = ALL_TITLES.filter((t) => CATALOG.trending?.some((trend) => trend.id === t.id)).slice(0, 12);
  if (trendingItems.length) addGrid(container, "🔥 Trending Now", trendingItems);

  // Top Rated Movies
  const topMovies = [...ALL_TITLES.filter((t) => t.type === "movie")]
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
    .slice(0, 12);
  addGrid(container, "🏆 Top Rated Movies", topMovies, true);

  // Top Rated Series
  const topSeries = [...ALL_TITLES.filter((t) => t.type === "series")]
    .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating))
    .slice(0, 12);
  addGrid(container, "📺 Top Rated Series", topSeries, true);

  // Recommended for You (based on watchlist)
  const sourceItems = State.watchlist;
  const favGenres = [...new Set(sourceItems.flatMap((i) => i.genre.split(",").map((g) => g.trim())))];
  let recommended = ALL_TITLES.filter(
    (t) => !isInWL(t.id) && favGenres.length && t.genre.split(",").some((g) => favGenres.includes(g.trim()))
  ).slice(0, 12);
  if (recommended.length) addGrid(container, "🎯 Recommended for You", recommended);

  // New & Noteworthy
  const newTitles = ALL_TITLES.filter((t) => t.year === "2024" || t.year === "2023").slice(0, 12);
  if (newTitles.length) addGrid(container, "✨ New & Noteworthy", newTitles);
}

function renderMovies() {
  document.getElementById("hero").classList.add("hero-hidden");
  const container = document.getElementById("dynamic-content");
  container.innerHTML = `<div class="grid-results" id="movies-grid"></div>`;
  const grid = document.getElementById("movies-grid");
  const movies = ALL_TITLES.filter((t) => t.type === "movie");
  movies.forEach((m) => grid.appendChild(createCard(m, true)));
}

function renderSeries() {
  document.getElementById("hero").classList.add("hero-hidden");
  const container = document.getElementById("dynamic-content");
  container.innerHTML = `<div class="grid-results" id="series-grid"></div>`;
  const grid = document.getElementById("series-grid");
  const series = ALL_TITLES.filter((t) => t.type === "series");
  series.forEach((s) => grid.appendChild(createCard(s, true)));
}

function renderWatchlist() {
  document.getElementById("hero").classList.add("hero-hidden");
  const container = document.getElementById("dynamic-content");
  container.innerHTML = `<div class="grid-results" id="watchlist-grid"></div>`;
  const grid = document.getElementById("watchlist-grid");
  if (!State.watchlist.length) {
    grid.innerHTML = '<p class="empty-msg">Your watchlist is empty. Start adding titles!</p>';
    return;
  }
  State.watchlist.forEach((item) => grid.appendChild(createCard(item)));
}

function showSection(section) {
  State.activeSection = section;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector(`[data-section="${section}"]`).classList.add("active");
  document.getElementById("section-search-results").classList.add("hidden");
  if (section === "discover") renderDiscover();
  else if (section === "movies") renderMovies();
  else if (section === "series") renderSeries();
  else if (section === "watchlist") renderWatchlist();
}

// ---------- Filters & URL ----------
function updateURL() {
  const params = new URLSearchParams();
  if (State.currentFilters.genre) params.set("genre", State.currentFilters.genre);
  if (State.currentFilters.year) params.set("year", State.currentFilters.year);
  if (State.currentFilters.rating) params.set("rating", State.currentFilters.rating);
  if (State.currentFilters.lang) params.set("lang", State.currentFilters.lang);
  if (State.currentFilters.ott.length) params.set("ott", State.currentFilters.ott.join(","));
  const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`;
  window.history.replaceState({}, "", newUrl);
}

function loadFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  State.currentFilters.genre = params.get("genre") || "";
  State.currentFilters.year = params.get("year") || "";
  State.currentFilters.rating = params.get("rating") || "";
  State.currentFilters.lang = params.get("lang") || "";
  State.currentFilters.ott = params.get("ott") ? params.get("ott").split(",") : [];
  document.getElementById("filter-genre").value = State.currentFilters.genre;
  document.getElementById("filter-year").value = State.currentFilters.year;
  document.getElementById("filter-rating").value = State.currentFilters.rating;
  document.getElementById("filter-lang").value = State.currentFilters.lang;
  document.querySelectorAll(".ott-chip-list span").forEach((chip) => {
    chip.classList.toggle("active", State.currentFilters.ott.includes(chip.dataset.ott));
  });
  applyFilters();
}

function applyFilters() {
  let filtered = ALL_TITLES.filter((item) => {
    if (State.currentFilters.genre && !item.genre.toLowerCase().includes(State.currentFilters.genre.toLowerCase()))
      return false;
    if (State.currentFilters.year) {
      const y = parseInt(item.year);
      if (State.currentFilters.year === "2010–2019") {
        if (y < 2010 || y > 2019) return false;
      } else if (State.currentFilters.year === "2000–2009") {
        if (y < 2000 || y > 2009) return false;
      } else if (State.currentFilters.year === "Before 2000") {
        if (y >= 2000) return false;
      } else if (!item.year.startsWith(State.currentFilters.year)) return false;
    }
    if (State.currentFilters.rating && parseFloat(item.rating) < parseFloat(State.currentFilters.rating)) return false;
    if (State.currentFilters.lang && !item.lang.toLowerCase().includes(State.currentFilters.lang.toLowerCase()))
      return false;
    if (State.currentFilters.ott.length && !State.currentFilters.ott.some((o) => item.ott?.includes(o))) return false;
    return true;
  });
  const isFilterActive =
    State.currentFilters.genre ||
    State.currentFilters.year ||
    State.currentFilters.rating ||
    State.currentFilters.lang ||
    State.currentFilters.ott.length;
  if (isFilterActive) {
    showSection("discover");
    const srSection = document.getElementById("section-search-results");
    srSection.classList.remove("hidden");
    const grid = document.getElementById("grid-search");
    grid.innerHTML = "";
    if (!filtered.length) grid.innerHTML = '<p class="empty-msg">No titles match your filters.</p>';
    else filtered.forEach((item) => grid.appendChild(createCard(item)));
    document.getElementById("dynamic-content").innerHTML = "";
  } else {
    document.getElementById("section-search-results").classList.add("hidden");
    if (State.activeSection === "discover") renderDiscover();
    else if (State.activeSection === "movies") renderMovies();
    else if (State.activeSection === "series") renderSeries();
  }
  updateURL();
}

// ---------- Hero ----------
function initHero() {
  State.heroItem = HERO_POOL[Math.floor(Math.random() * HERO_POOL.length)];
  document.getElementById("hero-title").textContent = State.heroItem.title;
  document.getElementById("hero-meta").innerHTML = `
    <span>⭐ ${State.heroItem.rating}</span>
    <span>${State.heroItem.year}</span>
    <span>${State.heroItem.runtime || ""}</span>
    <span>${State.heroItem.genre.split(",")[0]}</span>
  `;
  document.getElementById("hero-plot").textContent = State.heroItem.plot;
  const backdrop = getBackdropURL(State.heroItem);
  if (backdrop) setBg(backdrop);
  const detailBtn = document.getElementById("hero-detail-btn");
  detailBtn.onclick = () => openModal(State.heroItem);
  const wlBtn = document.getElementById("hero-wl-btn");
  wlBtn.textContent = isInWL(State.heroItem.id) ? "✓ In Watchlist" : "+ Watchlist";
  wlBtn.onclick = () => toggleWatchlist(State.heroItem, wlBtn);
}

function setBg(url) {
  const bg = document.getElementById("bg-img");
  bg.style.backgroundImage = `url(${url})`;
  bg.classList.add("active");
}
function clearBg() {
  document.getElementById("bg-img").classList.remove("active");
}

// ---------- Tooltip ----------
function showTooltip(item, anchor) {
  hideTooltip();
  const tip = document.createElement("div");
  tip.className = "card-tooltip";
  tip.innerHTML = `
    <div class="tooltip-title">${item.title}</div>
    <div class="tooltip-meta">⭐ ${item.rating} · ${item.year} · ${item.genre.split(",")[0]}</div>
    <div class="tooltip-plot">${item.plot}</div>
  `;
  document.body.appendChild(tip);
  State.tooltip = tip;
  const rect = anchor.getBoundingClientRect();
  const tipW = 220,
    tipH = 110;
  let left = rect.right + 12;
  let top = rect.top + rect.height / 2 - tipH / 2;
  if (left + tipW > window.innerWidth) left = rect.left - tipW - 12;
  if (top < 8) top = 8;
  if (top + tipH > window.innerHeight - 8) top = window.innerHeight - tipH - 8;
  tip.style.left = left + "px";
  tip.style.top = top + "px";
  requestAnimationFrame(() => tip.classList.add("visible"));
}
function hideTooltip() {
  if (State.tooltip) {
    State.tooltip.remove();
    State.tooltip = null;
  }
}

State.currentSeason = null;
// ---------- Modal ----------
function openModal(item) {
  const overlay = document.getElementById("modal-overlay");
  overlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  document.getElementById("modal-poster").src = getPosterURL(item);
  document.getElementById("modal-title").textContent = item.title;
  document.getElementById("modal-plot").textContent = item.plot;
  document.getElementById("modal-score-badge").textContent = `⭐ ${item.rating}`;

  const classMap = { blockbuster: "badge-blockbuster", hit: "badge-hit", flop: "badge-flop" };
  const badgeHtml = item.classification ? `<span class="modal-badge ${classMap[item.classification] || ""}">${item.classification.toUpperCase()}</span>` : "";
  document.getElementById("modal-top-meta").innerHTML = `${badgeHtml}<span>${item.type === "series" ? "TV Series" : "Film"}</span><span>${item.lang}</span>${item.ott ? `<span>📺 ${item.ott.join(", ")}</span>` : ""}`;

  const genres = item.genre.split(",").map((g) => g.trim());
  document.getElementById("modal-tags").innerHTML = genres.map((g) => `<span class="tag">${g}</span>`).join("");

  const details = [
    { label: "Director", value: item.director || "—" },
    { label: "Producer", value: item.producer || "—" },
    { label: "Cast", value: item.cast || "—" },
    { label: "Release", value: item.year },
    { label: "Runtime", value: item.runtime || (item.type === "series" ? `${item.seasons} Season${item.seasons > 1 ? "s" : ""}, ${item.episodes} Episodes` : "—") },
    { label: "Language", value: item.lang },
    { label: "IMDb Rating", value: `${item.imdbRating || item.rating}/10` },
  ];
  document.getElementById("modal-details-grid").innerHTML = details.map((d) => `<div class="detail-item"><span class="detail-label">${d.label}</span><span class="detail-value">${d.value}</span></div>`).join("");

  const awardsEl = document.getElementById("modal-awards");
  if (item.awards) {
    awardsEl.textContent = `🏆 ${item.awards}`;
    awardsEl.classList.add("has-awards");
  } else awardsEl.classList.remove("has-awards");

  const wlBtn = document.getElementById("modal-wl-btn");
  wlBtn.textContent = isInWL(item.id) ? "✓ In Watchlist" : "+ Watchlist";
  wlBtn.onclick = () => {
    toggleWatchlist(item, wlBtn);
    wlBtn.textContent = isInWL(item.id) ? "✓ In Watchlist" : "+ Watchlist";
  };

  const savedRating = State.ratings[item.id] || 0;
  const starsEl = document.getElementById("modal-stars");
  starsEl.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.className = `star-btn${i <= savedRating ? " lit" : ""}`;
    star.textContent = "★";
    star.addEventListener("click", () => {
      State.ratings[item.id] = i;
      saveRatings();
      updateStars(starsEl, i);
      showToast(`Rated "${item.title}" ${i}/5`);
    });
    star.addEventListener("mouseenter", () => updateStars(starsEl, i));
    star.addEventListener("mouseleave", () => updateStars(starsEl, State.ratings[item.id] || 0));
    starsEl.appendChild(star);
  }
  if (item.type === 'series' && item.seasons && item.seasons.length > 0) {
    // Create season selector if not exists
    let seasonSelector = document.getElementById('season-selector');
    if (!seasonSelector) {
      const selectorDiv = document.createElement('div');
      selectorDiv.id = 'season-selector';
      selectorDiv.className = 'season-selector';
      selectorDiv.innerHTML = `
        <label>Season: </label>
        <select id="season-dropdown"></select>
      `;
      // Insert after modal-tags or before plot
      const tagsDiv = document.getElementById('modal-tags');
      tagsDiv.insertAdjacentElement('afterend', selectorDiv);
    }
    const dropdown = document.getElementById('season-dropdown');
    dropdown.innerHTML = '<option value="">Select season</option>' + 
      item.seasons.map(season => `<option value="${season.season_number}">${season.name} (${season.episode_count} eps) - ${season.air_date}</option>`).join('');
    dropdown.value = State.currentSeason || '';
    dropdown.onchange = (e) => {
      const seasonNum = parseInt(e.target.value);
      State.currentSeason = seasonNum;
      const season = item.seasons.find(s => s.season_number === seasonNum);
      if (season) {
        // Update modal poster to season poster if available
        if (season.poster) document.getElementById('modal-poster').src = season.poster;
        // Update plot to season overview
        const plotEl = document.getElementById('modal-plot');
        plotEl.innerHTML = `<strong>Season ${seasonNum}:</strong> ${season.overview}<br><br>${item.plot}`;
        // Update details grid to show episode count
        const detailsGrid = document.getElementById('modal-details-grid');
        const episodeRow = detailsGrid.querySelector('.detail-item.episode-count');
        if (episodeRow) episodeRow.querySelector('.detail-value').textContent = season.episode_count;
        else {
          const newRow = document.createElement('div');
          newRow.className = 'detail-item episode-count';
          newRow.innerHTML = `<span class="detail-label">Episodes (this season)</span><span class="detail-value">${season.episode_count}</span>`;
          detailsGrid.appendChild(newRow);
        }
      }
    };
    // Trigger default selection if any
    if (item.seasons.length) dropdown.dispatchEvent(new Event('change'));
  } else {
    // Remove season selector if exists
    const selector = document.getElementById('season-selector');
    if (selector) selector.remove();
  }
}

function updateStars(container, value) {
  container.querySelectorAll(".star-btn").forEach((btn, idx) => btn.classList.toggle("lit", idx < value));
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

// ---------- Watchlist ----------
function toggleWatchlist(item, btnEl) {
  if (isInWL(item.id)) {
    State.watchlist = State.watchlist.filter((x) => x.id !== item.id);
    showToast(`Removed "${item.title}" from watchlist`);
  } else {
    State.watchlist.push(item);
    showToast(`Added "${item.title}" to watchlist`);
  }
  saveWatchlist();
  if (State.activeSection === "watchlist") renderWatchlist();
  if (btnEl) btnEl.textContent = isInWL(item.id) ? "✓ In Watchlist" : "+ Watchlist";
  document.querySelectorAll(`.card-wl-btn[data-id="${item.id}"]`).forEach((b) => {
    b.classList.toggle("in-wl", isInWL(item.id));
    b.textContent = isInWL(item.id) ? "✓" : "🔖";
  });
}

// ---------- Search ----------
function handleSearch(query) {
  if (!query.trim()) {
    document.getElementById("search-results").classList.remove("open");
    return;
  }
  const results = ALL_TITLES.filter(
    (item) =>
      item.title.toLowerCase().includes(query) ||
      item.cast.toLowerCase().includes(query) ||
      (item.director && item.director.toLowerCase().includes(query))
  ).slice(0, 8);
  const container = document.getElementById("search-results");
  if (!results.length) container.innerHTML = '<div class="search-item"><div class="search-item-info">No results</div></div>';
  else {
    container.innerHTML = results
      .map(
        (item) => `
      <div class="search-item" data-id="${item.id}">
        <img src="${getPosterURL(item)}">
        <div class="search-item-info">
          <div class="search-item-title">${item.title}</div>
          <div class="search-item-meta">⭐ ${item.rating} · ${item.year}</div>
        </div>
      </div>
    `
      )
      .join("");
    container.querySelectorAll(".search-item[data-id]").forEach((el) => {
      el.addEventListener("click", () => {
        openModal(ALL_TITLES.find((x) => x.id === el.dataset.id));
        container.classList.remove("open");
        document.getElementById("search-input").value = "";
      });
    });
  }
  container.classList.add("open");
}

// ---------- Initialization ----------
document.addEventListener("DOMContentLoaded", () => {
  initHero();
  showSection("discover");
  updateWLCount();
  loadFiltersFromURL();

  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.addEventListener("click", () => showSection(btn.dataset.section)));

  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    clearTimeout(State.searchDebounce);
    State.searchDebounce = setTimeout(() => handleSearch(e.target.value), 250);
  });
  document.getElementById("search-btn").addEventListener("click", () => handleSearch(searchInput.value.trim()));
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) document.getElementById("search-results").classList.remove("open");
  });

  // Filter listeners
  const filterEls = { genre: "filter-genre", year: "filter-year", rating: "filter-rating", lang: "filter-lang" };
  Object.entries(filterEls).forEach(([key, id]) => {
    document.getElementById(id).addEventListener("change", (e) => {
      State.currentFilters[key] = e.target.value;
      applyFilters();
    });
  });
  document.querySelectorAll(".ott-chip-list span").forEach((chip) => {
    chip.addEventListener("click", () => {
      const ott = chip.dataset.ott;
      if (State.currentFilters.ott.includes(ott)) State.currentFilters.ott = State.currentFilters.ott.filter((o) => o !== ott);
      else State.currentFilters.ott.push(ott);
      document.querySelectorAll(".ott-chip-list span").forEach((c) => c.classList.toggle("active", State.currentFilters.ott.includes(c.dataset.ott)));
      applyFilters();
    });
  });
  document.getElementById("filter-reset").addEventListener("click", () => {
    State.currentFilters = { genre: "", year: "", rating: "", lang: "", ott: [] };
    document.querySelectorAll(".ott-chip-list span").forEach((c) => c.classList.remove("active"));
    Object.values(filterEls).forEach((id) => (document.getElementById(id).value = ""));
    applyFilters();
  });

  // Rotate hero every 12 seconds
  setInterval(() => {
    if (State.activeSection === "discover") initHero();
  }, 12000);

  console.log("CineVerse ready with 300+ titles and working posters");
});
