import { JSDOM } from 'jsdom';

const DANGEROUS_TAGS = [
  'script',
  'style',
  'link',
  'noscript',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'applet',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'meta',
  'base',
  'svg',
  'math',
];

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'title', 'loading', 'decoding', 'referrerpolicy', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  ol: new Set(['start', 'type']),
  blockquote: new Set(['cite']),
  q: new Set(['cite']),
  time: new Set(['datetime']),
};

function isSafeHref(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'http:' ||
      parsed.protocol === 'https:' ||
      parsed.protocol === 'mailto:'
    );
  } catch {
    return false;
  }
}

function isSafeImageSrc(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(trimmed)) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes saved article/newsletter HTML before rendering on a public share route.
 * Strips dangerous elements, event handlers, inline styles, and unsafe URI schemes.
 */
export function sanitizeHtmlForPublicShare(html: string): string {
  const dom = new JSDOM(`<body>${html || ''}</body>`);
  const doc = dom.window.document;

  doc.querySelectorAll(DANGEROUS_TAGS.join(',')).forEach((el) => el.remove());

  Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const allowed = ALLOWED_ATTRS[tag];

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || !allowed || !allowed.has(name)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      if (!isSafeHref(href)) {
        el.removeAttribute('href');
      } else {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }
    }

    if (tag === 'img') {
      const src = el.getAttribute('src') || '';
      if (!isSafeImageSrc(src)) {
        el.remove();
        return;
      }
      el.setAttribute('loading', 'lazy');
      el.setAttribute('decoding', 'async');
    }
  });

  return doc.body.innerHTML;
}
