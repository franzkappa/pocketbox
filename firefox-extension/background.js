const API_BASE = 'http://localhost:3000';
const QUEUE_FOLDER_NAME = '📥 PocketBox';

let queueFolderId = null;

// Find or create the sync queue folder in bookmarks
async function getOrCreateQueueFolder() {
  try {
    const existingFolders = await browser.bookmarks.search({ title: QUEUE_FOLDER_NAME });
    if (existingFolders && existingFolders.length > 0) {
      queueFolderId = existingFolders[0].id;
      return queueFolderId;
    }

    // Try finding "Other Bookmarks" or root to place our intake folder
    const tree = await browser.bookmarks.getTree();
    const root = tree[0];
    let parentId = root.id;

    // Usually root has children: Bookmarks Toolbar, Bookmarks Menu, Other Bookmarks, Mobile Bookmarks
    if (root.children && root.children.length > 0) {
      const mobileFolder = root.children.find((c) => c.title.toLowerCase().includes('mobile'));
      const menuFolder = root.children.find((c) => c.title.toLowerCase().includes('menu'));
      const otherFolder = root.children.find((c) => c.title.toLowerCase().includes('other'));
      parentId = (mobileFolder || menuFolder || otherFolder || root.children[0]).id;
    }

    const created = await browser.bookmarks.create({
      parentId: parentId,
      title: QUEUE_FOLDER_NAME,
    });

    queueFolderId = created.id;
    console.log(`[PocketBox] Created sync queue folder: "${QUEUE_FOLDER_NAME}" with ID: ${queueFolderId}`);
    return queueFolderId;
  } catch (error) {
    console.error('[PocketBox] Error finding/creating queue folder:', error);
    return null;
  }
}

// Process all bookmarks waiting in the queue folder
async function processQueue() {
  const folderId = await getOrCreateQueueFolder();
  if (!folderId) return;

  try {
    const children = await browser.bookmarks.getChildren(folderId);
    if (!children || children.length === 0) {
      return;
    }

    console.log(`[PocketBox] Found ${children.length} bookmark(s) in queue folder.`);

    for (const bookmark of children) {
      if (!bookmark.url) continue;

      try {
        console.log(`[PocketBox] Forwarding bookmark to local server: ${bookmark.url}`);

        // Try to capture rendered DOM if this URL is open in any browser tab
        let tabHtml = null;
        try {
          if (browser.scripting && browser.scripting.executeScript) {
            const openTabs = await browser.tabs.query({ url: bookmark.url });
            if (openTabs && openTabs.length > 0 && openTabs[0].id) {
              const injection = await browser.scripting.executeScript({
                target: { tabId: openTabs[0].id },
                func: () => document.documentElement.outerHTML,
              });
              if (injection && injection[0] && injection[0].result) {
                tabHtml = injection[0].result;
              }
            }
          }
        } catch (tabErr) {
          console.warn(`[PocketBox] Could not extract from open tab for bookmark:`, tabErr);
        }

        const response = await fetch(`${API_BASE}/api/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: bookmark.url,
            title: bookmark.title,
            html: tabHtml || undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[PocketBox] Successfully saved: ${data.article?.title || bookmark.title}`);

          // Remove bookmark from queue so it doesn't get processed again
          await browser.bookmarks.remove(bookmark.id);

          // Show confirmation notification
          try {
            browser.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon-48.png',
              title: 'PocketBox Synced',
              message: `Saved: ${data.article?.title || bookmark.title || bookmark.url}`,
            });
          } catch {}
        } else {
          console.warn(`[PocketBox] Server returned error ${response.status}. Retrying later.`);
          // Stop processing subsequent bookmarks if local server is down or erroring
          break;
        }
      } catch (err) {
        console.warn('[PocketBox] Could not connect to local PocketBox server. Retrying later.', err);
        // Mac server is probably not running yet. Keep bookmarks intact.
        break;
      }
    }
  } catch (err) {
    console.error('[PocketBox] Error in processQueue:', err);
  }
}

// Listen for newly created bookmarks
browser.bookmarks.onCreated.addListener(async (id, bookmark) => {
  const folderId = await getOrCreateQueueFolder();
  if (bookmark.parentId === folderId) {
    console.log(`[PocketBox] New bookmark added to queue: ${bookmark.url}`);
    // Brief timeout to let Firefox Sync settle if batch syncing
    setTimeout(() => {
      processQueue();
    }, 1000);
  }
});

// Periodic queue check every 2 minutes via alarms API
browser.alarms.create('check-pocketbox-queue', { periodInMinutes: 2 });
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-pocketbox-queue') {
    processQueue();
  }
});

// Run check on startup and install
browser.runtime.onStartup.addListener(() => {
  processQueue();
});

browser.runtime.onInstalled.addListener(() => {
  getOrCreateQueueFolder().then(() => {
    processQueue();
  });
});

// Handle messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SAVE_ACTIVE_TAB') {
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/api/articles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: message.url,
            folder_id: message.folder_id,
            tags: message.tags,
          }),
        });

        const data = await response.json();
        sendResponse(data);
      } catch (error) {
        sendResponse({ success: false, error: 'Cannot connect to PocketBox server at localhost:3000' });
      }
    })();
    return true; // async sendResponse
  }

  if (message.type === 'PROCESS_QUEUE_NOW') {
    processQueue().then(() => sendResponse({ success: true }));
    return true;
  }
});
