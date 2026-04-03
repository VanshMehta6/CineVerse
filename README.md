# 🎬 CineVerse — A Fully Offline Movie & TV Discovery Engine

CineVerse is a high-performance, fully static web application designed to deliver a rich, cinematic browsing experience—without relying on live APIs.

It lets users explore a curated global catalog of movies and TV series with deep metadata, intelligent discovery rails, and persistent personalization—all running entirely in the browser.

No backend. No API latency. No runtime dependencies.

# 🚀 Why This Exists

Most movie discovery platforms are:

Slow (API-bound)
Cluttered (ad-heavy)
Dependent on connectivity

CineVerse eliminates all of that.

Everything is precomputed, locally stored, and instantly accessible—turning the browser into a self-contained entertainment engine.

#✨ Core Capabilities

##🎥 Deep Catalog
300+ movies and TV series (easily scalable)
Rich metadata: cast, director, runtime, release date, OTT availability, classification

##📺 TV Series Intelligence
Season-level navigation
Per-season posters, summaries, and episode counts

##🧠 Smart Discovery
Dynamic content rails:
Because You Watched
Trending on OTT
Top 10 This Week
Classic Gems

##⭐ Personalization
Watchlist (stored locally)
Persistent 5-star rating system
Behavior-driven recommendations

##🎛 Advanced Filtering
Genre, year, rating
Language
OTT platform (Netflix, Prime, Hotstar, JioCinema, Apple TV+)

##🎨 UI/UX Design
Cinematic dark theme
Smooth background transitions
Hover previews and tooltips
Responsive grid layout (no horizontal scroll)
Mobile gestures + keyboard navigation

##⚡ Performance Advantage
Zero API calls at runtime
Instant load after initial render
Fully functional offline
No backend bottlenecks

##🖥️ Run Locally (Zero Setup)
Download or clone the repository
Open index.html in any modern browser
Done

##📁 Architecture Overview
cineverse/
├── index.html      # Entry point
├── style.css       # UI system (dark theme, layout, responsiveness)
├── app.js          # Core logic (state, filters, UI interactions)
├── data.js         # Precomputed dataset (catalog + metadata)
├── posters/        # Local image assets
├── .gitignore
└── README.md

##🔄 Data Pipeline (Optional)
The dataset was generated using a Node.js script that pulls from TMDB.

You don’t need it to run the app—but if you want to scale:

Add more titles
Refresh outdated metadata
Expand into new regions

You can regenerate everything via the script (requires TMDB API key).

##🧰 Tech Stack
HTML5 + CSS3 (Grid, Flexbox, variables)
Vanilla JavaScript (no frameworks, no overhead)
LocalStorage (state persistence)
TMDB (data source, build-time only)

##📜 License
For educational and personal use only.
All content belongs to respective copyright holders and TMDB.
