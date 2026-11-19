# PocketBox - AI Agent Session Handoff & Architecture Guide

> **Current Status:** ✅ **Fully Implemented, Verified, and Published (Release v0.1.0)**  
> All phases including the 24/7 Cloud Architecture (Vercel + Turso SQLite), the native iOS Shortcuts 1-Tap Save integration, the PWA offline caching layer, and the Firefox WebExtension are active and verified end-to-end. The user's phone is 100% independent from the Mac. Initial release **v0.1.0** is officially published on GitHub with pre-packaged extension assets. Discoverability optimizations (14 curated GitHub topics and 1-Click Vercel Deploy) are live on repository `franzkappa/pocketbox`.

---

## 📌 1. Project Overview & Environment

- **Project Name**: `PocketBox`
- **Location**: `/Users/federicocaruso/Documents/LLM projects/new pocket`
- **Current Version**: `0.1.0` (Tag `v0.1.0`, published on [GitHub Releases](https://github.com/franzkappa/pocketbox/releases/tag/v0.1.0))
- **GitHub Repository**: [https://github.com/franzkappa/pocketbox](https://github.com/franzkappa/pocketbox) (Public, `main` branch synced with `origin/main`)
- **Repository Topics**: `pocket-alternative`, `omnivore-alternative`, `read-it-later`, `reading-list`, `bookmark-manager`, `self-hosted`, `offline-first`, `pwa`, `ios-shortcuts`, `firefox-extension`, `turso`, `sqlite`, `nextjs`, `react`
- **1-Click Deploy Link**: Configured with Vercel deploy button pre-populating `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `POCKETBOX_PASSWORD`
- **Live Production URL**: `https://pocketboxnew.vercel.app`
- **Primary Stack**:
  - **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
  - **Styling**: Tailwind CSS + Lucide Icons
  - **Database Engine**: Hybrid `@libsql/client` (Turso Cloud SQLite via `libsql://` in production; local `./data/pocketbox.db` as development fallback)
  - **Cloud Hosting**: Vercel Serverless (24/7 always-on, zero cold spin-down for UI, automatic SSL)
  - **Article Parser**: `@mozilla/readability` + `jsdom`
  - **Offline Storage**: Service Worker (`public/sw.js`, `pocketbox-v5`) + IndexedDB (`lib/offlineStorage.ts`)
  - **iOS Ingestion**: Native iOS Shortcut via Apple Share Sheet calling `/api/save`
  - **Browser Extension**: Firefox WebExtension (Manifest V3, `firefox-extension/` with configurable Cloud URL & API Key)

---

## 🏗️ 2. System Architecture & Workflows

```
┌────────────────────────────────────────────────────────────────┐
│                           IPHONE                               │
│  - iOS Share Sheet: 1-Tap Save via Apple Shortcut              │
│  - Safari PWA: Standalone Home Screen App (Offline IndexedDB)  │
└───────────────────────────────┬────────────────────────────────┘
                                │ HTTPS REST
                                ▼
┌────────────────────────────────────────────────────────────────┐
│                    VERCEL CLOUD (24/7)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ PocketBox Serverless API (Next.js 15 App Router)         │  │
│  │  - Content Extractor (@mozilla/readability + JSDOM)      │  │
│  │  - Auth & CORS Middleware (lib/auth.ts, lib/cors.ts)     │  │
│  │  - Ingestion Endpoints (/api/save, /api/articles)        │  │
│  │  - PWA Frontend & Distraction-Free Reader               │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │ libsql:// (TLS / HTTP)         │
│  ┌────────────────────────────▼─────────────────────────────┐  │
│  │ TURSO CLOUD SQLITE (Serverless SQLite Database)          │  │
│  │  - articles, folders, tags, article_tags tables          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────────▲────────────────────────────────┘
                                │ HTTPS REST
┌───────────────────────────────┴────────────────────────────────┐
│                        MAC (DESKTOP)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Firefox Extension (Manifest V3)                          │  │
│  │  - 1-click toolbar popup with active tab DOM extraction  │  │
│  │  - Configurable Cloud Server URL & Password in settings  │  │
│  │  - Automatic background sync of "📥 PocketBox" folder    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### iPhone 1-Tap Save Flow (iOS Shortcuts)
1. User browses any article in Safari, Firefox, Chrome, or any app on iPhone.
2. User taps **Share > PocketBox**.
3. The Apple Shortcut executes an HTTP POST to `https://pocketboxnew.vercel.app/api/save?key=<password>` with JSON body `{"URL": Shortcut Input}`.
4. The serverless backend fetches the URL, runs Mozilla Readability, strips clutter/ads, extracts byline, reading time, and lead image, and persists the record into Turso SQLite.
5. The shortcut receives a JSON response `{ success: true, title: "..." }` and shows a native iOS confirmation notification.
6. The user does not need their computer to be turned on.

### iPhone Offline PWA Reading Flow
1. User opens `https://pocketboxnew.vercel.app` in Safari on iPhone and taps **Share > Add to Home Screen**.
2. PocketBox runs as a standalone fullscreen app (`display: standalone`, `apple-mobile-web-app-capable`).
3. Whenever online, all articles (including full `content_html`) are automatically synchronized to client-side **IndexedDB** (`pocketbox_offline`).
4. When the device is offline or in airplane mode, the Service Worker (`pocketbox-v5`) serves the app shell from cache, and the reader displays articles seamlessly from IndexedDB.

### Mobile & Desktop Refresh Flow (Pull-to-Refresh & Rotating Reload Button)
1. **Pull-to-Refresh Gesture**:
   - Implemented via [`components/PullToRefresh.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/PullToRefresh.tsx) using non-passive touch event listeners (`passive: false`) attached directly to the main container.
   - When at `scrollTop <= 0`, dragging downward applies a damping curve (`Math.min(90, dy * 0.45)`), rotates the indicator arrow proportionally, and emits a haptic tick via `navigator.vibrate(10)` upon passing the 65px threshold.
   - On release, the indicator locks at 48px, displays `"Aggiornamento..."` with an active spin animation, and silently triggers `fetchArticles(true)` and `fetchMetadata()`.
2. **Rotating Arrow Button (Header & Sidebar)**:
   - Tapping the `RefreshCw` button in the top navbar or the sidebar footer activates `animate-spin` on the icon and re-queries the cloud database in the background.
   - The UI does not clear or show an empty skeleton, ensuring continuous reading without screen flashing.
3. Once updated, articles are updated in place and synchronized to IndexedDB for offline resilience.

### Desktop Firefox Extension Flow
1. User clicks the PocketBox toolbar icon in Firefox on Mac.
2. In settings (⚙️), the extension is configured with Server URL `https://pocketboxnew.vercel.app` and password.
3. The extension injects `document.documentElement.outerHTML` into the active tab to extract client-rendered DOM (bypassing DataDome / Cloudflare anti-bot blocks on paywalled news sites like *Libération*).
4. The active tab DOM is sent to `/api/articles` with Bearer auth, ingested into Turso, and available across all devices.

---

## 🗄️ 3. Database Schema (Turso Cloud SQLite)

Managed by [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts) using `@libsql/client`:

```sql
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

CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(is_archived, is_favorite, is_read);
CREATE INDEX IF NOT EXISTS idx_articles_folder ON articles(folder_id);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
```

Default seeded folders: `Technology`, `Work`, `Long Reads`, `Personal`.  
Default seeded tags: `must-read`, `quick`, `reference`.

---

## 🔌 4. Implemented REST API Endpoints

All endpoints support CORS (`*`) and flexible authentication (`Authorization: Bearer <token>`, `X-API-Key: <token>`, `?key=<token>`, or session cookie):

| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/save` | High-speed ingestion for iOS Shortcuts & bookmarklets. Sanitizes nested iOS variable objects and query params (`?url=...&key=...` or JSON `{ "URL": "..." }`) |
| `GET` | `/api/articles` | List articles with filters (`?filter=inbox\|archive\|favorites&folder_id=...&tag_id=...&q=...`) |
| `POST` | `/api/articles` | Ingest article from URL or client-rendered HTML |
| `GET` | `/api/articles/[id]` | Get single article with full HTML |
| `PATCH` | `/api/articles/[id]` | Update article state (`is_read`, `is_favorite`, `is_archived`, `folder_id`, `tags`) |
| `DELETE` | `/api/articles/[id]` | Delete article permanently |
| `GET` | `/api/auth/status` | Diagnostic healthcheck (returns database type, status, folders count, auth status) |
| `POST` | `/api/auth/login` | Authenticate with password/PIN, sets 1-year HttpOnly session cookie |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `GET` / `POST` | `/api/folders` | List or create folders |
| `DELETE` | `/api/folders/[id]` | Delete folder |
| `GET` / `POST` | `/api/tags` | List or create tags |
| `DELETE` | `/api/tags/[id]` | Delete tag |

---

## 🔧 5. Technical Notes & Quirks

1. **CORS Headers (`lib/cors.ts`)**:
   - `Access-Control-Allow-Headers` is explicitly set to `*` to allow custom headers (`X-API-Key`, `Authorization`, `Content-Type`) from the Firefox extension and cross-origin callers without preflight rejections.
2. **iOS Shortcut Variable Serialization**:
   - In Apple Shortcuts, when using `Get Contents of URL` with method `GET`, query params must contain the actual variable token `Shortcut Input`, not literal text.
   - For `POST` requests, the Request Body JSON should specify key `URL` and value set to the dynamic variable token `Shortcut Input`.
   - `/api/save` and `/api/articles` are built with an ultra-flexible extractor (`extractUrl`) that can extract valid `https://` URLs from JSON strings, nested objects (`{ URL: ... }`, `{ url: ... }`), plain text, and query parameters.
3. **PWA Standalone Display & Safe Areas on iOS**:
   - `app/layout.tsx` enforces `viewportFit: 'cover'`, `apple-mobile-web-app-capable: yes`, and `black-translucent` status bar.
   - CSS safe area variables `--sat` and `.pt-safe` ensure minimum 52px clearance on classic bezel devices like iPhone SE (2nd/3rd gen) to avoid Apple's status bar scrim.
   - Mobile text inputs enforce `text-base` (16px) to eliminate iOS Safari automatic zoom on focus.
4. **Anti-Bot & Paywall Bypass**:
   - Paywalled sites deploying DataDome or Cloudflare WAF block serverless fetches with HTTP 403 Forbidden.
   - The Firefox extension circumvents this by executing `document.documentElement.outerHTML` from the user's active tab and posting the already-authenticated DOM directly to `/api/articles`.
5. **Mobile Gestures & Instant Refresh**:
   - Native-feeling **Pull-to-Refresh** (`components/PullToRefresh.tsx`) allows scrolling down at the top on iPhone/Android to refresh articles and metadata with rotation physics, haptic feedback (`navigator.vibrate`), and smooth snap animations.
   - Dedicated **rotating arrow refresh button** in the top navbar and sidebar footer, executing background re-fetching without blanking out the article list.
6. **1-Click Vercel Deploy & Environment Pre-population**:
   - The repository integrates a Vercel 1-click clone URL (`https://vercel.com/new/clone?repository-url=...`) with parameters `env`, `envDescription`, and `envLink`.
   - Vercel automatically requests `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `POCKETBOX_PASSWORD` during onboarding, linking directly to the Turso setup anchor, eliminating setup friction for new users.

---

## 🔮 6. Future Enhancements

1. **Full-Text Search (FTS5 / libSQL virtual table)**:
   - Index article body text in Turso for instant snippet searching across thousands of long articles.
2. **EPUB / PDF Export**:
   - Add a download action in `ReaderView.tsx` to export clean articles formatted for Kindle / Kobo e-readers.
3. **Highlights & Notes**:
   - Text selection listener in `ReaderView.tsx` to persist user highlights and marginalia in an `article_highlights` table.
