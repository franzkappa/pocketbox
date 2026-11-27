/**
 * Returns a validated http/https URL string, or null if invalid or unsafe.
 */
export function getSafeHttpUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Safely extracts a display hostname from a URL string without throwing.
 */
export function getUrlHostname(url?: string | null): string {
  if (!url) return 'Saved link';
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname || 'Saved link';
  } catch {
    return 'Saved link';
  }
}

/**
 * Checks whether a URL points to Gmail webmail.
 */
export function isGmailWebUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    return new URL(url.trim()).hostname.toLowerCase() === 'mail.google.com';
  } catch {
    return /^https?:\/\/mail\.google\.com\//i.test(url.trim());
  }
}

/**
 * Returns human-readable labels for an article's external source link.
 */
export function getSourceLinkLabels(
  sourceType?: 'article' | 'newsletter',
  url?: string | null
): { prefix: string; actionTitle: string; endButtonLabel: string } {
  const isNewsletter = sourceType === 'newsletter';
  const isGmail = isGmailWebUrl(url);

  if (isNewsletter) {
    if (isGmail) {
      return {
        prefix: 'Original email:',
        actionTitle: 'Open email in Gmail',
        endButtonLabel: 'Open email in Gmail',
      };
    }
    return {
      prefix: 'Web version:',
      actionTitle: 'Open newsletter web version',
      endButtonLabel: 'Open web version',
    };
  }

  return {
    prefix: 'Original article:',
    actionTitle: 'Open original website',
    endButtonLabel: 'Open original',
  };
}
