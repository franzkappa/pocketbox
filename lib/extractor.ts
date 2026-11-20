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
