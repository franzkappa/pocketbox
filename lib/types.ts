export type FolderType = 'article' | 'newsletter';

export interface Folder {
  id: string;
  name: string;
  color: string;
  folder_type?: FolderType;
  created_at: string;
  article_count?: number;
}

export interface NewsletterRule {
  id: string;
  folder_id: string;
  sender_email?: string | null;
  sender_domain?: string | null;
  sender_name?: string | null;
  subject_prefix?: string | null;
  masthead?: string | null;
  utm_campaign?: string | null;
  web_host?: string | null;
  updated_at: string;
}

export interface NewsletterSignalsInput {
  title?: string | null;
  siteName?: string | null;
  byline?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
  url?: string | null;
  html?: string | null;
}

export interface ExtractedNewsletterSignals {
  senderEmail: string | null;
  senderLocal: string | null;
  senderDomain: string | null;
  isSharedPlatformDomain: boolean;
  rawSenderName: string | null;
  senderPublicationName: string | null;
  senderAuthorName: string | null;
  subjectPrefix: string | null;
  subjectSeriesName: string | null;
  masthead: string | null;
  logoAlt: string | null;
  footerSeries: string | null;
  utmCampaign: string | null;
  webHost: string | null;
}

export interface NewsletterClassificationResult {
  matchedFolder: Folder | null;
  suggestedFolderName: string;
  suggestedColor: string;
  isNewFolder: boolean;
  confidence: number;
  signals: ExtractedNewsletterSignals;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  article_count?: number;
}

export type ArticleSourceType = 'article' | 'newsletter';

export interface Article {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  excerpt?: string | null;
  content_html?: string | null;
  text_content?: string | null;
  site_name?: string | null;
  lead_image_url?: string | null;
  reading_time_minutes: number;
  source_type?: ArticleSourceType;
  folder_id?: string | null;
  share_token?: string | null;
  is_read: number; // 0 or 1
  is_favorite: number; // 0 or 1
  is_archived: number; // 0 or 1
  created_at: string;
  updated_at: string;
  folder?: Folder | null;
  tags?: Tag[];
}

export interface SharedArticle {
  title: string;
  byline: string | null;
  excerpt: string | null;
  content_html: string;
  site_name: string | null;
  lead_image_url: string | null;
  reading_time_minutes: number;
  source_type: ArticleSourceType;
  created_at: string;
}

export type ArticleFilter = 'inbox' | 'newsletters' | 'archive' | 'favorites';

export interface ArticleQueryOptions {
  filter?: ArticleFilter;
  folder_id?: string;
  tag_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
