# PocketBox 📦

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-node:sqlite-blue?style=flat-square&logo=sqlite)](https://nodejs.org/)
[![Firefox](https://img.shields.io/badge/Firefox-WebExtension%20v3-orange?style=flat-square&logo=firefox-browser)](https://www.mozilla.org/firefox/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**PocketBox** is a personal, private, 100% self-hosted "Read It Later" application inspired by Mozilla Pocket.  
It runs **locally on your Mac** with zero cloud subscription fees, provides an **offline-first PWA** reading experience on iPhone, and synchronizes articles saved from Firefox (both on Mac and iPhone) leveraging **Firefox Sync** and a dedicated extension—even when links are saved while the Mac is powered off or sleeping.

---

## 🌟 Key Features

1. **Mac-Sleep Solution (Asynchronous Sync via Firefox Sync)**:
   - Save any article from Firefox on iPhone or Mac into a designated bookmark folder: `📥 PocketBox`.
   - Firefox Sync securely synchronizes the bookmark through Mozilla's encrypted sync servers.
   - Whenever your Mac wakes up and Firefox is open, the background extension automatically detects new bookmarks in that folder, sends them to the local PocketBox server for full-text extraction, and clears the queue folder.
   - On Firefox for Mac, a **1-click toolbar button** is also available to instantly save active tabs without navigating folders.

2. **Native Firefox Reader Engine (`@mozilla/readability`)**:
   - Strips ads, cookie prompts, newsletter popups, and clutter.
   - Extracts clean article text, author/byline, estimated reading time, and hero images using the exact engine that powers Firefox's native Reader View.

3. **Web Interface & iPhone PWA (Offline-First & iOS Optimized)**:
   - Installable as a standalone app on iPhone via Safari/Firefox ("Add to Home Screen") without browser toolbars.
   - **Native iOS Safe Area & iPhone SE Optimization**:
     - Status bar clearance with CSS safe areas (`env(safe-area-inset-top)`), guaranteed minimum 52px clearance on classic bezel devices like **iPhone SE (2nd/3rd gen)** to completely clear Apple's 50px `black-translucent` progressive blur/gradient scrim. Header controls, search input, and action buttons never collide with or get blurred under the status bar.
     - Responsive 375px compact navigation bar with auto-expanding search and horizontally scrollable filter chips.
     - Prevents iOS Safari input auto-zoom by enforcing optimal mobile font sizing.
     - Smooth touch handling (`touch-manipulation`, 40-44px tap targets, and `100dvh` viewport adaptation).
   - **Full Offline Reading**: Automatically caches articles locally (IndexedDB / Service Worker `v3` with Network-First navigation) while connected to your home Wi-Fi. You can read all saved articles anywhere (on the subway, in airplane mode, or when your Mac is turned off).
   - Distraction-free reader view with customizable typography: Serif (book style), Sans-serif (modern), Monospace, adjustable font size, and line spacing.
   - Reading themes: *Paper Light*, *Warm Sepia*, *Dark Slate*, and *Pure OLED Black*.
   - Reader progress bar neatly integrated along the bottom border of the header.

4. **Rich Organization**:
   - **Folders / Topics**: Organize articles by subject (*Technology*, *Work*, *Long Reads*, *Personal*).
   - **Multiple Tags**: Flexible multi-tagging system with color-coded badges.
   - **Pocket Sections**: *Inbox (To Read)*, *Archive (Read)*, *Favorites (Starred)*.
   - **Instant Full-Text Search**: Filter by title, author, domain, or content.
   - **Quick Actions**: One-tap delete, archive, or favorite.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                      IPHONE                            │
│  - Firefox iOS: Save to "📥 PocketBox" bookmark folder │
│  - Safari/PWA: Fullscreen Home Screen offline reader   │
└───────────────────────────┬────────────────────────────┘
                            │ Firefox Sync (Encrypted)
                            ▼
┌────────────────────────────────────────────────────────┐
│                   MAC (Localhost)                      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Firefox Extension (WebExtension Manifest v3)     │  │
│  │  - Listener for "📥 PocketBox" bookmark folder   │  │
│  │  - 1-click toolbar button                        │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │ REST API (localhost:3000)  │
│  ┌────────────────────────▼─────────────────────────┐  │
│  │ PocketBox Server (Node.js 24 + native node:sqlite│  │
│  │  - Readability engine (JSDOM + @mozilla/readabili│  │
│  │  - Local SQLite database (data/pocketbox.db)     │  │
│  │  - PWA Frontend (Next.js / Tailwind / SW)        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **macOS** with Node.js v24+ (native `node:sqlite` support).
- **Mozilla Firefox** on Mac and iPhone connected to the same free Firefox Sync account.
- **Home Wi-Fi** network for initial local syncing and PWA installation.

---

### 1. Clone & Launch the Server

Clone the repository and install dependencies:
```bash
git clone https://github.com/franzkappa/pocketbox.git
cd pocketbox
npm install
```

To start the local PocketBox server, run the executable startup script from the project folder:
```bash
./run.sh
```
Or use npm directly:
```bash
# Production mode (fastest)
npm run build
npm run start

# Development mode with hot-reloading
npm run dev
```

The server will be immediately accessible at:
- **Mac Browser**: [http://localhost:3000](http://localhost:3000)
- **Local Network (iPhone)**: `http://<your-mac-ip>:3000` (e.g. `http://192.168.1.19:3000`)

---

### 2. Install the Firefox Extension (Mac)

The extension allows 1-click tab saving on your Mac and automatically processes the bookmark intake queue.

1. Open **Firefox** on your Mac.
2. In the URL bar, go to:
   ```
   about:debugging#/runtime/this-firefox
   ```
3. Click the **"Load Temporary Add-on..."** button.
4. Navigate to this project folder and select `firefox-extension/manifest.json`.
5. The extension **PocketBox - Read It Later** is now active!
   - You will see the **📦 PocketBox** icon in your toolbar.
   - The extension automatically checks and initializes the `📥 PocketBox` folder in your bookmarks.

---

### 3. Asynchronous Sync from iPhone (Mac-Sleep Solution)

1. Ensure you are signed into **Firefox Sync** on both your Mac and your iPhone.
2. On your iPhone:
   - When browsing an article in Firefox iOS, tap the **Menu (☰)** > **Bookmark**.
   - Choose the `📥 PocketBox` folder.
3. Even if your Mac was asleep or powered off when you saved it:
   - The moment your Mac wakes up and Firefox is open, Firefox Sync downloads the bookmark.
   - The PocketBox extension detects it, sends it to `http://localhost:3000/api/articles` for clean full-text extraction, and deletes the bookmark from `📥 PocketBox` to keep your intake queue empty.

---

### 4. Install the Offline PWA on iPhone

1. On your iPhone, open **Safari** (connected to the same Wi-Fi as your Mac).
2. Navigate to your Mac's local IP:
   ```
   http://192.168.1.19:3000
   ```
   *(To find your Mac's current IP address, run `ipconfig getifaddr en0` in Terminal).*
3. Tap the **Share** button in Safari (square with an arrow pointing up).
4. Select **"Add to Home Screen"** (Aggiungi a schermata Home).
5. Name it **PocketBox** and tap **Add**.
6. Launch **PocketBox** from your iPhone Home Screen:
   - Opens as a **fullscreen native-like standalone app**.
   - All articles and images are automatically synchronized into local **IndexedDB** storage.
   - You can disconnect from Wi-Fi or turn off your Mac and read all saved articles offline anywhere.

---

## 🔌 REST API Reference

The server exposes clean REST endpoints with full CORS support:

### Articles

#### `GET /api/articles`
List articles with optional filters.
- **Query Parameters**:
  - `filter`: `inbox` (default), `archive`, `favorites`
  - `folder_id`: Filter by folder ID (e.g. `f-tech`)
  - `tag_id`: Filter by tag ID or name
  - `q`: Search query string (searches title, excerpt, site name, text content)
- **Response**:
  ```json
  {
    "success": true,
    "articles": [...]
  }
  ```

#### `POST /api/articles`
Extract article content from a URL and store in SQLite.
- **Request Body**:
  ```json
  {
    "url": "https://example.com/article",
    "folder_id": "f-tech",
    "tags": ["reading", "tech"]
  }
  ```
- **Response**: Returns HTTP 201 with the created article object.

#### `GET /api/articles/[id]`
Retrieve full article details, including clean `content_html` and full text.

#### `PATCH /api/articles/[id]`
Update article state.
- **Request Body**:
  ```json
  {
    "is_favorite": 1,
    "is_archived": 0,
    "folder_id": "f-work",
    "tags": ["priority"]
  }
  ```

#### `DELETE /api/articles/[id]`
Permanently delete an article and its tag associations.

---

### Folders & Tags

- `GET /api/folders` - List all folders with active article counts
- `POST /api/folders` - Create a folder `{ "name": "AI", "color": "#8B5CF6" }`
- `DELETE /api/folders/[id]` - Delete a folder
- `GET /api/tags` - List all tags with article counts
- `POST /api/tags` - Create a tag `{ "name": "research", "color": "#10B981" }`
- `DELETE /api/tags/[id]` - Delete a tag

---

## 📂 Project Structure

```
new pocket/
├── README.md                 # Complete documentation & usage guide
├── HANDOFF.md                # Fast-start & architecture handoff guide
├── run.sh                    # One-click startup script
├── package.json              # Unified Next.js full-stack configuration
├── tsconfig.json             # TypeScript configuration
├── next.config.mjs           # Next.js 15 config (server external packages)
├── tailwind.config.ts        # Tailwind typography & reader theme settings
├── data/
│   └── pocketbox.db          # Local SQLite database (WAL mode)
├── lib/
│   ├── db.ts                 # Native node:sqlite database operations
│   ├── extractor.ts          # Mozilla Readability + JSDOM content extraction
│   ├── offlineStorage.ts     # Client-side IndexedDB caching for iPhone
│   ├── cors.ts               # API CORS middleware
│   └── types.ts              # TypeScript interfaces
├── app/
│   ├── layout.tsx            # PWA shell, meta tags, and Service Worker registration
│   ├── page.tsx              # Main library view (Inbox, Archive, Favorites)
│   ├── globals.css           # Reader & Tailwind base styling
│   └── api/
│       ├── articles/         # Article CRUD & extraction endpoints
│       ├── folders/          # Folder management endpoints
│       └── tags/             # Tag management endpoints
├── components/
│   ├── Sidebar.tsx           # Responsive sidebar & mobile touch drawer
│   ├── ArticleCard.tsx       # Article preview card with quick actions
│   ├── ReaderView.tsx        # Minimalist distraction-free reader (4 themes)
│   └── AddArticleModal.tsx   # Manual URL input modal
├── public/
│   ├── manifest.json         # Standalone PWA Manifest
│   ├── sw.js                 # Service Worker for offline fallback
│   ├── favicon.svg           # Vector favicon
│   └── icons/                # High-res PWA & Apple touch icons
└── firefox-extension/        # Firefox WebExtension (Manifest v3)
    ├── manifest.json         # Extension manifest
    ├── background.js         # Bookmark listener & sync processor
    ├── popup.html            # 1-click toolbar action UI
    ├── popup.js              # Tab saving & queue trigger
    └── icons/                # Extension toolbar icons (16-128px)
```

---

## ❓ Troubleshooting & Tips

- **Mac IP changed**: If your home router assigns a new local IP to your Mac, run `ipconfig getifaddr en0` in Terminal to check the new IP, and navigate to that address on your iPhone.
- **Port 3000 in use**: If port 3000 is occupied, run `PORT=3001 ./run.sh` to start PocketBox on a different port.
- **Reloading the Firefox Extension**: In Firefox, visit `about:debugging#/runtime/this-firefox` and click the **"Reload"** button next to PocketBox to refresh changes.
- **Updating the iPhone PWA & Service Worker**: When you rebuild or update the server, close the standalone PWA on your iPhone by swiping it away from the App Switcher, then reopen it. The Service Worker (`pocketbox-v3`) will automatically activate the new version. If testing directly in Safari, a simple page refresh will fetch the updated version (or clear site data under *Settings > Safari > Advanced > Website Data*).
- **Clearing Offline Data on iPhone**: If you ever want to reset the offline cache on your iPhone, in Safari or the PWA open the app and refresh while connected to your home network.
