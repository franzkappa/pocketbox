import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { sanitizeHtmlForPublicShare } from '@/lib/sanitize';
import { SharedArticleReader } from '@/components/SharedArticleReader';
import type { SharedArticle } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{12,64}$/;

function getSafeSiteName(siteName: string | null | undefined, url: string): string | null {
  if (siteName && siteName.trim()) return siteName.trim();
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'mail.google.com') return 'Newsletter';
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;

  if (!SHARE_TOKEN_REGEX.test(token)) {
    return {
      title: 'Link not found - PocketBox',
      robots: { index: false, follow: false },
    };
  }

  const article = await db.getArticleByShareToken(token);
  if (!article) {
    return {
      title: 'Link not found - PocketBox',
      robots: { index: false, follow: false },
    };
  }

  const description = article.excerpt || 'Saved article shared via PocketBox';

  return {
    title: `${article.title} — PocketBox`,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: article.title,
      description,
      type: 'article',
      images: article.lead_image_url ? [{ url: article.lead_image_url }] : undefined,
    },
  };
}

export default async function SharedArticlePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!SHARE_TOKEN_REGEX.test(token)) {
    notFound();
  }

  const article = await db.getArticleByShareToken(token);
  if (!article) {
    notFound();
  }

  const rawHtml = article.content_html || (article.excerpt ? `<p>${article.excerpt}</p>` : '');
  const sanitizedHtml = sanitizeHtmlForPublicShare(rawHtml);

  const sharedArticle: SharedArticle = {
    title: article.title,
    byline: article.byline ?? null,
    excerpt: article.excerpt ?? null,
    content_html: sanitizedHtml,
    site_name: getSafeSiteName(article.site_name, article.url),
    lead_image_url: article.lead_image_url ?? null,
    reading_time_minutes: article.reading_time_minutes || 1,
    source_type: article.source_type === 'newsletter' ? 'newsletter' : 'article',
    created_at: article.created_at,
  };

  return <SharedArticleReader article={sharedArticle} />;
}
