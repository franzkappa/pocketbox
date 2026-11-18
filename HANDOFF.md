# PocketBox - AI Agent Session Handoff & Architecture Guide

> **Current Status:** ✅ **Fully Implemented, Verified, and Operational**  
> All 6 phases defined in the project roadmap have been built, compiled, and tested end-to-end. The local Next.js server, native SQLite database, Readability engine, PWA offline caching layer, and Firefox WebExtension are active and functional.

---

## 📌 1. Project Overview & Environment

- **Project Name**: `PocketBox`
- **Location**: `/Users/federicocaruso/Documents/LLM projects/new pocket`
- **Primary Stack**:
  - **Runtime**: Node.js `v24.21.0` (at `~/.local/node/bin/node`)
  - **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
  - **Styling**: Tailwind CSS + Lucide Icons
  - **Database**: Native `node:sqlite` (`DatabaseSync` in Node 24, WAL mode enabled)
  - **Article Parser**: `@mozilla/readability` + `jsdom`
  - **Offline Storage**: Service Worker (`public/sw.js`) + IndexedDB (`lib/offlineStorage.ts`)
  - **Browser Extension**: Firefox WebExtension (Manifest V3, `firefox-extension/`)

---

## 🏗️ 2. System Architecture & Workflows

```
┌────────────────────────────────────────────────────────────────┐
│                           IPHONE                               │
│  - Firefox iOS: Save to "📥 PocketBox" bookmark folder         │
│  - Safari PWA: Standalone Home Screen App (Offline IndexedDB)  │
└───────────────────────────────┬────────────────────────────────┘
                                │ Firefox Sync (Encrypted Mozilla Cloud)
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                        MAC (Localhost)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Firefox Extension (Manifest V3)                          │  │
│  │  - Monitors bookmark folder: "📥 PocketBox"              │  │
│  │  - Sends POST /api/articles to local server              │  │
│  │  - Removes bookmark on success (keeps queue clean)       │  │
│  │  - 1-click toolbar popup to save active tab              │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │ HTTP REST (localhost:3000)     │
│  ┌────────────────────────────▼─────────────────────────────┐  │
│  │ PocketBox Next.js Server (:3000)                         │  │
│  │  - Content Extractor (@mozilla/readability + JSDOM)      │  │
│  │  - Native SQLite (data/pocketbox.db, WAL mode)           │  │
│  │  - Next.js UI + Distraction-Free Reader                  │  │
│  │  - PWA Manifest + Service Worker + Cache Fallback        │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### The "Mac-Sleep" Asynchronous Queue Flow
1. While away from home or when the Mac is asleep/turned off, the user finds an article in Firefox on iPhone.
2. The user saves the bookmark into the designated folder: `📥 PocketBox`.
3. Firefox Sync pushes this bookmark across Mozilla's encrypted sync servers.
4. When the Mac wakes up and Firefox is opened, the PocketBox extension:
   - Detects the new bookmarks via `browser.bookmarks.onCreated` and on startup.
   - Forwards each URL to `http://localhost:3000/api/articles`.
   - On successful ingestion, deletes the bookmark from `📥 PocketBox` so the folder remains a clean queue.
   - If the local server is temporarily offline, bookmarks remain in the folder and are retried automatically.

### The iPhone Offline PWA Flow
1. The user connects their iPhone to their home Wi-Fi and opens `http://<mac-ip>:3000` in Safari.
2. The user taps **Share > Add to Home Screen**.
3. PocketBox launches as a fullscreen standalone iOS application with no browser bars.
4. Every time articles are fetched, they are automatically replicated into the phone's **IndexedDB** (`pocketbox_offline`).
5. When offline or traveling (or when the Mac is powered down), the application seamlessly serves all saved articles and images directly from the local IndexedDB cache.

---

## 🗄️ 3. Database Schema (`data/pocketbox.db`)

