let currentTab = null;
let gmailNewsletterData = null;
let isGmailTab = false;

const MAX_HTML_BYTES = 3_200_000; // Safe margin below Vercel's 4.5MB serverless body limit

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

function isGmailUrl(url) {
  try {
    return new URL(url).hostname === 'mail.google.com';
  } catch {
    return false;
  }
}

/**
 * Injected into Gmail tabs (mail.google.com) to extract ONLY the currently open email.
 * Must remain completely self-contained because Firefox serializes this function.
 */
function extractGmailNewsletterInPage() {
  function unwrapGoogleRedirect(href) {
    try {
      const parsed = new URL(href);
      if (
        (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') &&
        parsed.pathname === '/url'
      ) {
        const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
        if (target && /^https?:\/\//i.test(target)) return target;
      }
    } catch {
      // ignore
    }
    return href;
  }

  function isValidWebVersionUrl(href) {
    if (!href || !/^https?:\/\//i.test(href)) return false;
    try {
      const u = new URL(href);
      const host = u.hostname.toLowerCase();
      const full = u.href.toLowerCase();

      // Reject Gmail, Google auth, social links, unsubscribe & preference management links
      if (
        host === 'mail.google.com' ||
        host === 'accounts.google.com' ||
        host === 'support.google.com' ||
        host.endsWith('facebook.com') ||
        host.endsWith('twitter.com') ||
        host === 'x.com' ||
        host.endsWith('instagram.com') ||
        host.endsWith('linkedin.com') ||
        host.endsWith('youtube.com') ||
        host.endsWith('youtu.be') ||
        host.endsWith('tiktok.com')
      ) {
        return false;
      }

      if (
        /(unsubscribe|opt-?out|manage[-_]?pref|email[-_]?pref|subscription[-_]?settings|privacy[-_]?policy|mailto:)/i.test(
          full
        )
      ) {
        return false;
      }

      // Reject bare root homepages with no path and no query params
      if ((u.pathname === '/' || u.pathname === '') && !u.search) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  function findViewInBrowserUrl(bodyRoot, subject) {
    const VIEW_IN_BROWSER_PATTERNS = [
      /\bview\s+(this\s+)?(email|newsletter|message|post|issue)?\s*in\s+(your\s+)?browser\b/i,
      /\bview\s+(this\s+)?(email|newsletter|message|post|issue)?\s*online\b/i,
      /\bread\s+(this\s+)?(email|newsletter|message|post|issue)?\s*(online|in\s+(your\s+)?browser|on\s+the\s+web|on\s+substack)\b/i,
      /\bopen\s+(this\s+)?(email|newsletter|message|post|issue)?\s*(online|in\s+(your\s+)?browser)\b/i,
      /\b(view\s+)?web\s+version\b/i,
      /\bview\s+on\s+the\s+web\b/i,
      /\bleggi\s+(questa\s+newsletter\s+)?(nel\s+browser|online|sul\s+web|sul\s+sito)\b/i,
      /\bvisualizza\s+(questa\s+email\s+)?(nel\s+browser|online|sul\s+web)\b/i,
      /\bapri\s+(nel\s+browser|la\s+versione\s+web|online)\b/i,
      /\bversione\s+(web|online)\b/i,
      /\b(se\s+non\s+visualizzi|non\s+riesci\s+a\s+visualizzare)/i,
      /\b(voir\s+dans\s+le\s+navigateur|lire\s+en\s+ligne|afficher\s+dans\s+le\s+navigateur|version\s+web)\b/i,
      /\b(ver\s+en\s+el\s+navegador|leer\s+en\s+l[ií]nea|versi[oó]n\s+web)\b/i,
      /\b(im\s+browser\s+(ansehen|[oö]ffnen)|webversion|online\s+lesen)\b/i,
    ];

    const anchors = Array.from(bodyRoot.querySelectorAll('a[href]'));
    for (const a of anchors) {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const label = (a.getAttribute('aria-label') || a.getAttribute('title') || '').trim();
      const combined = `${text} ${label}`.trim();
      if (!combined || combined.length > 140) continue;

      if (VIEW_IN_BROWSER_PATTERNS.some((rx) => rx.test(combined))) {
        const cleanHref = unwrapGoogleRedirect(a.getAttribute('href') || '');
        if (isValidWebVersionUrl(cleanHref)) {
          return cleanHref;
        }
      }
    }

    // Secondary check: Substack / Beehiiv / Ghost newsletter main title link matching email subject
    const normalizedSubject = (subject || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalizedSubject.length >= 10) {
      const headingLinks = Array.from(
        bodyRoot.querySelectorAll('h1 a[href], h2 a[href], h3 a[href], a[href] h1, a[href] h2')
      );
      for (const node of headingLinks) {
        const a = node.tagName === 'A' ? node : node.closest('a[href]');
        if (!a) continue;
        const linkText = (a.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        if (
          linkText &&
          (linkText === normalizedSubject ||
            (linkText.length >= 12 && normalizedSubject.includes(linkText)) ||
            (normalizedSubject.length >= 12 && linkText.includes(normalizedSubject)))
        ) {
          const cleanHref = unwrapGoogleRedirect(a.getAttribute('href') || '');
          if (isValidWebVersionUrl(cleanHref)) {
            return cleanHref;
          }
        }
      }
    }

    return null;
  }

  function sanitizeClonedHtml(rootEl) {
    const clone = rootEl.cloneNode(true);
    clone
      .querySelectorAll('script, style, link, noscript, iframe, svg, canvas, .yj6qo, .ajR')
      .forEach((el) => el.remove());

    // Strip huge inline base64 data URIs so payload stays compact
    clone.querySelectorAll('img[src^="data:"]').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src.length > 50_000) {
        img.remove();
      }
    });

    return clone.innerHTML;
  }

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function buildCanonicalGmailUrl(msgContainer, subjectEl, subject, senderEmail) {
    const accountMatch = window.location.pathname.match(/^\/mail\/u\/(\d+)/);
    const accountIdx = accountMatch ? accountMatch[1] : '0';

    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('th') || params.get('permmsgid') || params.get('permthid');

    const attrThreadId =
      subjectEl?.getAttribute('data-legacy-thread-id') ||
      document.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ||
      msgContainer?.getAttribute('data-legacy-message-id');

    let hashToken = null;
    const rawHash = (window.location.hash || '').replace(/^#/, '');
    if (rawHash) {
      const segments = rawHash.split('/').filter(Boolean);
      const RESERVED = new Set([
        'inbox', 'sent', 'drafts', 'all', 'starred', 'snoozed', 'imp',
        'trash', 'spam', 'scheduled', 'social', 'updates', 'forums',
        'promotions', 'primary', 'chats', 'label', 'search', 'category',
      ]);
      if (segments.length >= 2) {
        const last = segments[segments.length - 1];
        if (!RESERVED.has(last.toLowerCase()) && !/^p\d+$/i.test(last) && last.length >= 8) {
          hashToken = last;
        }
      }
    }

    const stableId =
      hashToken ||
      attrThreadId ||
      (queryId ? queryId.replace(/^msg-[a-z]:|^thread-[a-z]:/i, '') : null) ||
      `nl-${simpleHash(`${subject}|${senderEmail}`)}`;

    return `https://mail.google.com/mail/u/${accountIdx}/#all/${encodeURIComponent(stableId)}`;
  }

  // Case A: Gmail "View entire message" standalone view (view=lg / view=pt)
  const searchParams = new URLSearchParams(window.location.search);
  const viewMode = (searchParams.get('view') || '').toLowerCase();
  if (viewMode === 'lg' || viewMode === 'pt') {
    const subjectNode =
      document.querySelector('h2') ||
      document.querySelector('.maincontent font[size="+1"]') ||
      document.querySelector('font[size="+1"]');
    const subject = (
      subjectNode?.textContent ||
      document.title.replace(/\s+-\s+[^-\s]+@[^-\s]+\s+-\s+Gmail$/i, '') ||
      'Untitled Newsletter'
    ).trim();

    const bodyCandidates = Array.from(
      document.querySelectorAll('.message, .bodycontainer, td[colspan="2"]')
    ).filter((el) => (el.innerText || '').trim().length > 80);

    const bodyEl =
      bodyCandidates.length > 0
        ? bodyCandidates[bodyCandidates.length - 1]
        : document.body;

    // Try extracting sender from header text ("Name <email@domain>")
    const headerText = document.querySelector('.message font, .recipient, body')?.textContent || '';
    const senderMatch = headerText.match(/([^\n<]{2,60})\s*<([^>\s]+@[^>\s]+)>/);
    const senderName = senderMatch ? senderMatch[1].trim() : '';
    const senderEmail = senderMatch ? senderMatch[2].trim() : '';

    const siteName =
      senderName ||
      (senderEmail.includes('@') ? senderEmail.split('@')[1].replace(/^www\./, '') : 'Gmail Newsletter');
    const byline =
      senderName && senderEmail && senderName.toLowerCase() !== senderEmail.toLowerCase()
        ? `${senderName} (${senderEmail})`
        : senderName || senderEmail || null;

    const webUrl = findViewInBrowserUrl(bodyEl, subject);
    const gmailUrl = buildCanonicalGmailUrl(null, subjectNode, subject, senderEmail);
    const html = sanitizeClonedHtml(bodyEl);

    return {
      isOpenEmail: true,
      title: subject,
      siteName,
      byline,
      senderEmail,
      webUrl,
      gmailUrl,
      url: webUrl || gmailUrl,
      html,
      isClipped: false,
    };
  }

  // Case B: Standard Gmail Web App interface
  const mainRoot = document.querySelector('[role="main"]') || document;
  let visibleBodies = Array.from(mainRoot.querySelectorAll('.a3s.aiL')).filter(
    (el) => el.offsetParent !== null && (el.innerText || '').trim().length > 0
  );
  if (visibleBodies.length === 0) {
    visibleBodies = Array.from(mainRoot.querySelectorAll('.a3s')).filter(
      (el) => el.offsetParent !== null && (el.innerText || '').trim().length > 0
    );
  }

  if (visibleBodies.length === 0) {
    return {
      isOpenEmail: false,
      reason: 'no_open_email',
    };
  }

  // Take the last visible expanded email in the thread
  const bodyEl = visibleBodies[visibleBodies.length - 1];
  const msgContainer =
    bodyEl.closest('[data-legacy-message-id], [data-message-id], .adn, .gs, .h7') || mainRoot;

  const subjectEl =
    mainRoot.querySelector('h2.hP') ||
    document.querySelector('h2.hP') ||
    mainRoot.querySelector('[data-thread-perm-id]');

  const rawTitle = (
    subjectEl?.textContent ||
    document.title.replace(/\s+-\s+[^-\s]+@[^-\s]+\s+-\s+Gmail$/i, '') ||
    'Untitled Newsletter'
  ).trim();

  const senderEl =
    msgContainer.querySelector('span.gD[email]') ||
    msgContainer.querySelector('.gD') ||
    mainRoot.querySelector('span.gD[email]') ||
    document.querySelector('span.gD[email]');

  const senderEmail = (senderEl?.getAttribute('email') || '').trim();
  const rawSenderName = (senderEl?.getAttribute('name') || senderEl?.textContent || '').trim();
  const senderName =
    rawSenderName && rawSenderName.toLowerCase() !== senderEmail.toLowerCase()
      ? rawSenderName
      : '';

  const siteName =
    senderName ||
    (senderEmail.includes('@') ? senderEmail.split('@')[1].replace(/^www\./, '') : 'Newsletter');

  const byline =
    senderName && senderEmail
      ? `${senderName} (${senderEmail})`
      : senderName || senderEmail || null;

  const isClipped = Boolean(
    msgContainer.querySelector('.iX, a[href*="view=lg"]') ||
      mainRoot.querySelector('.iX, a[href*="view=lg"]')
  );

  const webUrl = findViewInBrowserUrl(bodyEl, rawTitle);
  const gmailUrl = buildCanonicalGmailUrl(msgContainer, subjectEl, rawTitle, senderEmail);
  const html = sanitizeClonedHtml(bodyEl);

  return {
    isOpenEmail: true,
    title: rawTitle,
    siteName,
    byline,
    senderEmail,
    webUrl,
    gmailUrl,
    url: webUrl || gmailUrl,
    html,
    isClipped,
  };
}

/**
 * Lightweight DOM extractor for regular web pages: strips scripts/styles/large SVGs
 * so heavy modern web apps stay well within Vercel's 4.5MB serverless request limit.
 */
function extractCleanPageHtmlInPage() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('script, style, noscript, template').forEach((el) => el.remove());
  clone.querySelectorAll('svg').forEach((svg) => {
    if (svg.outerHTML.length > 4000) svg.remove();
  });
  clone.querySelectorAll('img[src^="data:"]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (src.length > 50_000) img.remove();
  });
  return clone.outerHTML;
}

document.addEventListener('DOMContentLoaded', async () => {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const tabInfo = document.getElementById('tabInfo');
  const sourceRow = document.getElementById('sourceRow');
  const linkHint = document.getElementById('linkHint');
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

  function clearAlert() {
    alertBox.textContent = '';
    alertBox.className = 'alert-box';
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

  // Get active tab & detect Gmail newsletter
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0]) {
      currentTab = tabs[0];
      tabTitle.textContent = currentTab.title || 'Active Tab';
      tabUrl.textContent = currentTab.url || '';

      if (currentTab.url && isGmailUrl(currentTab.url)) {
        isGmailTab = true;
        tabInfo.classList.add('newsletter');
        sourceRow.classList.remove('hidden');

        try {
          if (browser.scripting && browser.scripting.executeScript && currentTab.id) {
            const injection = await browser.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: extractGmailNewsletterInPage,
            });
            const result = injection && injection[0] && injection[0].result;

            if (result && result.isOpenEmail) {
              gmailNewsletterData = result;
              tabTitle.textContent = result.title || 'Newsletter';
              tabUrl.textContent = result.byline || result.siteName || 'Gmail Newsletter';
              linkHint.textContent = result.webUrl ? '🔗 Link web rilevato' : '📧 Link Gmail';
              btnSave.classList.add('newsletter');
              btnSave.textContent = '📧 Save Newsletter';

              if (result.isClipped) {
                showAlert(
                  '⚠️ Gmail ha troncato questa email. Se vuoi il testo completo, clicca "Visualizza l\'intero messaggio" in Gmail prima di salvare.',
                  'warning'
                );
              }
            } else {
              gmailNewsletterData = null;
              tabTitle.textContent = 'Nessuna newsletter aperta';
              tabUrl.textContent = 'Apri un\'email in Gmail per salvarla in PocketBox.';
              linkHint.textContent = '';
              btnSave.disabled = true;
              btnSave.textContent = '📧 Apri un\'email in Gmail';
              showAlert('Apri una newsletter in Gmail prima di cliccare Salva.', 'warning');
            }
          }
        } catch (gmailErr) {
          console.warn('[PocketBox Popup] Gmail extraction failed:', gmailErr);
          showAlert('Impossibile leggere l\'email aperta in Gmail. Ricarica la scheda Gmail e riprova.', 'error');
        }
      }
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

    if (isGmailTab && !gmailNewsletterData) {
      showAlert('Apri una newsletter in Gmail prima di salvare.', 'warning');
      return;
    }

    const defaultBtnLabel = isGmailTab ? '📧 Save Newsletter' : '💾 Save to PocketBox';
    btnSave.disabled = true;
    btnSave.textContent = isGmailTab ? 'Saving Newsletter...' : 'Extracting & Saving...';
    clearAlert();

    const folderId = folderSelect.value || undefined;
    const tags = tagsInput.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      let payload;

      if (isGmailTab && gmailNewsletterData) {
        let htmlPayload = gmailNewsletterData.html || '';
        if (new Blob([htmlPayload]).size > MAX_HTML_BYTES) {
          htmlPayload = htmlPayload.slice(0, MAX_HTML_BYTES);
        }

        payload = {
          url: gmailNewsletterData.url,
          title: gmailNewsletterData.title,
          html: htmlPayload,
          source_type: 'newsletter',
          site_name: gmailNewsletterData.siteName,
          byline: gmailNewsletterData.byline || undefined,
          folder_id: folderId,
          tags: tags,
        };
      } else {
        // 1. Try to extract cleaned rendered HTML from active tab
        let tabHtml = null;
        try {
          if (browser.scripting && browser.scripting.executeScript && currentTab.id) {
            const injection = await browser.scripting.executeScript({
              target: { tabId: currentTab.id },
              func: extractCleanPageHtmlInPage,
            });
            if (injection && injection[0] && injection[0].result) {
              const candidateHtml = injection[0].result;
              if (new Blob([candidateHtml]).size <= MAX_HTML_BYTES) {
                tabHtml = candidateHtml;
              } else {
                console.warn(
                  '[PocketBox Popup] Page HTML exceeded safe payload limit; falling back to server-side fetch.'
                );
              }
            }
          }
        } catch (scriptErr) {
          console.warn('[PocketBox Popup] Could not extract DOM via scripting:', scriptErr);
        }

        payload = {
          url: currentTab.url,
          title: currentTab.title,
          html: tabHtml || undefined,
          source_type: 'article',
          folder_id: folderId,
          tags: tags,
        };
      }

      const res = await fetch(`${config.url}/api/articles`, {
        method: 'POST',
        headers: getAuthHeaders(config.apiKey),
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data && data.success) {
        const msg = isGmailTab
          ? data.alreadyExists
            ? 'Newsletter already in library (updated)!'
            : 'Newsletter saved to PocketBox!'
          : data.alreadyExists
          ? 'Article already in library (updated)!'
          : 'Saved successfully!';
        showAlert(msg, 'success');
        btnSave.textContent = '✓ Saved!';
        setTimeout(() => window.close(), 1200);
      } else if (res.status === 413) {
        throw new Error('Contenuto troppo grande per il server (HTTP 413).');
      } else {
        throw new Error((data && data.error) || `Server HTTP ${res.status}`);
      }
    } catch (err) {
      showAlert(`Save failed: ${err.message}`, 'error');
      btnSave.disabled = false;
      btnSave.textContent = defaultBtnLabel;
    }
  });
});
