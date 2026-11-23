export interface Folder {
  id: string;
  name: string;
  color: string;
  created_at: string;
  article_count?: number;
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
  is_read: number; // 0 or 1
  is_favorite: number; // 0 or 1
  is_archived: number; // 0 or 1
  created_at: string;
  updated_at: string;
  folder?: Folder | null;
  tags?: Tag[];
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
