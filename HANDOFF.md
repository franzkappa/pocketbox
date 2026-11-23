# PocketBox - AI Agent Session Handoff & Architecture Guide

> **Current Status:** ✅ **Fully Implemented, Verified, and Published (Release v0.2.0 — Gmail Newsletter Archiving, Dedicated Newsletters View, Autonomous Multi-Signal Newsletter Folder Organization, Post-Save Tag & Folder Management & Mobile UX Fixes)**  
> All phases including the 24/7 Cloud Architecture (Vercel + Turso SQLite), the native iOS Shortcuts 1-Tap Save integration, the PWA offline caching layer (`pocketbox-v7`), the Firefox WebExtension (`v0.3.0` with targeted Gmail newsletter extraction and real-time auto-folder preview), mobile GPU rendering optimizations (zero-re-render scroll & anti-flicker images), responsive reader appearance popover positioning, post-save article tag & folder management, dedicated newsletter archiving/reading, and autonomous multi-signal newsletter folder clustering are active and verified end-to-end. The user's phone is 100% independent from the Mac. Release **v0.2.0** is officially published on GitHub with pre-packaged extension assets. Discoverability optimizations (14 curated GitHub topics and 1-Click Vercel Deploy) are live on repository `franzkappa/pocketbox`.

---

## 📌 1. Project Overview & Environment

