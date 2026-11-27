# PocketBox 📦

[![GitHub Release](https://img.shields.io/github/v/release/franzkappa/pocketbox?color=blue&style=flat-square)](https://github.com/franzkappa/pocketbox/releases/latest)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-Turso%20%2F%20libSQL-blue?style=flat-square&logo=sqlite)](https://turso.tech/)
[![Vercel](https://img.shields.io/badge/Vercel-Hosted%2024%2F7-black?style=flat-square&logo=vercel)](https://vercel.com/)
[![Firefox](https://img.shields.io/badge/Firefox-WebExtension%20v3-orange?style=flat-square&logo=firefox-browser)](https://www.mozilla.org/firefox/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffranzkappa%2Fpocketbox&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,POCKETBOX_PASSWORD&envDescription=Turso%20Database%20credentials%20and%20your%20PocketBox%20access%20PIN&envLink=https%3A%2F%2Fgithub.com%2Ffranzkappa%2Fpocketbox%231-database-setup-turso-cloud-sqlite)

**PocketBox** is a private, self-hosted, offline-first "Read It Later" platform inspired by Mozilla Pocket and Omnivore. It runs **24/7 for free on Vercel + Turso SQLite**, provides an **offline-capable iPhone PWA**, supports **1-tap saving via iOS Shortcuts**, and includes a **Firefox desktop extension** (`v0.3.0`) for web articles and **Gmail newsletters**.

---

## 🌟 Key Features

- **Always-On Cloud (24/7):** Serverless Next.js 15 on **Vercel** backed by **Turso Cloud SQLite** (`@libsql/client`), so your computer never needs to stay on.
- **1-Tap iOS Saving:** Save from Safari, Firefox, or any app via **Share > PocketBox** using Apple Shortcuts.
- **Offline-First iPhone PWA:** Standalone Home Screen app backed by Service Worker (`pocketbox-v7`) and **IndexedDB** (`pocketbox_offline`), with full offline filtering across Inbox (all items), Articles, Newsletters, Favorites, Archive, Folders, and Tags.
- **120 FPS Mobile Reader & Gestures:** Zero-re-render `requestAnimationFrame` reading progress, touch-aware hover isolation, WebKit GPU layer isolation (`translateZ(0)`), async image decoding, native **Pull-to-Refresh** with haptic feedback, and silent navbar/sidebar reload buttons.
- **Firefox Extension (`v0.3.0`):**
  - Captures pre-authenticated DOM on paywalled/anti-bot sites (DataDome, Cloudflare) while pruning scripts/styles/large assets under Vercel's 4.5MB limit.
  - **Gmail Newsletter Extractor:** Detects open emails (including `view=lg` *"View entire message"*), extracts subject, sender, body, public *"View in browser"* URLs (falling back to `#all/<threadId>`), warns on clipped messages, and previews the auto-detected series folder before saving.
- **Autonomous Newsletter Clustering & Reader:** 5-signal classifier (`lib/newsletterClassifier.ts`) + `newsletter_rules` automatically groups issues into dedicated **Newsletter sub-folders** and a quick series filter bar. A custom email cleaner (`extractNewsletter`) unwraps layout tables and strips tracking pixels/preheaders.
- **Distraction-Free Reading:** Readability article extraction, 4 themes (*Light*, *Sepia*, *Slate*, *OLED Black*), Serif/Sans/Mono fonts, responsive appearance popover, **full native text selection**, and **always-visible source links** on cards, reader header/badge, and footer.
- **Library Views & Post-Save Organization:** Filter the sidebar by **Inbox** (all saved items), **Articles** (web articles only), or **Newsletters** (emails only); move items across colored folders (`ArticleFolderModal`) and manage tags (`ArticleTagsModal`) with optimistic UI + IndexedDB sync.
- **1-Click Saved Copy Sharing (`/share/[token]`):** Generate a private, unguessable share link to your server-saved copy (sanitized HTML, `noindex`, OpenGraph tags, no login required, never exposing folders, tags, or private Gmail links).
- **Privacy & Auth:** Protected by `POCKETBOX_PASSWORD` with 1-year HttpOnly cookie, Bearer/`X-API-Key`/`?key=` API auth, and permissive CORS.

---

## 🏗️ System Architecture

- **iPhone:** iOS Share Sheet Shortcut (`POST /api/save`) + Standalone Safari PWA (IndexedDB offline cache).
- **Vercel Cloud (24/7):** Next.js 15 App Router API (`/api/save`, `/api/articles`, `/api/folders`, `/api/tags`, `/api/auth`), Readability + Newsletter cleaner, public `/share/[token]` SSR reader.
- **Turso Cloud SQLite:** Serverless `libsql://` DB (`articles`, `folders`, `newsletter_rules`, `tags`, `article_tags`).
- **Mac / Desktop:** Firefox MV3 Extension (`firefox-extension/`) posting cleaned DOM / Gmail newsletters over HTTPS.

---

## 🚀 Quick Setup & Deployment

### 1. Database Setup (Turso Cloud SQLite)
1. Sign up free at [turso.tech](https://turso.tech) and create a database:
   ```bash
   turso db create pocketbox
   ```
2. Copy your **Database URL** (`libsql://pocketbox-...turso.io`) and generate an **Auth Token**.

### 2. Cloud Deployment (Vercel)
- **1-Click Deploy:** Click the **Deploy with Vercel** button above and enter `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `POCKETBOX_PASSWORD`.
- **Manual Import:** Import `franzkappa/pocketbox` on [vercel.com](https://vercel.com), add `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `POCKETBOX_PASSWORD` (and optional `POCKETBOX_API_KEY`), then deploy.

### 3. iPhone Setup (PWA & 1-Tap Save)
- **PWA:** Open `https://your-app.vercel.app` in Safari, sign in, and tap **Share > Add to Home Screen**.
- **iOS Shortcut:** In **Shortcuts**, create **PocketBox**, enable **Show in Share Sheet**, add **Get Contents of URL** (`POST` to `https://your-app.vercel.app/api/save?key=YOUR_PASSWORD`, JSON body key `URL` = variable `Shortcut Input`), and add **Show Notification**.

### 4. Firefox Extension Setup
1. Download/extract `pocketbox-firefox-extension-v0.2.0.zip` from [GitHub Releases](https://github.com/franzkappa/pocketbox/releases/latest) or use `firefox-extension/`.
2. Open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → select `manifest.json`.
3. Click the toolbar icon → **⚙️** → set **Server URL** (`https://your-app.vercel.app`) and **API Key / Password**, then save.

---

## 🔌 API Endpoints

Supports CORS (`*`) and `Authorization: Bearer <token>`, `X-API-Key`, `?key=`, or session cookie.

| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/save` | Fast iOS Shortcut & bookmarklet ingest |
| `GET` / `POST` | `/api/articles` | List filtered items or ingest URL/HTML (`article` / `newsletter`) |
| `GET` / `PATCH` / `DELETE` | `/api/articles/[id]` | Get HTML, update state/folder/tags, or delete |
| `POST` | `/api/articles/[id]/share` | Create or fetch `/share/[token]` saved-copy token |
| `GET` / `POST` | `/api/auth/status`, `login`, `logout` | Healthcheck and 1-year cookie auth |
| `GET` / `POST` / `PATCH` / `DELETE` | `/api/folders`, `/api/folders/[id]` | Manage article & newsletter folders |
| `POST` | `/api/folders/detect-newsletter` | Preview matched or suggested newsletter series folder |
| `GET` / `POST` / `DELETE` | `/api/tags`, `/api/tags/[id]` | Manage tags |

---

## 📂 Project Structure

```text
pocketbox/
├── app/
│   ├── layout.tsx, page.tsx, globals.css   # PWA shell, main library, reader styles
│   ├── add/                                # Web Share Target & bookmarklet page
│   ├── share/[token]/                      # Public login-free saved-copy reader
│   └── api/                                # save, articles (+ /share), auth, folders, tags
├── components/                             # Sidebar, ArticleCard, ReaderView, SharedArticleReader, Modals, PullToRefresh
├── lib/                                    # db, auth, extractor, newsletterClassifier, sanitize, shareClient, url, offlineStorage, cors, types
├── public/                                 # manifest.json, sw.js (pocketbox-v7), icons
└── firefox-extension/                      # MV3 v0.3.0 (manifest.json, popup.html, popup.js)
```

---

## ❓ Troubleshooting & License

- **Extension "Offline":** Check `https://` Server URL and `POCKETBOX_PASSWORD` in ⚙️ settings.
- **Gmail clipped warning:** Click *"View entire message"* (`view=lg`) in Gmail, then save from that tab.
- **Shortcut "Valid URL is required":** Ensure the JSON value for `URL` is the dynamic `Shortcut Input` pill, not plain text.
- **Healthcheck / PWA refresh:** Visit `/api/auth/status` (`type: "turso_cloud"`), or force-close and reopen the iOS PWA.

MIT License. Built for private, self-hosted reading.
