let currentTab = null;

async function getServerConfig() {
  const data = await browser.storage.sync.get({
    serverUrl: 'http://localhost:3000',
    apiKey: '',
  });
  let url = (data.serverUrl || 'http://localhost:3000').trim().replace(/\/+$/, '');
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  const apiKey = (data.apiKey || '').trim();
  return { url, apiKey };
}

function getAuthHeaders(apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }
  return headers;
}

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
  const openLibraryLink = document.getElementById('openLibraryLink');

  // Settings elements
  const btnToggleSettings = document.getElementById('btnToggleSettings');
  const settingsPanel = document.getElementById('settingsPanel');
  const serverUrlInput = document.getElementById('serverUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const btnSaveSettings = document.getElementById('btnSaveSettings');

  let config = await getServerConfig();
  if (openLibraryLink) openLibraryLink.href = config.url;
  if (serverUrlInput) serverUrlInput.value = config.url;
  if (apiKeyInput) apiKeyInput.value = config.apiKey;

  function showAlert(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert-box ${type}`;
  }

  // Toggle settings panel
  btnToggleSettings.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  // Save settings
  btnSaveSettings.addEventListener('click', async () => {
    let newUrl = (serverUrlInput.value || 'http://localhost:3000').trim().replace(/\/+$/, '');
    if (newUrl && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }
    const newKey = (apiKeyInput.value || '').trim();

    await browser.storage.sync.set({
      serverUrl: newUrl,
      apiKey: newKey,
    });

    config = { url: newUrl, apiKey: newKey };
    serverUrlInput.value = newUrl;
    if (openLibraryLink) openLibraryLink.href = config.url;
    settingsPanel.classList.add('hidden');
    showAlert('Impostazioni salvate! Verifico connessione...', 'success');
    checkServerAndLoadFolders();
  });

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
  async function checkServerAndLoadFolders() {
    try {
      const res = await fetch(`${config.url}/api/folders`, {
        headers: getAuthHeaders(config.apiKey),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        statusDot.className = 'status-dot online';
        statusText.textContent = 'Online';

        const data = await res.json();
        if (data.success && data.folders) {
          folderSelect.innerHTML = '<option value="">No Folder (General)</option>';
          data.folders.forEach((folder) => {
            const opt = document.createElement('option');
            opt.value = folder.id;
            opt.textContent = folder.name;
            folderSelect.appendChild(opt);
          });
        }
      } else if (res.status === 401) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Auth Required';
        showAlert('Password o API Key errata o mancante. Clicca ⚙️ per configurarla.', 'error');
      } else {
        statusDot.className = 'status-dot';
        statusText.textContent = `Error ${res.status}`;
        showAlert(`Errore server: HTTP ${res.status}`, 'error');
      }
    } catch (err) {
      statusDot.className = 'status-dot';
      statusText.textContent = 'Offline';
      showAlert(`Connessione non riuscita a ${config.url}. Verifica l'URL in ⚙️.`, 'error');
    }
  }

  checkServerAndLoadFolders();

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
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      // 1. Try to extract rendered HTML from active tab
      let tabHtml = null;
      try {
        if (browser.scripting && browser.scripting.executeScript && currentTab.id) {
          const injection = await browser.scripting.executeScript({
            target: { tabId: currentTab.id },
            func: () => document.documentElement.outerHTML,
          });
          if (injection && injection[0] && injection[0].result) {
            tabHtml = injection[0].result;
          }
        }
      } catch (scriptErr) {
        console.warn('[PocketBox Popup] Could not extract DOM via scripting:', scriptErr);
      }

      // 2. Post to /api/articles
      const payload = {
        url: currentTab.url,
        title: currentTab.title,
        html: tabHtml || undefined,
        folder_id: folderId,
        tags: tags,
      };

      const res = await fetch(`${config.url}/api/articles`, {
        method: 'POST',
        headers: getAuthHeaders(config.apiKey),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const msg = data.alreadyExists
          ? 'Article already in library (updated)!'
          : 'Saved successfully!';
        showAlert(msg, 'success');
        btnSave.textContent = '✓ Saved!';
        setTimeout(() => window.close(), 1200);
      } else {
        throw new Error(data.error || `Server HTTP ${res.status}`);
      }
    } catch (err) {
      showAlert(`Save failed: ${err.message}`, 'error');
      btnSave.disabled = false;
      btnSave.textContent = '💾 Save to PocketBox';
    }
  });
});