- **Project Name**: `PocketBox`
- **Location**: `/Users/federicocaruso/Documents/LLM projects/new pocket`
- **Current Version**: `0.2.0` (Tag `v0.2.0`, published on [GitHub Releases](https://github.com/franzkappa/pocketbox/releases/tag/v0.2.0))
- **GitHub Repository**: [https://github.com/franzkappa/pocketbox](https://github.com/franzkappa/pocketbox) (Public, `main` branch synced with `origin/main`)
- **Repository Topics**: `pocket-alternative`, `omnivore-alternative`, `read-it-later`, `reading-list`, `bookmark-manager`, `self-hosted`, `offline-first`, `pwa`, `ios-shortcuts`, `firefox-extension`, `turso`, `sqlite`, `nextjs`, `react`
- **1-Click Deploy Link**: Configured with Vercel deploy button pre-populating `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `POCKETBOX_PASSWORD`
- **Live Production URL**: `https://pocketboxnew.vercel.app`
- **Primary Stack**:
  - **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
  - **Styling**: Tailwind CSS + Lucide Icons
  - **Database Engine**: Hybrid `@libsql/client` (Turso Cloud SQLite via `libsql://` in production; local `./data/pocketbox.db` as development fallback)
  - **Cloud Hosting**: Vercel Serverless (24/7 always-on, zero cold spin-down for UI, automatic SSL)
  - **Article & Newsletter Parser**: `@mozilla/readability` + custom `extractNewsletter` HTML cleaner (`jsdom`) + multi-signal newsletter series classifier (`lib/newsletterClassifier.ts`)
  - **Offline Storage**: Service Worker (`public/sw.js`, `pocketbox-v7`) + IndexedDB (`lib/offlineStorage.ts`)
  - **iOS Ingestion**: Native iOS Shortcut via Apple Share Sheet calling `/api/save`
  - **Browser Extension**: Firefox WebExtension (Manifest V3, `v0.3.0`, `firefox-extension/` with configurable Cloud URL, API Key, targeted Gmail newsletter extractor, and automatic newsletter folder detection preview)

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
4. When the device is offline or in airplane mode, the Service Worker (`pocketbox-v6`) serves the app shell from cache, and the reader displays articles and newsletters seamlessly from IndexedDB.

### Mobile & Desktop Refresh Flow (Pull-to-Refresh & Rotating Reload Button)
1. **Pull-to-Refresh Gesture**:
   - Implemented via [`components/PullToRefresh.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/PullToRefresh.tsx) using non-passive touch event listeners (`passive: false`) attached directly to the main container.
   - When at `scrollTop <= 0`, dragging downward applies a damping curve (`Math.min(90, dy * 0.45)`), rotates the indicator arrow proportionally, and emits a haptic tick via `navigator.vibrate(10)` upon passing the 65px threshold.
   - On release, the indicator locks at 48px, displays `"Aggiornamento..."` with an active spin animation, and silently triggers `fetchArticles(true)` and `fetchMetadata()`.
2. **Rotating Arrow Button (Header & Sidebar)**:
   - Tapping the `RefreshCw` button in the top navbar or the sidebar footer activates `animate-spin` on the icon and re-queries the cloud database in the background.
   - The UI does not clear or show an empty skeleton, ensuring continuous reading without screen flashing.
3. Once updated, articles are updated in place and synchronized to IndexedDB for offline resilience.

### Desktop Firefox Extension Flow (Articles & Gmail Newsletters)
1. User clicks the PocketBox toolbar icon in Firefox on Mac.
2. In settings (⚙️), the extension is configured with Server URL `https://pocketboxnew.vercel.app` and password.
3. **Standard web pages**: The extension injects `extractCleanPageHtmlInPage` to capture client-rendered DOM while stripping `<script>`, `<style>`, `<noscript>`, `<template>`, large `<svg>`, and oversized base64 data URIs (bypassing DataDome / Cloudflare anti-bot blocks on paywalled news sites like *Libération* while keeping request payloads safely under Vercel's 4.5MB limit).
4. **Gmail newsletters (`mail.google.com`)**: On popup open, the extension automatically injects `extractGmailNewsletterInPage` to extract *only* the currently open email (`.a3s.aiL` / `.a3s`, or Gmail's standalone `view=lg` / `view=pt` "View entire message" page), capturing subject, sender (`site_name` + `byline`), cleaned body HTML, clipped-message status, and public *"View in browser"* / *"Leggi nel browser"* web URL (falling back to a stable Gmail `#all/<threadId>` permalink).
5. The payload is sent to `POST /api/articles` with Bearer auth (`source_type: 'article' | 'newsletter'`), ingested into Turso, and synced across all devices.

---

## 🗄️ 3. Database Schema (Turso Cloud SQLite)

Managed by [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts) using `@libsql/client`:

```sql
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366F1',
  folder_type TEXT NOT NULL DEFAULT 'article',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_rules (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  sender_email TEXT,
  sender_domain TEXT,
  sender_name TEXT,
  subject_prefix TEXT,
  masthead TEXT,
  utm_campaign TEXT,
  web_host TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
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
  source_type TEXT NOT NULL DEFAULT 'article',
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
CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_newsletter_rules_folder ON newsletter_rules(folder_id);
```

*(Note: `ensureSchema` runs idempotent `PRAGMA table_info(articles)` and `PRAGMA table_info(folders)` checks and automatically executes `ALTER TABLE articles ADD COLUMN source_type TEXT NOT NULL DEFAULT 'article'` and `ALTER TABLE folders ADD COLUMN folder_type TEXT NOT NULL DEFAULT 'article'` on existing SQLite/Turso databases.)*

Default seeded folders (`folder_type = 'article'`): `Technology`, `Work`, `Long Reads`, `Personal`.  
Default seeded tags: `must-read`, `quick`, `reference`.

---

## 🔌 4. Implemented REST API Endpoints

All endpoints support CORS (`*`) and flexible authentication (`Authorization: Bearer <token>`, `X-API-Key: <token>`, `?key=<token>`, or session cookie):

| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/save` | High-speed ingestion for iOS Shortcuts & bookmarklets. Sanitizes nested iOS variable objects and query params (`?url=...&key=...` or JSON `{ "URL": "..." }`) |
| `GET` | `/api/articles` | List articles & newsletters with filters (`?filter=inbox\|newsletters\|archive\|favorites&folder_id=...&tag_id=...&q=...`) |
| `POST` | `/api/articles` | Ingest article or newsletter (`source_type: 'article' \| 'newsletter'`, optional `site_name`, `byline`, `sender_email`, `sender_name`, `folder_name`, `auto_folder`) with automatic newsletter folder resolution |
| `GET` | `/api/articles/[id]` | Get single article with full HTML |
| `PATCH` | `/api/articles/[id]` | Update article state (`is_read`, `is_favorite`, `is_archived`, `folder_id`, `tags`; moving a newsletter automatically updates learned `newsletter_rules`) |
| `DELETE` | `/api/articles/[id]` | Delete article permanently |
| `GET` | `/api/auth/status` | Diagnostic healthcheck (returns database type, status, folders count, auth status) |
| `POST` | `/api/auth/login` | Authenticate with password/PIN, sets 1-year HttpOnly session cookie |
| `POST` | `/api/auth/logout` | Clears session cookie |
| `GET` / `POST` | `/api/folders` | List or create folders (`?type=article\|newsletter`, `folder_type: 'article' \| 'newsletter'`) |
| `PATCH` / `DELETE` | `/api/folders/[id]` | Rename, recolor, or delete folder |
| `POST` | `/api/folders/detect-newsletter` | Multi-signal newsletter classifier endpoint (returns `matchedFolder` or `suggestedFolderName` + extracted signals) |
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
7. **Mobile Scroll Performance & Zero-Flicker Image Rendering**:
   - **Zero Re-Render Scroll Progress**: In [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx), scroll progress tracking is decoupled from React component state (`scrollProgress`). Progress bar updates are applied directly to the DOM node via `requestAnimationFrame`. This eliminates 60–120 re-renders per second on ProMotion (120Hz) mobile displays, preventing layout thrashing and continuous GPU texture invalidation.
   - **Touch-Aware Hover Isolation**: Enabled `future: { hoverOnlyWhenSupported: true }` in [`tailwind.config.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/tailwind.config.ts). Tailwind wraps `:hover` rules within `@media (hover: hover) and (pointer: fine)`. On mobile touchscreens, dragging a finger to scroll no longer triggers desktop hover animations (such as thumbnail zooming `group-hover:scale-105` or card movement `hover:-translate-y-0.5`), completely eliminating visual card stutter during scroll.
   - **WebKit GPU Layer Isolation & Anti-Flicker**: Added hardware acceleration (`transform: translateZ(0)`, `-webkit-transform: translateZ(0)`, `backface-visibility: hidden`, and `isolation: isolate`) to [`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx), `ReaderView` lead image, and article body images (`.reader-content img` in [`app/globals.css`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/globals.css)). This resolves a known WebKit/Safari bug where `overflow: hidden` containers with `border-radius` drop clipping masks or flash white during momentum scrolling.
   - **Asynchronous Image Decoding (`decoding="async"`)**: Added `decoding="async"` in [`lib/extractor.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/extractor.ts) for newly saved articles and an automatic effect in `ReaderView.tsx` for existing articles, offloading image decoding from the main UI thread during fast scrolling.
8. **Reader Appearance Menu Positioning & Viewport Safety**:
   - In [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx), the typography and appearance popover previously used `absolute right-0` relative to the Type button container. Because the Type button has three action buttons (Favorite, Archive, ExternalLink) and container padding to its right (~140px total distance from the right edge), a 256px (`w-64`) menu aligned to its right edge pushed the left boundary of the popover ~395px from the right edge of the screen.
   - On mobile screens (e.g., iPhone SE at 375px or iPhone 13/14/15/16 at 390px), this caused the menu to overhang the left edge of the screen by 5–20px.
   - Fixed by centering the popover directly beneath the button with `left-1/2 -translate-x-1/2`. This ensures comfortable margins (~30px right, ~75–105px left) on all mobile devices while staying neatly anchored under the button on desktop.
   - Added a click/touch-outside dismissal listener (`settingsRef` on mousedown and touchstart) and updated the `Escape` key shortcut to close the settings menu first before closing the reader view.
9. **Post-Save Article Tag Management**:
   - Added [`components/ArticleTagsModal.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleTagsModal.tsx) (`z-[60]` to cleanly layer above `ReaderView` at `z-50`) for toggling existing tags, creating new tags (via `Enter`, `,`, or explicit `+ Add` button for mobile), and clearing/removing assigned tags on already-saved articles.
   - Wired entry points in [`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx) (dedicated Tag quick-action button + clickable `#tag` pill) and [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx) (header Tag action icon + theme-aware tag pills row under the article title with 1-click `×` removal and `+ Add tag` button).
   - [`app/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/page.tsx) applies optimistic updates across the article grid (respecting active `selectedTagId` filtering), open `ReaderView`, and IndexedDB (`updateCachedArticleOffline`), persists via `PATCH /api/articles/[id]`, reconciles returned DB tag IDs/colors, and refreshes sidebar metadata.
   - Hardened [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts) and [`app/api/articles/[id]/route.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/api/articles/%5Bid%5D/route.ts) with tag normalization (leading `#` stripping & deduplication), `updated_at` touch on tag-only updates, and `400` array validation.
10. **Post-Save Article Folder Management**:
   - Added [`components/ArticleFolderModal.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleFolderModal.tsx) (`z-[60]` above `ReaderView`) with 1-tap folder switching, `"No Folder (General)"` unassignment, and inline colored folder creation (`Create & Move`).
   - Wired entry points in [`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx) (dedicated Folder quick-action button + clickable folder pill in a dedicated pills row above the footer divider to prevent crowding on mobile) and [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx) (header Folder action icon + theme-aware folder pill under the title with click-to-change and 1-click `×` removal, or `Add to folder` button).
   - [`app/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/page.tsx) handles optimistic updates across the article grid (respecting active `selectedFolderId` filter), open `ReaderView`, and IndexedDB (`updateCachedArticleOffline`), persists via `PATCH /api/articles/[id]` with `{ folder_id }`, rolls back on server errors, and refreshes sidebar folder counts.
   - Hardened [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts), [`app/api/articles/[id]/route.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/api/articles/%5Bid%5D/route.ts), and [`app/api/folders/route.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/api/folders/route.ts) with `getFolderById` existence validation (`404`), `folder_id` type/empty-string normalization (`400` / `null`), and duplicate folder name `409` handling.
11. **Gmail Newsletter Archiving & Dedicated Newsletters View**:
   - **Root Cause Fixed**: Previously, clicking the Firefox extension on Gmail serialized the entire Gmail web app DOM (`document.documentElement.outerHTML`, often 5–15 MB), exceeding Vercel's 4.5 MB Serverless Function request body limit. Vercel's edge gateway rejected it with `413 Payload Too Large` without Next.js CORS headers, surfacing in Firefox `fetch()` as `Save failed: NetworkError when attempting to fetch resource.`.
   - **Targeted Gmail DOM Extraction ([`firefox-extension/popup.js`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/firefox-extension/popup.js), [`firefox-extension/popup.html`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/firefox-extension/popup.html), `v0.2.0`)**: Detects `mail.google.com` tabs on popup open and injects `extractGmailNewsletterInPage` to extract *only* the open email body (`.a3s.aiL` / `.a3s` last visible expanded message, or Gmail's standalone `view=lg` / `view=pt` full-message view), clean subject (`h2.hP`), and sender (`span.gD[email]`). Automatically detects public *"View in browser"* / *"Leggi nel browser"* links (EN/IT/FR/ES/DE plus Substack/Beehiiv/Ghost heading links matching subject) with Google redirect unwrapping and falls back to a canonical `https://mail.google.com/mail/u/<N>/#all/<threadId>` permalink so links remain valid after archiving in Gmail. Shows a clipped-message warning when `.iX` / `view=lg` is detected and disables saving when no email is open. Also applies lightweight DOM pruning (`extractCleanPageHtmlInPage`) with a 3.2 MB guard on regular web pages.
   - **Dedicated Newsletter Cleaner ([`lib/extractor.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/extractor.ts) `extractNewsletter`, [`app/api/articles/route.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/api/articles/route.ts))**: Because email newsletters rely on deeply nested `<table>` layouts that `@mozilla/readability` mangles or discards, `source_type: 'newsletter'` runs a dedicated JSDOM cleaner that unwraps layout tables (preserving real data tables), strips 1×1 tracking pixels, hidden preheaders, inline styles/colors/widths (maintaining full compatibility with all 4 Reader themes), unwraps `www.google.com/url?q=` redirects and `ci*.googleusercontent.com/(meips|proxy)/...#https://...` proxy images, selects a clean hero image, and generates boilerplate-free excerpts.
   - **Database, Offline Cache & UI**: Added `source_type` (`'article' | 'newsletter'`) with idempotent `PRAGMA table_info(articles)` migration in [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts), offline `newsletters` filtering in [`lib/offlineStorage.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/offlineStorage.ts), Service Worker bump to `pocketbox-v7` in [`public/sw.js`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/public/sw.js), dedicated **Newsletters** nav item in [`components/Sidebar.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/Sidebar.tsx), indigo **Newsletter** badges and mail icons in [`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx) and [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx) (with `From ...` attribution and smart external link tooltip), and responsive table/divider styling in [`app/globals.css`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/globals.css).
12. **Autonomous Multi-Signal Newsletter Folder Organization**:
   - **Multi-Indicator Fingerprinting Engine ([`lib/newsletterClassifier.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/newsletterClassifier.ts))**: Combines 5 independent signals to identify a newsletter series: (1) HTML masthead heading, top banner `<img alt>`, and footer subscription boilerplate (*"You are receiving X because..."* / *"Stai ricevendo X perché..."*), (2) recurring subject prefixes (`[Series]`, `Series: ...`, and date/issue-stripped subject lines), (3) sender display name decomposed to separate publication/edition title from journalist personal names, (4) sender email local-part and publisher root domain (distinguishing shared platforms like Substack/Beehiiv from dedicated newsroom domains), and (5) normalized `utm_campaign` and web host.
   - **Conflict Penalty & Historical Rule Learning (`newsletter_rules` table in [`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts))**: Solves both same-sender multi-newsletter disambiguation (e.g., `alice@euobserver.com` sending both *"EUobserver morning"* and *"EUobserver Weekly"* applies a -70 pt conflict penalty on the edition mismatch and creates separate folders) and changing-journalist continuity (e.g., *"EUobserver morning"* sent by `alice@euobserver.com` today and `bob@euobserver.com` tomorrow matches via domain + masthead/footer/prefix). Moving or renaming a newsletter folder (`PATCH /api/articles/[id]`, `PATCH /api/folders/[id]`) updates the learned rules so future issues automatically follow user corrections.
   - **Dedicated Newsletter Folders (`folders.folder_type = 'newsletter'`)**: Separated from general web article folders (`folder_type = 'article'`). Displayed as collapsible sub-folders directly beneath **Newsletters** in [`components/Sidebar.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/Sidebar.tsx) (with inline rename `Pencil`, issue count badges, and quick creation) and as a 1-tap horizontal series filter bar at the top of the **Newsletters** view in [`app/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/page.tsx).
   - **Firefox Extension Auto-Folder Preview (`v0.3.0`, [`firefox-extension/popup.js`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/firefox-extension/popup.js), [`app/api/folders/detect-newsletter/route.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/api/folders/detect-newsletter/route.ts))**: On popup open in Gmail, queries `/api/folders/detect-newsletter` and pre-selects either `📁 Auto: <Existing Folder>` or `✨ Nuova cartella: <Suggested Name>` (with an inline editable input box to customize the name on the fly before saving), backed by automatic server-side resolution in `POST /api/articles`.

---

## 🔮 6. Future Enhancements

1. **Full-Text Search (FTS5 / libSQL virtual table)**:
   - Index article body text in Turso for instant snippet searching across thousands of long articles.
2. **EPUB / PDF Export**:
   - Add a download action in `ReaderView.tsx` to export clean articles formatted for Kindle / Kobo e-readers.
3. **Highlights & Notes**:
   - Text selection listener in `ReaderView.tsx` to persist user highlights and marginalia in an `article_highlights` table.
