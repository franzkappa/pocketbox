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

**PocketBox** is a personal, private, cloud-hosted & offline-first "Read It Later" platform inspired by Mozilla Pocket and a lightweight open-source alternative to Pocket, Omnivore, and Instapaper.  
It runs **24/7 for free in the cloud** (Vercel + Turso SQLite) without requiring your Mac or PC to stay powered on, provides a **100% offline-capable PWA** reading experience on iPhone, allows **1-tap saving directly from the iOS Share Sheet**, and seamlessly synchronizes with a dedicated **Firefox desktop extension** supporting both web articles and **Gmail newsletters**.

---

## 🌟 Key Features

1. **Always-On Cloud Architecture (24/7, Free Forever)**:
   - Hosted on **Vercel** serverless functions with automatic HTTPS.
   - Backed by **Turso Cloud SQLite** (`@libsql/client`) with zero maintenance, generous free tier (9GB storage), and instant response times.
   - Your computer can be powered off indefinitely; your library, reader, and ingestion APIs stay active around the clock.

2. **1-Tap Direct Saving from iPhone (iOS Shortcuts & Share Sheet)**:
   - Save any article from Safari, Firefox, Chrome, Twitter, Reddit, or any iOS app directly via the native iOS **Share Sheet**.
   - No bookmark queues or manual copy-pasting required: tap **Share > PocketBox**, and the article is downloaded, cleaned, and catalogued in seconds.

3. **Offline-First PWA on iPhone (True Offline Reading)**:
   - Add to Home Screen as a standalone fullscreen app with custom icon and splash styling.
   - **Service Worker (`pocketbox-v7`) + IndexedDB (`pocketbox_offline`)**: Automatically replicates all downloaded articles and newsletters (including full text and cleaned HTML) with full offline filtering across Inbox, Newsletters, Favorites, Archive, Folders, and Tags.
   - **Zero connection required**: Open the app and read your entire library on flights, subways, or in airplane mode.
   - **iOS Safe Area & iPhone SE Optimization**: Dynamic viewport adaptation (`100dvh`), status bar clearance (`pt-safe`), and touch-optimized controls.
   - **Flicker-Free Mobile Scrolling**: Zero-re-render scroll progress tracking via `requestAnimationFrame`, touch-aware hover isolation (`future.hoverOnlyWhenSupported`), WebKit GPU layer isolation (`translateZ(0)`), and asynchronous image decoding (`decoding="async"`) for 120 FPS scrolling without image blinking, clipping glitches, or hover stutter.

4. **Mobile Gestures & Instant Refresh (Pull-to-Refresh & Rotating Reload Button)**:
   - **Scroll Down / Pull-to-Refresh**: Native touch-driven pull gesture directly on mobile. Pulling down from the top reveals an animated rotating indicator pill with tactile resistance and haptic vibration (`navigator.vibrate`), smoothly refreshing articles on release.
   - **Rotating Arrow Button**: Prominently placed in the top navigation bar and sidebar footer. Tapping the button triggers a rotating animation (`animate-spin`) while performing silent background revalidation, avoiding any jarring flashes or blanking of the library view.

