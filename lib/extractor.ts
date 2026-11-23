import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedArticle {
  url: string;
  title: string;
  byline: string | null;
  excerpt: string | null;
  content_html: string;
  text_content: string;
  site_name: string | null;
  lead_image_url: string | null;
  reading_time_minutes: number;
  is_fallback?: boolean;
}

export interface ExtractArticleOptions {
  html?: string;
  fallbackTitle?: string;
}

export interface ExtractNewsletterOptions {
  html: string;
  title?: string;
  siteName?: string;
  byline?: string;
  excerpt?: string;
}

export async function extractArticle(
  targetUrl: string,
  options?: ExtractArticleOptions
): Promise<ExtractedArticle> {
  const parsedTarget = new URL(targetUrl);
  let finalUrl = targetUrl;
  let html = options?.html;

  if (!html) {
    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) Gecko/20100101 Firefox/134.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,it;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch article: HTTP ${response.status} ${response.statusText}`);
      }

      finalUrl = response.url || targetUrl;
      html = await response.text();
    } catch (fetchError: any) {
      console.warn(`[Extractor] Fetch failed for ${targetUrl}:`, fetchError.message);

      const isForbidden = fetchError.message?.includes('403');
      const isUnauthorized = fetchError.message?.includes('401');
      const reason = isForbidden
        ? 'Protected site (HTTP 403 Forbidden - anti-bot or paywall)'
        : isUnauthorized
        ? 'Protected site (HTTP 401 Unauthorized)'
        : (fetchError.message || 'Fetch failed');

      const fallbackTitle = options?.fallbackTitle?.trim() || parsedTarget.hostname + parsedTarget.pathname;
      const fallbackNotice = `<p><em>Unable to extract full content automatically: ${reason}.</em></p><p><a href="${targetUrl}" target="_blank" rel="noopener noreferrer">Click here to open and read the original article</a>.</p>`;

      return {
        url: targetUrl,
        title: fallbackTitle,
        byline: null,
        excerpt: `Could not fetch content (${reason}).`,
        content_html: fallbackNotice,
        text_content: `Could not fetch content (${reason}). Open original link to view.`,
        site_name: parsedTarget.hostname.replace(/^www\./, ''),
        lead_image_url: null,
        reading_time_minutes: 1,
        is_fallback: true,
      };
    }
  }

  // Create virtual DOM
  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  // Extract OpenGraph / Meta attributes before Readability alters the DOM
  const getMeta = (names: string[]): string | null => {
    for (const name of names) {
      const el = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
      const content = el?.getAttribute('content')?.trim();
      if (content) return content;
    }
    return null;
  };

  const ogTitle = getMeta(['og:title', 'twitter:title']);
  const ogDescription = getMeta(['og:description', 'twitter:description', 'description']);
  const ogImage = getMeta(['og:image', 'twitter:image:src', 'twitter:image']);
  const ogSiteName = getMeta(['og:site_name']) || parsedTarget.hostname.replace(/^www\./, '');
  const metaAuthor = getMeta(['author', 'article:author', 'twitter:creator']);

  // Resolve lead image URL if relative
  let leadImageUrl: string | null = null;
  if (ogImage) {
    try {
      leadImageUrl = new URL(ogImage, finalUrl).href;
    } catch {
      leadImageUrl = ogImage;
    }
  }

  // Run Mozilla Readability parser
  const reader = new Readability(doc, {
    charThreshold: 20,
    keepClasses: false,
  });

  const parsed = reader.parse();

  const title = (parsed?.title || ogTitle || options?.fallbackTitle || doc.title || 'Untitled Article').trim();
  const byline = (parsed?.byline || metaAuthor || null)?.trim() || null;
  const excerpt = (parsed?.excerpt || ogDescription || '').trim();
  const textContent = parsed?.textContent?.trim() || '';

  // Calculate estimated reading time (~220 words per minute)
  const wordCount = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 220));

  // If readability didn't find a lead image, try finding the first significant <img> in parsed content
  let contentHtml = parsed?.content || `<p>${excerpt || 'No readable text content found.'}</p>`;

  if (!leadImageUrl) {
    const tempDom = new JSDOM(contentHtml);
    const firstImg = tempDom.window.document.querySelector('img');
    const src = firstImg?.getAttribute('src');
    if (src) {
      try {
        leadImageUrl = new URL(src, finalUrl).href;
      } catch {
        leadImageUrl = src;
      }
    }
  }

  // Clean and sanitize HTML for reader view
  contentHtml = cleanContentHtml(contentHtml, finalUrl);

  return {
    url: finalUrl,
    title,
    byline,
    excerpt: excerpt || null,
    content_html: contentHtml,
    text_content: textContent,
    site_name: ogSiteName,
    lead_image_url: leadImageUrl,
    reading_time_minutes: readingTimeMinutes,
  };
}

function cleanContentHtml(html: string, baseUrl: string): string {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Resolve all relative images and links to absolute URLs
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      try {
        img.setAttribute('src', new URL(src, baseUrl).href);
      } catch {
        // keep as is
      }
    }
    // Lazy loading, async decoding & responsive styling
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
  });

  doc.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href');
    if (href) {
      try {
        a.setAttribute('href', new URL(href, baseUrl).href);
      } catch {
        // keep as is
      }
    }
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  // Remove scripts, styles, iframes without src
  doc.querySelectorAll('script, style, link, noscript').forEach((el) => el.remove());

  return doc.body.innerHTML;
}

const TRACKING_IMG_PATTERN =
  /(\/track\/open|\/wf\/open|open\.substack\.com|list-manage\.com\/track|\/e\/o\/|customeriomail\.com\/e\/o|beehiiv\.com\/e\/o|convertkit.*\.com\/open|substack\.com\/open|mailtrack|\/beacon|pixel\.(gif|png)|spacer\.(gif|png)|transparent\.(gif|png)|1x1\.(gif|png)|\/o\.gif|mailgun.*\/o\/|sendgrid.*\/wf\/open|awstrack\.me\/I0\/)/i;

const NON_HERO_IMG_PATTERN =
  /(facebook|twitter|x-icon|instagram|linkedin|youtube|tiktok|threads|bluesky|whatsapp|telegram|pinterest|rss|icon|emoji|twemoji|badge|avatar|share|subscribe|button|arrow|checkmark|star|logo|wordmark|s\.w\.org\/images\/core\/emoji)/i;

const BOILERPLATE_EXCERPT_PATTERN =
  /^(view\s+(this\s+email\s+)?in\s+(your\s+)?browser|read\s+online|read\s+in\s+(the\s+)?app|leggi\s+(nel\s+browser|online)|visualizza\s+(nel\s+browser|online)|apri\s+nel\s+browser|se\s+non\s+visualizzi|versione\s+(web|online)|unsubscribe|forwarded\s+this\s+email)/i;

function parseNumericDimension(val: string | null | undefined): number | null {
  if (!val) return null;
  const trimmed = val.trim().toLowerCase();
  if (trimmed.endsWith('%')) return null;
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(px)?$/);
  if (!match) return null;
  return Math.round(parseFloat(match[1]));
}

function getInlineStyleDimension(style: string, prop: 'width' | 'height'): number | null {
  const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const match = style.match(regex);
  if (!match) return null;
  return parseNumericDimension(match[1]);
}

function unwrapGoogleRedirectUrl(href: string): string {
  try {
    const parsed = new URL(href);
    if (
      (parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com') &&
      parsed.pathname === '/url'
    ) {
      const target = parsed.searchParams.get('q') || parsed.searchParams.get('url');
      if (target && /^https?:\/\//i.test(target)) {
        return target;
      }
    }
  } catch {
    // ignore invalid URL
  }
  return href;
}

function unwrapGmailProxyImageUrl(src: string): string {
  try {
    const parsed = new URL(src);
    if (
      /^ci\d*\.googleusercontent\.com$/i.test(parsed.hostname) &&
      (parsed.pathname.startsWith('/meips/') || parsed.pathname.startsWith('/proxy/'))
    ) {
      const hashIdx = src.indexOf('#');
      if (hashIdx !== -1) {
        const candidate = src.slice(hashIdx + 1).trim();
        // Prefer direct HTTPS original URL so images never expire on Google's proxy
        if (/^https:\/\//i.test(candidate)) {
          try {
            const valid = new URL(candidate);
            return valid.href;
          } catch {
            // keep proxy url
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return src;
}

function isHiddenByStyle(el: Element): boolean {
  if (el.hasAttribute('hidden')) return true;
  const style = (el.getAttribute('style') || '').toLowerCase();
  if (!style) return false;
  if (/display\s*:\s*none/i.test(style)) return true;
  if (/visibility\s*:\s*hidden/i.test(style)) return true;
  if (/mso-hide\s*:\s*all/i.test(style)) return true;
  if (/opacity\s*:\s*0(?:\.0+)?(?:\s*;|\s*$)/i.test(style)) return true;
  if (/max-height\s*:\s*0(?:px)?(?:\s*;|\s*$)/i.test(style)) return true;
  if (/font-size\s*:\s*0(?:px|pt|em|rem)?(?:\s*;|\s*$)/i.test(style) && !el.querySelector('img')) {
    return true;
  }
  return false;
}

function isDataTable(table: Element): boolean {
  const role = (table.getAttribute('role') || '').toLowerCase();
  if (role === 'presentation' || role === 'none') return false;
  if (table.querySelector('table')) return false;
  if (table.querySelector('h1, h2, h3, h4, img, blockquote')) return false;

  const hasHeader = Boolean(table.querySelector('th, caption'));
  const rows = Array.from(table.querySelectorAll('tr'));
  if (rows.length < 2) return false;

  let maxCols = 0;
  for (const row of rows) {
    const cells = row.querySelectorAll(':scope > td, :scope > th').length;
    if (cells > maxCols) maxCols = cells;
  }

  if (maxCols < 2 || maxCols > 8) return false;
  if (hasHeader) return true;

  // Compact multi-row tabular grid without rich block layout
  const hasRichBlocks = Boolean(table.querySelector('p, div, ul, ol'));
  return !hasRichBlocks && rows.length >= 2 && rows.length <= 30;
}

function unwrapElement(doc: Document, el: Element, replacementTag?: string): void {
  const parent = el.parentNode;
  if (!parent) return;

  if (replacementTag) {
    const replacement = doc.createElement(replacementTag);
    while (el.firstChild) {
      replacement.appendChild(el.firstChild);
    }
    parent.replaceChild(replacement, el);
  } else {
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  }
}

export async function extractNewsletter(
  targetUrl: string,
  options: ExtractNewsletterOptions
): Promise<ExtractedArticle> {
  const parsedTarget = new URL(targetUrl);
  const dom = new JSDOM(options.html || '', { url: targetUrl });
  const doc = dom.window.document;

  // 1. Remove scripts, styles, forms, hidden preheaders, and Gmail UI controls
  doc
    .querySelectorAll(
      'script, style, link, meta, title, noscript, iframe, object, embed, form, input, textarea, select, button, svg, canvas, .preheader, .mcnPreviewText, .yj6qo, .ajR'
    )
    .forEach((el) => el.remove());

  Array.from(doc.querySelectorAll('*')).forEach((el) => {
    if (el.isConnected && isHiddenByStyle(el)) {
      el.remove();
    }
  });

  // 2. Clean images: remove tracking pixels & auth-gated Gmail images, unwrap proxy URLs
  Array.from(doc.querySelectorAll('img')).forEach((img) => {
    const rawSrc = (img.getAttribute('src') || '').trim();
    if (!rawSrc || /^cid:/i.test(rawSrc) || /^https?:\/\/mail\.google\.com\//i.test(rawSrc)) {
      img.remove();
      return;
    }

    const style = img.getAttribute('style') || '';
    const origW = parseNumericDimension(img.getAttribute('width')) ?? getInlineStyleDimension(style, 'width');
    const origH = parseNumericDimension(img.getAttribute('height')) ?? getInlineStyleDimension(style, 'height');

    if ((origW !== null && origW <= 3) || (origH !== null && origH <= 3)) {
      img.remove();
      return;
    }

    if (/^data:image\//i.test(rawSrc) && rawSrc.length < 300) {
      img.remove();
      return;
    }

    const unwrappedSrc = unwrapGmailProxyImageUrl(rawSrc);
    if (TRACKING_IMG_PATTERN.test(rawSrc) || TRACKING_IMG_PATTERN.test(unwrappedSrc)) {
      img.remove();
      return;
    }

    let resolvedSrc = unwrappedSrc;
    try {
      resolvedSrc = new URL(unwrappedSrc, targetUrl).href;
    } catch {
      // keep as is
    }

    img.setAttribute('src', resolvedSrc);
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    img.setAttribute('referrerpolicy', 'no-referrer');
    if (origW !== null) img.setAttribute('data-pb-w', String(origW));
    if (origH !== null) img.setAttribute('data-pb-h', String(origH));
  });

  // 3. Clean links: unwrap Google redirects, drop javascript: URLs, open in new tab
  Array.from(doc.querySelectorAll('a')).forEach((a) => {
    const rawHref = (a.getAttribute('href') || '').trim();
    const hasText = Boolean(a.textContent?.trim());
    const hasImg = Boolean(a.querySelector('img'));
    if (!hasText && !hasImg) {
      a.remove();
      return;
    }

    if (!rawHref || /^javascript:/i.test(rawHref)) {
      unwrapElement(doc, a);
      return;
    }

    let cleanHref = unwrapGoogleRedirectUrl(rawHref);
    try {
      cleanHref = new URL(cleanHref, targetUrl).href;
    } catch {
      // keep as is
    }

    a.setAttribute('href', cleanHref);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  // 4. Normalize legacy email tags (<font>, <center>)
  Array.from(doc.querySelectorAll('font')).forEach((el) => unwrapElement(doc, el, 'span'));
  Array.from(doc.querySelectorAll('center')).forEach((el) => unwrapElement(doc, el, 'div'));

  // 5. Unwrap layout tables (innermost first), preserving real data tables
  let pass = 0;
  while (pass < 12) {
    const tables = Array.from(doc.querySelectorAll('table')).reverse();
    let unwrappedAny = false;
    for (const table of tables) {
      if (!table.isConnected || isDataTable(table)) continue;
      Array.from(table.querySelectorAll(':scope > tbody, :scope > thead, :scope > tfoot')).forEach((sec) => {
        Array.from(sec.querySelectorAll(':scope > tr')).forEach((tr) => {
          Array.from(tr.querySelectorAll(':scope > td, :scope > th')).forEach((cell) => {
            unwrapElement(doc, cell, 'div');
          });
          unwrapElement(doc, tr, 'div');
        });
        unwrapElement(doc, sec);
      });
      Array.from(table.querySelectorAll(':scope > tr')).forEach((tr) => {
        Array.from(tr.querySelectorAll(':scope > td, :scope > th')).forEach((cell) => {
          unwrapElement(doc, cell, 'div');
        });
        unwrapElement(doc, tr, 'div');
      });
      unwrapElement(doc, table, 'div');
      unwrappedAny = true;
    }
    if (!unwrappedAny) break;
    pass++;
  }

  // 6. Pick lead_image_url before stripping dimension hints
  let leadImageUrl: string | null = null;
  for (const img of Array.from(doc.querySelectorAll('img'))) {
    const src = img.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(src)) continue;

    const w = parseNumericDimension(img.getAttribute('data-pb-w'));
    const h = parseNumericDimension(img.getAttribute('data-pb-h'));
    if ((w !== null && w < 180) || (h !== null && h < 90)) continue;

    const alt = img.getAttribute('alt') || '';
    if (NON_HERO_IMG_PATTERN.test(src) || NON_HERO_IMG_PATTERN.test(alt)) continue;

    leadImageUrl = src;
    break;
  }

  // 7. Strip inline styles and email presentation attributes so Reader themes work cleanly
  const ALLOWED_ATTRS: Record<string, Set<string>> = {
    a: new Set(['href', 'target', 'rel', 'title']),
    img: new Set(['src', 'alt', 'title', 'loading', 'decoding', 'referrerpolicy']),
    td: new Set(['colspan', 'rowspan']),
    th: new Set(['colspan', 'rowspan']),
  };

  Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const allowed = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      if (!allowed || !allowed.has(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // 8. Prune empty wrappers and collapse nested single-child divs
  const PRUNABLE_TAGS = new Set([
    'div', 'p', 'span', 'section', 'article', 'header', 'footer', 'strong', 'em', 'b', 'i', 'u',
  ]);
  for (let i = 0; i < 6; i++) {
    let changed = false;
    Array.from(doc.body.querySelectorAll('*'))
      .reverse()
      .forEach((el) => {
        if (!el.isConnected) return;
        const tag = el.tagName.toLowerCase();
        if (PRUNABLE_TAGS.has(tag)) {
          const text = (el.textContent || '').replace(/\u00a0|\u200c|\u200b|\ufeff/g, '').trim();
          const hasMedia = Boolean(el.querySelector('img, hr, table, pre, code'));
          if (!text && !hasMedia) {
            el.remove();
            changed = true;
            return;
          }
        }

        // Collapse single-child div wrapper: <div><div>...</div></div> or <div><p>...</p></div>
        if (tag === 'div') {
          const meaningfulChildren = Array.from(el.childNodes).filter(
            (n) =>
              n.nodeType === 1 ||
              (n.nodeType === 3 && Boolean((n.textContent || '').replace(/\u00a0/g, '').trim()))
          );
          if (meaningfulChildren.length === 1 && meaningfulChildren[0].nodeType === 1) {
            const childEl = meaningfulChildren[0] as Element;
            const childTag = childEl.tagName.toLowerCase();
            if (
              ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'blockquote', 'table', 'figure', 'hr'].includes(
                childTag
              )
            ) {
              unwrapElement(doc, el);
              changed = true;
            }
          }
        }
      });
    if (!changed) break;
  }

  // Convert leaf text-bearing <div>s (with no block children) to <p> for clean typography spacing
  const BLOCK_SELECTOR = 'div, p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table, hr, figure';
  Array.from(doc.body.querySelectorAll('div')).forEach((div) => {
    if (!div.isConnected) return;
    if (!div.querySelector(BLOCK_SELECTOR)) {
      const text = (div.textContent || '').replace(/\u00a0/g, ' ').trim();
      if (text.length > 0 || div.querySelector('img')) {
        unwrapElement(doc, div, 'p');
      }
    }
  });

  // Collapse excessive consecutive <br> tags
  let contentHtml = doc.body.innerHTML
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br><br>')
    .trim();

  if (!contentHtml) {
    contentHtml = '<p>No readable newsletter content found.</p>';
  }

  // 9. Build clean text content, excerpt, and reading time
  const textBlocks: string[] = [];
  Array.from(doc.body.querySelectorAll('p, h1, h2, h3, h4, li, blockquote')).forEach((el) => {
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) textBlocks.push(t);
  });

  const rawText =
    textBlocks.length > 0
      ? textBlocks.join('\n\n')
      : (doc.body.textContent || '').replace(/\s+/g, ' ').trim();

  const textContent = rawText.trim();

  // Select meaningful excerpt skipping "View in browser" / preheader boilerplate
  let excerpt = (options.excerpt || '').trim();
  if (!excerpt) {
    const candidateBlock = textBlocks.find(
      (b) => b.length >= 35 && !BOILERPLATE_EXCERPT_PATTERN.test(b)
    );
    const sourceExcerpt = candidateBlock || textContent;
    if (sourceExcerpt) {
      excerpt =
        sourceExcerpt.length > 220
          ? sourceExcerpt.slice(0, 217).replace(/\s+\S*$/, '') + '...'
          : sourceExcerpt;
    }
  }

  const wordCount = textContent ? textContent.split(/\s+/).filter(Boolean).length : 0;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 220));

  const cleanedTitle = (options.title || 'Untitled Newsletter')
    .replace(/\s+-\s+[^-\s]+@[^-\s]+\s+-\s+Gmail$/i, '')
    .trim();

  const siteName =
    (options.siteName || '').trim() ||
    parsedTarget.hostname.replace(/^www\./, '');

  const byline = (options.byline || '').trim() || null;

  return {
    url: targetUrl,
    title: cleanedTitle || 'Untitled Newsletter',
    byline,
    excerpt: excerpt || null,
    content_html: contentHtml,
    text_content: textContent,
    site_name: siteName,
    lead_image_url: leadImageUrl,
    reading_time_minutes: readingTimeMinutes,
  };
}
