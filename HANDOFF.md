# PocketBox - AI Agent Session Handoff & Fast-Start Guide

> **CRITICAL INSTRUCTION FOR THE AI AGENT:**  
> When the user types **"procedi"** (or "proceed"), DO NOT ask further design questions. Read this document and immediately begin implementing **Phase 1** and subsequent phases in sequence.

---

## 📌 Project Context & State

- **App Name**: `PocketBox`
- **Working Directory**: `/Users/federicocaruso/Documents/LLM projects/new pocket`
- **Environment Verified**:
  - Node.js: `v24.21.0` (located at `/Users/federicocaruso/.local/node/bin`, exported in `~/.zshenv`)
  - SQLite: Built-in `node:sqlite` (`DatabaseSync` in Node 24—zero external compilation or native binary headaches)
  - Firefox: Installed on Mac (`/Applications/Firefox.app`)

---

## 🎯 Agreed Requirements & Decisions

1. **100% Local Self-Hosted on Mac**:
   - No external paid cloud infrastructure. Everything runs on the Mac with a local SQLite database.
2. **Mac-Sleep Solution (Asynchronous Bookmark Queue via Firefox Sync)**:
   - User has Firefox on both Mac and iPhone connected to the same Firefox Sync account.
   - On iPhone, when finding an article (even when the Mac is asleep or off), the user bookmarks it into a dedicated folder: `📥 PocketBox`.
   - Firefox Sync syncs this folder across devices.
   - When the Mac wakes up and Firefox is open, a custom Firefox WebExtension detects new bookmarks in `📥 PocketBox`, forwards them to the local PocketBox API for parsing, and cleans the queue.
   - On Firefox Mac, there is also a 1-click toolbar button to save the current tab instantly.
3. **iPhone PWA (Offline-First Reader)**:
   - Modern, responsive web app installable via Safari/Firefox ("Add to Home Screen") as a standalone iOS app.
   - Service Worker + IndexedDB caches all articles locally when connected to the home network.
   - Articles remain **100% readable offline** on iPhone when traveling or when the Mac is off.
4. **Organization Features**:
   - **Folders / Topics** (e.g., *Technology*, *Work*, *Long Reads*, *Personal*).
   - **Multiple Tags** per article with badge colors.
   - **Standard Pocket sections**: *Inbox (To Read)*, *Archive (Read)*, *Favorites (Starred)*.
   - **Full-Text Search & Quick Deletion**: Immediate article search and one-tap delete button.
   - **Distraction-Free Reader**: Parsed with `@mozilla/readability`, estimated reading time, font options (Serif, Sans), size adjustment, and 4 themes (*Light*, *Warm Sepia*, *Dark Slate*, *OLED Pure Black*).

---

## 🚀 Execution Roadmap (Triggered on "procedi")

Upon receiving the command **"procedi"**, execute these phases in order:

### Phase 1: Setup Full-Stack Project & Local Database
1. Initialize a unified Next.js (App Router) project with TypeScript, Tailwind CSS, and Lucide icons.
2. Install required dependencies:
   - `@mozilla/readability`
   - `jsdom`
   - `lucide-react`
   - `clsx`, `tailwind-merge`
3. Create `lib/db.ts` utilizing native `node:sqlite`:
   - Table `articles`: `id` (text/uuid), `url` (text), `title` (text), `byline` (text), `excerpt` (text), `content_html` (text), `text_content` (text), `site_name` (text), `lead_image_url` (text), `reading_time_minutes` (int), `folder_id` (text), `is_read` (int 0/1), `is_favorite` (int 0/1), `is_archived` (int 0/1), `created_at` (text), `updated_at` (text).
   - Table `folders`: `id` (text), `name` (text), `color` (text), `created_at` (text).
   - Table `tags`: `id` (text), `name` (text), `color` (text).
   - Table `article_tags`: `article_id` (text), `tag_id` (text).

### Phase 2: Article Extraction Engine (`lib/extractor.ts`)
1. Implement article parser using `jsdom` and `@mozilla/readability`:
   - Fetch URL with realistic browser User-Agent.
   - Parse DOM and run Readability.
   - Calculate reading time (`wordCount / 220`).
   - Extract OpenGraph metadata (`og:image`, `og:site_name`, `og:description`).
   - Clean up extracted HTML for safe reader rendering.

### Phase 3: REST API Endpoints
1. Implement Next.js API routes (`app/api/...`):
   - `POST /api/articles`: Accept `{ url, folder_id?, tags? }`, trigger extraction, save to DB.
   - `GET /api/articles`: List articles filtered by status (`inbox`, `archive`, `favorites`), `folder_id`, `tag_id`, and search query `q`.
   - `GET /api/articles/[id]`: Retrieve single article with full HTML body.
   - `PATCH /api/articles/[id]`: Update read status, favorite status, archive status, folder, or tags.
   - `DELETE /api/articles/[id]`: Delete article.
   - `GET/POST /api/folders`: Manage folders/topics.
   - `GET/POST /api/tags`: Manage tags.

### Phase 4: Frontend UI & Mobile-First PWA
1. **Layout & Sidebar / Drawer**:
   - Mobile responsive drawer with sections: *Inbox*, *Archive*, *Favorites*, Folder list, Tag list.
   - Search bar with instant client-side filtering.
2. **Article List View**:
   - Card layout with thumbnail, title, site domain, reading time, folder/tag badges.
   - Quick action buttons: Archive, Favorite, Delete.
3. **Reader View**:
   - Minimalist, distraction-free reading experience.
   - Customizable typography: Serif / Sans font toggle, font size buttons (A- / A+).
   - 4 themes: White paper, Sepia cream, Dark slate, Pure OLED black.
   - Top action bar: Back to list, Archive, Favorite, Open original link.
4. **PWA Offline Support**:
   - `manifest.json` configured with `display: "standalone"`, icons, and theme colors.
   - Service Worker (`public/sw.js`) and IndexedDB sync mechanism for offline caching.

### Phase 5: Firefox WebExtension (`firefox-extension/`)
1. Create `firefox-extension/manifest.json` (Manifest V3 compatible with Firefox).
2. Implement `background.js`:
   - Check bookmarks on browser startup and listen to `browser.bookmarks.onCreated`.
   - Automatically find or create the `📥 PocketBox` folder under bookmarks.
   - When a bookmark appears in `📥 PocketBox`, send a POST request to `http://localhost:3000/api/articles`.
   - On success, remove the bookmark from `📥 PocketBox` so the folder remains a clean intake queue.
3. Implement `popup.html` & `popup.js`:
   - 1-click toolbar button to save the currently active tab directly, with optional folder and tag selection.

### Phase 6: Verification & Launch Guide
1. Launch local development server (`npm run dev`) on port 3000.
2. Verify article ingestion with a sample URL.
3. Provide step-by-step instructions for:
   - Loading the extension into Firefox via `about:debugging`.
   - Adding the PWA to iPhone Home Screen via local Wi-Fi.
