import type { Article } from './types';

export interface ShareArticleResult {
  shareToken: string;
  shareUrl: string;
  copied: boolean;
}

export class ShareAuthError extends Error {
  constructor() {
    super('Authentication required');
    this.name = 'ShareAuthError';
  }
}

export function buildShareUrl(shareToken: string): string {
  return `${window.location.origin}/share/${encodeURIComponent(shareToken)}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

async function requestShareToken(articleId: string): Promise<string> {
  const res = await fetch(`/api/articles/${encodeURIComponent(articleId)}/share`, {
    method: 'POST',
  });

  if (res.status === 401) {
    const data = await res.json().catch(() => ({}));
    if (data?.authRequired) {
      throw new ShareAuthError();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.share_token) {
    throw new Error(data?.error || 'Failed to generate share link');
  }

  return String(data.share_token);
}

/**
 * Generates (or reuses) a public share token for a saved article and copies its
 * URL to the clipboard on a single click. Uses Promise-backed ClipboardItem when
 * available so Safari/iOS retains the user gesture across the async API request.
 */
export async function shareArticleAndCopy(article: Article): Promise<ShareArticleResult> {
  if (article.share_token) {
    const shareUrl = buildShareUrl(article.share_token);
    const copied = await copyTextToClipboard(shareUrl);
    return {
      shareToken: article.share_token,
      shareUrl,
      copied,
    };
  }

  const tokenPromise = requestShareToken(article.id);
  const urlPromise = tokenPromise.then((token) => buildShareUrl(token));

  let clipboardWritePromise: Promise<boolean> | null = null;
  if (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard?.write === 'function'
  ) {
    try {
      const item = new ClipboardItem({
        'text/plain': urlPromise.then((url) => new Blob([url], { type: 'text/plain' })),
      });
      clipboardWritePromise = navigator.clipboard
        .write([item])
        .then(() => true)
        .catch(() => false);
    } catch {
      clipboardWritePromise = null;
    }
  }

  const shareToken = await tokenPromise;
  const shareUrl = buildShareUrl(shareToken);

  let copied = false;
  if (clipboardWritePromise) {
    copied = await clipboardWritePromise;
  }
  if (!copied) {
    copied = await copyTextToClipboard(shareUrl);
  }

  return {
    shareToken,
    shareUrl,
    copied,
  };
}
