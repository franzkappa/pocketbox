# PocketBox - AI Agent Session Handoff & Architecture Guide

> **Documentation Budget Rule:** Both `HANDOFF.md` and `README.md` **must never exceed ~1,000 words** (`wc -w`). On every future update, summarize concisely and prune or merge older details instead of appending long sections.

> **Status:** ✅ **Synced & Verified (`v0.2.0` baseline + `/share/[token]`, always-visible source links, selectable reader text, separated `Articles` sidebar view)**  
> All core features are active in production: 24/7 Vercel + Turso SQLite cloud backend, iOS Shortcuts 1-tap save, offline PWA (`pocketbox-v7`), Firefox MV3 extension (`v0.3.0` with Gmail extraction & auto-folder preview), mobile GPU scroll optimizations, post-save folder/tag modals, multi-signal newsletter clustering, and 1-click saved-copy sharing.

---

## 1. Project Overview & Stack

- **Workspace:** `/Users/federicocaruso/Documents/LLM projects/new pocket`
- **Repo / Release:** [`franzkappa/pocketbox`](https://github.com/franzkappa/pocketbox) (`main` branch, tag `v0.2.0`, 1-click Vercel Deploy button)
- **Production URL:** `https://pocketboxnew.vercel.app`
- **Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 3.4, Lucide Icons
- **Database:** `@libsql/client` (Turso `libsql://` in prod; `./data/pocketbox.db` local fallback)
- **Extraction & Classification:** `@mozilla/readability`, `jsdom` (`extractNewsletter` in [`lib/extractor.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/extractor.ts)), [`lib/newsletterClassifier.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/newsletterClassifier.ts)
- **Offline Layer:** Service Worker [`public/sw.js`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/public/sw.js) (`pocketbox-v7`) + IndexedDB [`lib/offlineStorage.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/offlineStorage.ts) (`pocketbox_offline`)
- **Clients:** iOS Safari PWA + Apple Shortcuts (`/api/save`), Firefox MV3 Extension `v0.3.0` (`firefox-extension/`)

---

## 2. System Architecture & Flows

1. **iPhone 1-Tap Save:** Safari/app → **Share > PocketBox** Shortcut → `POST /api/save?key=<password>` with `{"URL": Shortcut Input}` → Readability extraction → Turso SQLite.
2. **Offline PWA:** Installed via Safari **Add to Home Screen** (`display: standalone`). Online sessions sync all articles/newsletters (`content_html` included) to IndexedDB (`pocketbox_offline`). Offline mode serves app shell via `sw.js` (`pocketbox-v7`) and filters locally across Inbox, Articles, Newsletters, Favorites, Archive, Folders, and Tags.
3. **Refresh Gestures:** [`components/PullToRefresh.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/PullToRefresh.tsx) uses non-passive touch listeners (`scrollTop <= 0`, `dy * 0.45` damping, `navigator.vibrate(10)` at 65px) and silent `fetchArticles(true)`. Header/sidebar `RefreshCw` buttons spin in place without blanking the list.
4. **Firefox Extension (`v0.3.0`):**
   - **Web pages:** `extractCleanPageHtmlInPage` captures authenticated DOM while stripping `<script>`, `<style>`, `<noscript>`, `<template>`, large `<svg>`, and oversized data URIs (bypassing DataDome/Cloudflare 403s under Vercel's 4.5MB limit, with a 3.2MB guard).
   - **Gmail (`mail.google.com`):** `extractGmailNewsletterInPage` extracts only the open email (`.a3s.aiL`/`.a3s` or `view=lg`/`view=pt`), subject (`h2.hP`), sender (`span.gD[email]`), public *"View in browser"* URL (fallback `#all/<threadId>`), clipped-email warnings (`.iX`), and queries `/api/folders/detect-newsletter` for inline-editable auto-folder preview.

---

## 3. Database Schema ([`lib/db.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/db.ts))

- **`folders`:** `id`, `name` (UNIQUE), `color`, `folder_type` (`'article' | 'newsletter'`), `created_at`. Default seeded article folders: `Technology`, `Work`, `Long Reads`, `Personal`.
- **`newsletter_rules`:** `id`, `folder_id` (FK CASCADE), `sender_email`, `sender_domain`, `sender_name`, `subject_prefix`, `masthead`, `utm_campaign`, `web_host`, `updated_at`.
- **`tags`:** `id`, `name` (UNIQUE), `color`. Default seeded tags: `must-read`, `quick`, `reference`.
- **`articles`:** `id`, `url` (UNIQUE), `title`, `byline`, `excerpt`, `content_html`, `text_content`, `site_name`, `lead_image_url`, `reading_time_minutes`, `source_type` (`'article' | 'newsletter'`), `folder_id` (FK SET NULL), `share_token` (UNIQUE), `is_read`, `is_favorite`, `is_archived`, `created_at`, `updated_at`.
- **`article_tags`:** `(article_id, tag_id)` composite PK, FK CASCADE.
- **Indexes & Migrations:** Indexes on `(is_archived, is_favorite, is_read)`, `folder_id`, `created_at DESC`, `(source_type, is_archived)`, `share_token`, `newsletter_rules(folder_id)`. `ensureSchema` runs idempotent `PRAGMA table_info` checks and `ALTER TABLE` migrations for `source_type`, `share_token`, and `folder_type`.

---

## 4. REST API Endpoints

All endpoints allow CORS (`Access-Control-Allow-Headers: *` in `lib/cors.ts`) and accept `Authorization: Bearer`, `X-API-Key`, `?key=`, or 1-year HttpOnly session cookie (`lib/auth.ts`).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET`/`POST` | `/api/save` | iOS Shortcuts & bookmarklet ingest (`extractUrl` handles nested JSON/query strings) |
| `GET` | `/api/articles` | List with `?filter=inbox\|articles\|newsletters\|archive\|favorites&folder_id=&tag_id=&q=` |
| `POST` | `/api/articles` | Ingest article or newsletter (`source_type`, sender metadata, auto-folder resolution) |
| `GET`/`PATCH`/`DELETE` | `/api/articles/[id]` | Read full HTML, update state/folder/tags (updates `newsletter_rules`), or delete |
| `POST` | `/api/articles/[id]/share` | Create or return idempotent 16-byte `base64url` `share_token` (`/share/[token]`) |
| `GET` | `/api/auth/status` | Healthcheck returning DB type/status, folder count, auth state |
| `POST` | `/api/auth/login` / `logout` | Password/PIN login (sets 1-year HttpOnly cookie) or clear cookie |
| `GET`/`POST` | `/api/folders` | List (`?type=article\|newsletter`) or create folders (`409` on duplicate) |
| `PATCH`/`DELETE` | `/api/folders/[id]` | Rename, recolor, or delete folder |
| `POST` | `/api/folders/detect-newsletter` | Multi-signal newsletter classifier preview (`matchedFolder` or `suggestedFolderName`) |
| `GET`/`POST`/`DELETE` | `/api/tags` & `/api/tags/[id]` | List, create, or delete tags |

---

## 5. Technical Notes & Key Implementations

- **iOS PWA & Safe Areas:** [`app/layout.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/layout.tsx) sets `viewportFit: 'cover'`, `black-translucent` status bar, `--sat`/`.pt-safe` (52px min clearance on iPhone SE), and `16px` (`text-base`) inputs to prevent Safari focus zoom.
- **Mobile 120FPS Scroll & Anti-Flicker:** [`components/ReaderView.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ReaderView.tsx) updates the reading progress bar directly via `requestAnimationFrame` (zero React re-renders). [`tailwind.config.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/tailwind.config.ts) enables `future: { hoverOnlyWhenSupported: true }` to block sticky touch-hover jitter. WebKit `translateZ(0)` / `isolation: isolate` + `decoding="async"` prevent image blinking during momentum scroll.
- **Reader Popover & Selectable Text:** Appearance popover uses `left-1/2 -translate-x-1/2` with click/touch-outside (`settingsRef`) and `Esc`-first dismissal. `ReaderView` sets `select-text`, and [`app/globals.css`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/globals.css) enforces `.reader-content, .reader-content * { user-select: text !important; -webkit-user-select: text !important; }` to override `body`'s `select-none` and inline source blocks.
- **Post-Save Folders & Tags:** [`components/ArticleFolderModal.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleFolderModal.tsx) and [`components/ArticleTagsModal.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleTagsModal.tsx) (`z-[60]` over `ReaderView` `z-50`) trigger optimistic state + IndexedDB updates (`updateCachedArticleOffline`) with server rollback and input normalization.
- **Newsletters, Articles & Auto-Folders:** `extractNewsletter` unwraps email layout `<table>`s (keeping data tables), strips tracking pixels/preheaders/inline colors, unwraps Google redirects/proxy images, and picks a clean hero image. [`lib/newsletterClassifier.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/newsletterClassifier.ts) combines 5 signals (masthead/footer, subject prefix, decomposed sender name, email/domain, `utm_campaign`/host) with a `-70` edition-conflict penalty and `newsletter_rules` persistence. [`components/Sidebar.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/Sidebar.tsx) and [`app/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/page.tsx) separate **Inbox** (all items), **Articles** (`source_type = 'article'`), and **Newsletters** (`source_type = 'newsletter'`, with sub-folders and top series bar).
- **1-Click Sharing (`/share/[token]`):** [`app/share/[token]/page.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/app/share/%5Btoken%5D/page.tsx) renders sanitized saved copies ([`lib/sanitize.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/sanitize.ts)) via [`components/SharedArticleReader.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/SharedArticleReader.tsx) with `noindex` metadata, excluding private folders/tags and `mail.google.com` links. [`lib/shareClient.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/shareClient.ts) uses Promise-backed `ClipboardItem` for Safari/iOS + `z-[60]` manual-copy toast fallback.
- **Always-Visible Source Links:** [`lib/url.ts`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/lib/url.ts) validates `http(s)` URLs (`getSafeHttpUrl`) and labels (`Original article:`, `Web version:`, `Original email:`) shown in `ReaderView` (badge, header icon, footer) and clickable domain badges on [`components/ArticleCard.tsx`](file:///Users/federicocaruso/Documents/LLM%20projects/new%20pocket/components/ArticleCard.tsx).

---

## 6. Future Enhancements

1. **FTS5 Full-Text Search:** Turso virtual table for instant snippet search.
2. **EPUB / PDF Export:** Export clean articles from `ReaderView` for Kindle/Kobo.
3. **Highlights & Notes:** Persist text selection highlights in an `article_highlights` table.