Managed by [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts) using Node 24 `node:sqlite`:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#10B981'
);

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  byline TEXT,
  excerpt TEXT,
  content_html TEXT,
  text_content TEXT,
  site_name TEXT,
  lead_image_url TEXT,
  reading_time_minutes INTEGER NOT NULL DEFAULT 1,
  folder_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS article_tags (
  article_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

Default seeded folders: `Technology`, `Work`, `Long Reads`, `Personal`.  
Default seeded tags: `must-read`, `quick`, `reference`.

---

## 🔌 4. Implemented REST API Endpoints

All endpoints support CORS (`*`) for cross-origin extension requests and return JSON:

| Method | Endpoint | Description | Query / Body Parameters |
|---|---|---|---|
| `GET` | `/api/articles` | List articles with filters | `?filter=inbox\|archive\|favorites&folder_id=...&tag_id=...&q=...` |
| `POST` | `/api/articles` | Extract & save an article | `{ "url": "https://...", "folder_id": "...", "tags": ["tag1"] }` |
| `GET` | `/api/articles/[id]` | Get single article with full HTML | None |
| `PATCH` | `/api/articles/[id]` | Update article state | `{ "is_read": 1, "is_favorite": 1, "is_archived": 1, "folder_id": "..." }` |
| `DELETE` | `/api/articles/[id]` | Delete article permanently | None |
| `GET` | `/api/folders` | List all folders with counts | None |
| `POST` | `/api/folders` | Create a folder | `{ "name": "AI", "color": "#8B5CF6" }` |
| `DELETE` | `/api/folders/[id]` | Delete a folder | None |
| `GET` | `/api/tags` | List all tags with counts | None |
| `POST` | `/api/tags` | Create a tag | `{ "name": "coding", "color": "#10B981" }` |
| `DELETE` | `/api/tags/[id]` | Delete a tag | None |

---

## 💻 5. Frontend & Reader Features

- **App Shell** ([`app/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/page.tsx)):
  - Top navigation bar with instant live search and "+ Add URL" quick modal.
  - Safe Area top inset support (`.pt-safe`), ensuring elements are never placed under the iOS status bar (clock, battery, Wi-Fi) on iPhone SE (2nd/3rd gen) and notch/Dynamic Island devices.
  - Responsive layout optimized for 375px screens: responsive search bar (`w-32` expanding on focus), horizontally scrollable filter chips with one-click clear.
  - Dynamic viewport sizing (`h-[100dvh]`) preventing layout shift from mobile Safari toolbars.
  - Responsive layout: desktop persistent sidebar, mobile slide-out touch drawer (`max-w-[280px]` with safe area clearance).
- **Article Cards** ([`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx)):
  - Thumbnail preview, domain name, estimated reading time, folder/tag badges, date saved.
  - One-tap quick actions: Favorite, Archive, Delete with min 34px tap targets and `touch-manipulation`.
- **Distraction-Free Reader** ([`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx)):
  - 4 themes:
    1. **Paper Light**: Crisp reading paper (`#FCFCFC`, text `#1C1C1E`)
    2. **Warm Sepia**: Book cream (`#F8F1E5`, text `#3E2723`)
    3. **Dark Slate**: Modern dark mode (`#181C22`, text `#DDE2E8`)
    4. **Pure OLED Black**: Pitch black for OLED screens (`#000000`, text `#EDEDED`)
  - Typography controls: **Serif** (Charter/Georgia), **Sans** (System/Inter), **Mono**.
  - Font size adjustment (`14px` - `28px`) persisted in `localStorage`.
  - Header with `pt-safe` and reading progress bar positioned at the bottom edge of the header for optimal visibility.
  - Reading container with bottom safe area clearance (`pb-[calc(var(--sab)+3rem)]`) and `overscroll-contain`.
  - Keyboard shortcuts: `Escape` to close reader.
- **Add Article Modal** ([`components/AddArticleModal.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/AddArticleModal.tsx)):
  - Modal with `pt-safe pb-safe` and scrollable content to ensure usability even when the iOS virtual keyboard is visible on 667px height devices.
  - Mobile input font-size configured to `16px` (`text-base md:text-sm`) to prevent iOS Safari auto-zooming.
- **Offline Storage & Service Worker** ([`lib/offlineStorage.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/offlineStorage.ts) & [`public/sw.js`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/public/sw.js)):
  - Service Worker `pocketbox-v3` with **Network-First** strategy for HTML navigation requests (ensuring fresh deployments load immediately when online, falling back to cache when offline).
  - IndexedDB store (`pocketbox_offline`) that automatically caches articles when connected and serves them transparently when offline.

---

## 🦊 6. Firefox Extension Details (`firefox-extension/`)

- **Manifest V3**: Configured for Firefox with Gecko ID `pocketbox@local.selfhosted`.
- **Permissions**: `bookmarks`, `activeTab`, `tabs`, `storage`, `notifications`, `alarms`.
- **Host Permissions**: `http://localhost:3000/*`, `http://127.0.0.1:3000/*`.
- **Background Worker** (`background.js`):
  - On startup and every 2 minutes (alarms API), checks the `📥 PocketBox` bookmarks folder.
  - Ingests bookmarks into `http://localhost:3000/api/articles` and deletes them from the bookmark queue.
  - If server is unreachable, bookmarks remain intact for the next cycle.
- **Toolbar Action Popup** (`popup.html`, `popup.js`):
  - Inspects active tab title & URL.
  - Loads folders and tags dynamically from localhost.
  - 1-click "Save to PocketBox" button with success animations.
  - "Sync Bookmark Queue Now" manual trigger.

---

## 🔧 7. Technical Notes & Quirks

1. **Native `node:sqlite` in Node 24**:
   - `DatabaseSync` is a built-in module. In `next.config.mjs`, it is listed under `serverExternalPackages: ['node:sqlite', 'jsdom', '@mozilla/readability']` to prevent bundler errors.
   - When mapping row objects in TypeScript, cast using `as unknown as (Article & { ... })[]` because `node:sqlite` outputs `Record<string, SQLOutputValue>`.
2. **CORS on API Endpoints**:
   - The Firefox extension runs with an `moz-extension://` origin. Route handlers implement OPTIONS and return `Access-Control-Allow-Origin: *` via `lib/cors.ts`.
3. **PWA Standalone Display & Safe Areas on iOS**:
   - `app/layout.tsx` includes `viewportFit: 'cover'`, `apple-mobile-web-app-capable: yes`, and `black-translucent` status bar.
   - To prevent content from overlapping the iOS status bar (clock, battery, Wi-Fi) and Apple's progressive blur/gradient scrim, CSS safe area variables `--sat`, `--sab` and utility class `.pt-safe` are declared in `app/globals.css`.
   - On iOS standalone PWA, Apple applies a ~50px progressive blur scrim across the top with `black-translucent`. A CSS rule `@supports (-webkit-touch-callout: none) { @media all and (display-mode: standalone), all and (display-mode: fullscreen) { :root { --sat: max(env(safe-area-inset-top, 0px), 52px); } } }` together with synchronous `ios-standalone` detection in `<head>` guarantees at least 52px status bar clearance even on classic bezel devices like iPhone SE (2nd & 3rd gen), ensuring all labels, buttons, and text remain 100% crisp with zero blurring.
   - Text inputs across modals and search bars enforce `text-base` (16px) on mobile viewports to prevent iOS Safari from automatically zooming into the page on focus.
   - `public/sw.js` uses `pocketbox-v3` with Network-First navigation so that newly deployed builds take effect immediately upon reload.

---

## 🔮 8. Roadmap & Future Enhancement Opportunities

1. **SQLite FTS5 Full-Text Search**:
   - Can easily be added via a virtual table (`CREATE VIRTUAL TABLE articles_fts USING fts5(...)`) for instant indexed snippet search across thousands of long articles.
2. **Automatic Mac Background Daemon**:
   - Create a macOS `launchd` plist (`~/Library/LaunchAgents/com.pocketbox.server.plist`) to keep the PocketBox server running silently on boot without keeping a terminal window open.
3. **EPUB / PDF Export**:
   - Add a download button in the reader to export clean articles as `.epub` for e-ink readers (Kindle, Kobo) or formatted `.pdf`.
4. **Highlights & Notes**:
   - Text selection listener in `ReaderView.tsx` to store user highlights and personal marginalia in an `article_highlights` table.
