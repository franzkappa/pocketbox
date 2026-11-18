const API_BASE = 'http://localhost:3000';

let currentTab = null;

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const tabTitle = document.getElementById('tabTitle');
  const tabUrl = document.getElementById('tabUrl');
  const folderSelect = document.getElementById('folderSelect');
  const tagsInput = document.getElementById('tagsInput');
  const saveForm = document.getElementById('saveForm');
  const btnSave = document.getElementById('btnSave');
  const alertBox = document.getElementById('alertBox');
  const btnSyncQueue = document.getElementById('btnSyncQueue');

  function showAlert(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`;
  }

  // Get active tab
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      tabTitle.textContent = currentTab.title || 'Active Tab';
      tabUrl.textContent = currentTab.url || '';
    }
  } catch (err) {
    tabTitle.textContent = 'Unable to get tab info';
  }

  // Check server status & load folders
  try {
    const res = await fetch(`${API_BASE}/api/folders`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      statusDot.className = 'status-dot online';
      statusText.textContent = 'Server Online';

      const data = await res.json();
      if (data.success && data.folders) {
        data.folders.forEach((folder) => {
          const opt = document.createElement('option');
          opt.value = folder.id;
          opt.textContent = folder.name;
          folderSelect.appendChild(opt);
        });
      }
    } else {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Server Error';
    }
  } catch (err) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Server Offline';
  }

  // Handle Save
  saveForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentTab || !currentTab.url) {
      showAlert('No valid URL to save', 'error');
      return;
    }

    btnSave.disabled = true;
    btnSave.textContent = 'Extracting & Saving...';

    const folderId = folderSelect.value || undefined;
    const tags = tagsInput.value
      ? tagsInput.value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : undefined;

    // Extract rendered HTML directly from the active tab.
    // This bypasses server-side 403 Forbidden blocks (DataDome, Cloudflare, Paywalls)
    let pageHtml = null;
    try {
      if (browser.scripting && browser.scripting.executeScript && currentTab.id) {
        const results = await browser.scripting.executeScript({
          target: { tabId: currentTab.id },
          func: () => document.documentElement.outerHTML,
        });
        if (results && results[0] && results[0].result) {
          pageHtml = results[0].result;
        }
      } else if (browser.tabs && browser.tabs.executeScript && currentTab.id) {
        const results = await browser.tabs.executeScript(currentTab.id, {
          code: 'document.documentElement.outerHTML;',
        });
        if (results && results[0]) {
          pageHtml = results[0];
        }
      }
    } catch (extractErr) {
      console.warn('[PocketBox] Client-side DOM extraction failed, falling back:', extractErr);
    }

    try {
      const response = await fetch(`${API_BASE}/api/articles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentTab.url,
          title: currentTab.title,
          html: pageHtml || undefined,
          folder_id: folderId,
          tags: tags,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        btnSave.textContent = '✓ Saved to PocketBox!';
        btnSave.style.background = '#10B981';
        showAlert(data.alreadyExists ? 'Already in your library!' : 'Article saved successfully!', 'success');
        setTimeout(() => {
          window.close();
        }, 1200);
      } else {
        showAlert(data.error || 'Failed to save', 'error');
        btnSave.disabled = false;
        btnSave.textContent = '💾 Save to PocketBox';
      }
    } catch (err) {
      showAlert('Could not connect to localhost:3000', 'error');
      btnSave.disabled = false;
      btnSave.textContent = '💾 Save to PocketBox';
    }
  });

  // Handle Sync Queue Now
  btnSyncQueue.addEventListener('click', async () => {
    btnSyncQueue.textContent = 'Syncing...';
    try {
      await browser.runtime.sendMessage({ type: 'PROCESS_QUEUE_NOW' });
      btnSyncQueue.textContent = '✓ Synced!';
      setTimeout(() => {
        btnSyncQueue.textContent = '🔄 Sync Bookmark Queue';
      }, 1500);
    } catch {
      btnSyncQueue.textContent = '🔄 Sync Bookmark Queue';
    }
  });
});