5. **Desktop Firefox Extension (Manifest V3, v0.3.0)**:
   - 1-click toolbar popup to save the active browser tab or an open **Gmail newsletter**.
   - Configurable server URL and API key/password settings via built-in settings panel (⚙️).
   - **Client-Side DOM Extraction & Payload Protection**: Injects and captures pre-authenticated, challenge-passed DOM (pruning `<script>`, `<style>`, `<noscript>`, and oversized inline SVGs/data URIs to stay well below Vercel's 4.5MB serverless limit) to bypass aggressive anti-bot gates (DataDome, Cloudflare) and paywalls on sites like *Libération* and *Le Monde*.
   - **Gmail Newsletter Extractor (`mail.google.com`)**: Automatically detects open emails (including Gmail's *"View entire message"* `view=lg` view), extracts only the newsletter subject, sender, and email body, detects public *"View in browser"* / *"Leggi nel browser"* links (falling back to a stable Gmail `#all/<threadId>` permalink that remains valid even after archiving the email in Gmail), previews the **auto-detected newsletter series folder** (e.g., `📁 Auto: EUobserver morning` or `✨ Nuova cartella: EUobserver morning`, editable inline before saving), warns if Gmail clipped the message, and prevents saving when on the inbox list without an open email.

6. **Dedicated Newsletter Archiving, Auto-Folder Clustering & Distraction-Free Reader**:
   - **Autonomous Multi-Signal Newsletter Folder Organization (`lib/newsletterClassifier.ts`)**: When saving a newsletter for the first time (e.g., *"EUobserver morning"*), PocketBox automatically creates a dedicated newsletter folder with that series name and places all subsequent issues into it. Its multi-indicator fingerprinting engine combines **5 signals** — internal HTML masthead/banner `<img alt>`, recurring subject prefixes (`[Series]`, `Series: ...`, date-stripped series titles), sender display name decomposed from author name, sender email/domain, and `utm_campaign`/web host — plus historical rule learning (`newsletter_rules` table). It accurately distinguishes multiple different newsletters sent from the same sender address while keeping issues of the same newsletter together even when the journalist's email address or display name changes over time.
   - **Dedicated Newsletter Sub-Folders & Quick Series Bar**: Newsletter folders live in their own collapsible sub-section under **Newsletters** in the sidebar (separate from general web article folders) with inline renaming and issue counts, plus a 1-tap horizontal series filter bar at the top of the **Newsletters** view.
   - **Custom Newsletter HTML Cleaner (`extractNewsletter`)**: Unwraps nested email layout `<table>` wrappers (preserving real data tables), strips 1×1 tracking pixels, hidden preheaders, and hardcoded inline colors/widths, unwraps Google redirect links and Gmail proxy image URLs, and selects a clean hero image while skipping social icons and logos.
   - **Built-in Readability Engine (`@mozilla/readability` + JSDOM)** for web articles: Strips ads, tracking scripts, cookie prompts, and clutter.
   - Clean typography for both articles and newsletters with 4 themes: *Paper Light*, *Warm Sepia*, *Dark Slate*, and *Pure OLED Black*.
   - Adjustable font sizes, font families (Serif, Sans, Mono), responsive table/divider styling, and real-time GPU-accelerated reading progress bar with zero scroll-induced component re-renders.
   - Responsive appearance popover centered with safe margin clearance across all mobile and desktop viewports, supporting click-outside and `Esc` shortcut dismissal.

7. **Flexible Organization — Folders & Tags (Before & After Saving)**:
   - Assign folders and tags when saving an article, and move articles between folders (or remove them to General) and add/remove tags at any time afterward from either the **Library cards** or directly inside the **Reader View**.
   - Dedicated **Move to Folder modal** (`ArticleFolderModal`) with 1-tap folder switching, inline colored folder creation, optimistic UI updates, sidebar count refresh, and IndexedDB sync.
   - Dedicated **Manage Tags modal** (`ArticleTagsModal`) with real-time filtering, 1-tap tag creation, optimistic UI updates, sidebar tag count refresh, and automatic IndexedDB offline cache sync.

8. **Privacy & Security**:
   - Protected by personal password/PIN (`POCKETBOX_PASSWORD`) with 1-year persistent session cookie.
   - Flexible API authentication supporting `Authorization: Bearer <key>`, `X-API-Key`, or URL query tokens (`?key=...`).

---

## 🏗️ System Architecture

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

---

## 🚀 Quick Setup & Deployment

### 1. Database Setup (Turso Cloud SQLite)
1. Sign up for free at [https://turso.tech](https://turso.tech) using GitHub.
2. Create a database named `pocketbox`:
   ```bash
   turso db create pocketbox
   ```
   *(Or click "Create Database" in the Turso web dashboard).*
3. Copy your **Database URL** (`libsql://pocketbox-...turso.io`) and generate an **Auth Token**.

### 2. Cloud Deployment (Vercel)

#### Option A: 1-Click Deploy (Fastest)
Click the button below to fork and deploy your personal PocketBox instance directly to Vercel in seconds:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffranzkappa%2Fpocketbox&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,POCKETBOX_PASSWORD&envDescription=Turso%20Database%20credentials%20and%20your%20PocketBox%20access%20PIN&envLink=https%3A%2F%2Fgithub.com%2Ffranzkappa%2Fpocketbox%231-database-setup-turso-cloud-sqlite)

Vercel will ask you to enter the environment variables obtained in Step 1 (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and your chosen `POCKETBOX_PASSWORD`). Once filled, click **Deploy** and your app will be online immediately!

#### Option B: Manual Import
1. Go to [https://vercel.com](https://vercel.com) and click **"Add New Project"**.
2. Import your GitHub repository (`franzkappa/pocketbox`).
3. Under **Environment Variables**, add:
   * `TURSO_DATABASE_URL`: your Turso URL (`libsql://...`)
   * `TURSO_AUTH_TOKEN`: your Turso token
   * `POCKETBOX_PASSWORD`: your secret password/PIN (e.g. `mysecretpin123`)
   * `POCKETBOX_API_KEY`: optional (defaults to `POCKETBOX_PASSWORD`)
4. Click **Deploy**.  
   Your app is live with automatic HTTPS at `https://your-app.vercel.app`!

---

### 3. iPhone Setup (PWA & 1-Tap Save)

#### A. Install the PWA
1. Open `https://your-app.vercel.app` in Safari on iPhone.
2. Enter your password to log in.
3. Tap **Share > Add to Home Screen**.
4. The app is installed. All articles are automatically cached into IndexedDB for offline reading.

#### B. 1-Tap Save Shortcut (iOS Shortcuts)
In the iOS **Shortcuts** app:
1. Tap **`+`** to create a new shortcut, tap the name at the top, select **Rename**, and name it **PocketBox**.
2. Tap the details **`ⓘ`** button at the bottom (or the dropdown arrow at the top) and enable **Show in Share Sheet**.
3. Add the action **`Get Contents of URL`**:
   * **URL**: `https://your-app.vercel.app/api/save?key=YOUR_PASSWORD`
   * **Method**: `POST`
   * **Request Body**: `JSON`
     * Key: `URL` (or `url`)
     * Value: select the variable `Shortcut Input`
4. Add the action **`Show Notification`**:
   * Text: select `Contents of URL` (or write `"Article saved to PocketBox! 📥"`).
5. Tap **Done**.

Now, while browsing in Safari or Firefox on iOS, tap **Share > PocketBox** to save any article in 1 tap!

---

### 4. Firefox Extension Setup on Mac
1. **Download or Clone**:
   * *Option A (Fastest)*: Download `pocketbox-firefox-extension-v0.1.0.zip` from the latest [GitHub Release](https://github.com/franzkappa/pocketbox/releases/latest) and extract it.
   * *Option B*: Use the `firefox-extension/` directory from the cloned repository.
2. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `manifest.json` from the extracted/extension folder.
4. Click the PocketBox extension icon in the toolbar, tap the gear icon (**⚙️**), and enter:
   * **Server URL**: `https://your-app.vercel.app`
   * **API Key / Password**: your configured password
5. Click **Salva Impostazioni**. The status dot will turn green (**Online**)!

---

## 🔌 API Endpoints

All endpoints support CORS (`*`) and flexible authentication (`Authorization: Bearer <token>`, `X-API-Key: <token>`, `?key=<token>`, or session cookie):

| Method | Endpoint | Description |
|---|---|---|
| `GET` / `POST` | `/api/save` | Fast 1-action save endpoint for iOS Shortcuts & bookmarklets (`?url=...&key=...` or JSON body `{ "url": "..." }`) |
| `GET` | `/api/articles` | List articles & newsletters with filters (`?filter=inbox\|newsletters\|archive\|favorites&folder_id=...&tag_id=...&q=...`) |
| `POST` | `/api/articles` | Ingest article or newsletter (`source_type: 'article' \| 'newsletter'`) from URL or client-rendered HTML |
| `GET` | `/api/articles/[id]` | Retrieve single article with full HTML content |
| `PATCH` | `/api/articles/[id]` | Update read, favorite, archive, folder, or tag status |
| `DELETE` | `/api/articles/[id]` | Delete article permanently |
| `GET` | `/api/auth/status` | Diagnostic healthcheck (checks DB connection, folders count, and auth status) |
| `POST` | `/api/auth/login` | Authenticate and issue 1-year HttpOnly session cookie |
| `POST` | `/api/auth/logout` | Clear session cookie |
| `GET` / `POST` | `/api/folders` | List or create folders (`?type=article\|newsletter`, `folder_type: 'article' \| 'newsletter'`) |
| `PATCH` / `DELETE` | `/api/folders/[id]` | Rename, recolor, or delete folder |
| `POST` | `/api/folders/detect-newsletter` | Multi-signal newsletter classifier (previews matched folder or suggested new series name) |
| `GET` / `POST` | `/api/tags` | List or create tags |
| `DELETE` | `/api/tags/[id]` | Delete tag |

---

## 📂 Project Structure

```
pocketbox/
├── package.json              # Next.js 15 full-stack dependencies
├── tsconfig.json             # TypeScript configuration
├── next.config.mjs           # Server external packages configuration
├── tailwind.config.ts        # Typography & reader themes
├── .env.example              # Template environment variables
├── data/
│   └── pocketbox.db          # Local SQLite file fallback
├── lib/
│   ├── db.ts                 # Dual-mode DB: Turso Cloud or local SQLite (@libsql/client)
│   ├── auth.ts               # Resilient password, PIN & token verification
│   ├── extractor.ts          # Readability + dedicated Gmail/email newsletter HTML cleaner (JSDOM)
│   ├── newsletterClassifier.ts # Multi-signal newsletter fingerprinting & auto-folder classifier
│   ├── offlineStorage.ts     # Client-side IndexedDB caching for iOS PWA
│   ├── cors.ts               # Permissive CORS headers
│   └── types.ts              # TypeScript interfaces
├── app/
│   ├── layout.tsx            # PWA shell, meta tags, and Service Worker registration
│   ├── page.tsx              # Main library view (Inbox, Newsletters, Favorites, Archive)
│   ├── add/                  # Web Share Target & bookmarklet ingest page
│   ├── globals.css           # Reader & Tailwind base styling
│   └── api/
│       ├── save/             # Streamlined iOS Shortcut save route
│       ├── articles/         # Article CRUD & extraction endpoints
│       ├── auth/             # Login, logout, and auth status endpoints
│       ├── folders/          # Folder CRUD + /api/folders/detect-newsletter classifier endpoint
│       └── tags/             # Tag management endpoints
├── components/
│   ├── PullToRefresh.tsx     # Native-grade touch pull-down refresh component
│   ├── Sidebar.tsx           # Responsive sidebar with dedicated Newsletter sub-folders & inline rename
│   ├── ArticleCard.tsx       # Article preview card with quick actions
│   ├── ReaderView.tsx        # Minimalist distraction-free reader (4 themes)
│   ├── AddArticleModal.tsx   # Manual URL input modal
│   ├── ArticleFolderModal.tsx# Post-save folder picker modal (move/create/unassign folder)
│   ├── ArticleTagsModal.tsx  # Post-save tag editor modal (add/create/remove tags)
│   └── LoginView.tsx         # Password/PIN login view
├── public/
│   ├── manifest.json         # Standalone PWA Manifest (with Web Share Target)
│   ├── sw.js                 # Service Worker (pocketbox-v7) for offline fallback
│   ├── favicon.svg           # Vector favicon
│   └── icons/                # High-res PWA & Apple touch icons
└── firefox-extension/        # Firefox WebExtension (Manifest v3, v0.3.0)
    ├── manifest.json         # Extension manifest
    ├── popup.html            # 1-click toolbar action UI with auto-folder preview & settings modal
    ├── popup.js              # Tab & Gmail newsletter extraction, auto-folder preview & settings
    └── icons/                # Extension toolbar icons (16-128px)
```

---

## ❓ Troubleshooting

- **Extension shows "Offline"**: Click ⚙️ in the extension popup and verify the Server URL starts with `https://` (e.g. `https://your-app.vercel.app`) and the password matches `POCKETBOX_PASSWORD`.
- **Gmail newsletter was clipped**: Gmail truncates emails larger than 102 KB. If the extension displays a clipped-message warning, click **"View entire message"** / **"Visualizza l'intero messaggio"** in Gmail (which opens the full `view=lg` email tab) and click the PocketBox extension icon from there to capture the full newsletter.
- **Shortcut returns "Valid URL is required"**: Ensure in the iOS Shortcut that the Request Body has key `URL` and value set to the dynamic variable pill `Shortcut Input` (not typed out as plain text).
- **Checking Cloud Health**: Navigate to `https://your-app.vercel.app/api/auth/status` in any browser. It should return `"database": { "status": "ok", "type": "turso_cloud" }`.
- **Force PWA Refresh**: On iPhone, swipe the PWA away from the App Switcher and reopen it.

---

## 📄 License

MIT License. Designed and maintained for private, self-hosted article reading.
