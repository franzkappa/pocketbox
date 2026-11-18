import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { Article, Folder, Tag, ArticleQueryOptions } from './types';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'pocketbox.db');

// Global database instance caching for Next.js hot reloads in development
const globalForDb = globalThis as unknown as { dbInstance?: DatabaseSync };

function getDatabase(): DatabaseSync {
  if (!globalForDb.dbInstance) {
    const db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSchema(db);
    globalForDb.dbInstance = db;
  }
  return globalForDb.dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366F1',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#10B981'
    );

    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      byline TEXT,
      excerpt TEXT,
      content_html TEXT,
      text_content TEXT,
      site_name TEXT,
      lead_image_url TEXT,
      reading_time_minutes INTEGER NOT NULL DEFAULT 1,
      folder_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS article_tags (
      article_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(is_archived, is_favorite, is_read);
    CREATE INDEX IF NOT EXISTS idx_articles_folder ON articles(folder_id);
    CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
  `);

  // Seed initial folders if table is empty
  const folderCount = (db.prepare('SELECT COUNT(*) as count FROM folders').get() as { count: number }).count;
  if (folderCount === 0) {
    const now = new Date().toISOString();
    const insertFolder = db.prepare('INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)');
    insertFolder.run('f-tech', 'Technology', '#3B82F6', now);
    insertFolder.run('f-work', 'Work', '#10B981', now);
    insertFolder.run('f-long', 'Long Reads', '#8B5CF6', now);
    insertFolder.run('f-pers', 'Personal', '#F59E0B', now);

    const insertTag = db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)');
    insertTag.run('t-must', 'must-read', '#EF4444');
    insertTag.run('t-quick', 'quick', '#10B981');
    insertTag.run('t-ref', 'reference', '#6366F1');
  }
}

export const db = {
  // Folder operations
  getFolders(): Folder[] {
    const database = getDatabase();
    const rows = database.prepare(`
      SELECT f.*, COUNT(a.id) as article_count
      FROM folders f
      LEFT JOIN articles a ON a.folder_id = f.id AND a.is_archived = 0
      GROUP BY f.id
      ORDER BY f.name ASC
    `).all() as unknown as Folder[];
    return rows;
  },

  createFolder(name: string, color: string = '#6366F1'): Folder {
    const database = getDatabase();
    const id = 'f-' + Math.random().toString(36).substring(2, 9);
    const created_at = new Date().toISOString();
    database.prepare('INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(id, name.trim(), color, created_at);
    return { id, name: name.trim(), color, created_at, article_count: 0 };
  },

  deleteFolder(id: string): void {
    const database = getDatabase();
    database.prepare('DELETE FROM folders WHERE id = ?').run(id);
  },

  // Tag operations
  getTags(): Tag[] {
    const database = getDatabase();
    const rows = database.prepare(`
      SELECT t.*, COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON at.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `).all() as unknown as Tag[];
    return rows;
  },

  createTag(name: string, color: string = '#10B981'): Tag {
    const database = getDatabase();
    const id = 't-' + Math.random().toString(36).substring(2, 9);
    database.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, name.trim().toLowerCase(), color);
    return { id, name: name.trim().toLowerCase(), color, article_count: 0 };
  },

  deleteTag(id: string): void {
    const database = getDatabase();
    database.prepare('DELETE FROM tags WHERE id = ?').run(id);
  },

  // Article operations
  getArticles(options: ArticleQueryOptions = {}): Article[] {
    const database = getDatabase();
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.filter === 'archive') {
      conditions.push('a.is_archived = 1');
    } else if (options.filter === 'favorites') {
      conditions.push('a.is_favorite = 1');
    } else {
      // default: inbox (not archived)
      conditions.push('a.is_archived = 0');
    }

    if (options.folder_id) {
      conditions.push('a.folder_id = ?');
      params.push(options.folder_id);
    }

    if (options.tag_id) {
      conditions.push('EXISTS (SELECT 1 FROM article_tags at WHERE at.article_id = a.id AND at.tag_id = ?)');
      params.push(options.tag_id);
    }

    if (options.q && options.q.trim()) {
      conditions.push('(a.title LIKE ? OR a.excerpt LIKE ? OR a.site_name LIKE ? OR a.text_content LIKE ?)');
      const term = `%${options.q.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT 
        a.id, a.url, a.title, a.byline, a.excerpt, a.site_name,
        a.lead_image_url, a.reading_time_minutes, a.folder_id,
        a.is_read, a.is_favorite, a.is_archived, a.created_at, a.updated_at,
        f.name as folder_name, f.color as folder_color
      FROM articles a
      LEFT JOIN folders f ON f.id = a.folder_id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;

    const rows = database.prepare(query).all(...params) as unknown as (Article & { folder_name?: string; folder_color?: string })[];

    return rows.map(row => {
      const folder = row.folder_id && row.folder_name
        ? { id: row.folder_id, name: row.folder_name, color: row.folder_color || '#6366F1', created_at: '' }
        : null;

      // Get tags for article
      const tagRows = database.prepare(`
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN article_tags at ON at.tag_id = t.id
        WHERE at.article_id = ?
      `).all(row.id) as unknown as Tag[];

      return {
        ...row,
        folder,
        tags: tagRows,
      };
    });
  },

  getArticleById(id: string): Article | null {
    const database = getDatabase();
    const row = database.prepare(`
      SELECT 
        a.*,
        f.name as folder_name, f.color as folder_color
      FROM articles a
      LEFT JOIN folders f ON f.id = a.folder_id
      WHERE a.id = ?
    `).get(id) as unknown as (Article & { folder_name?: string; folder_color?: string }) | undefined;

    if (!row) return null;

    const folder = row.folder_id && row.folder_name
      ? { id: row.folder_id, name: row.folder_name, color: row.folder_color || '#6366F1', created_at: '' }
      : null;

    const tags = database.prepare(`
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN article_tags at ON at.tag_id = t.id
      WHERE at.article_id = ?
    `).all(row.id) as unknown as Tag[];

    return {
      ...row,
      folder,
      tags,
    };
  },

  getArticleByUrl(url: string): Article | null {
    const database = getDatabase();
    const row = database.prepare('SELECT id FROM articles WHERE url = ?').get(url) as unknown as { id: string } | undefined;
    if (!row) return null;
    return this.getArticleById(row.id);
  },

  createArticle(data: {
    url: string;
    title: string;
    byline?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
    text_content?: string | null;
    site_name?: string | null;
    lead_image_url?: string | null;
    reading_time_minutes?: number;
    folder_id?: string | null;
    tags?: string[]; // tag names or IDs
  }): Article {
    const database = getDatabase();
    const id = 'art_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();

    database.prepare(`
      INSERT INTO articles (
        id, url, title, byline, excerpt, content_html, text_content,
        site_name, lead_image_url, reading_time_minutes, folder_id,
        is_read, is_favorite, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
    `).run(
      id,
      data.url,
      data.title,
      data.byline || null,
      data.excerpt || null,
      data.content_html || null,
      data.text_content || null,
      data.site_name || null,
      data.lead_image_url || null,
      data.reading_time_minutes || 1,
      data.folder_id || null,
      now,
      now
    );

    // Handle tags if provided
    if (data.tags && data.tags.length > 0) {
      this.setArticleTags(id, data.tags);
    }

    return this.getArticleById(id)!;
  },

  updateArticle(id: string, updates: Partial<{
    title: string;
    is_read: number;
    is_favorite: number;
    is_archived: number;
    folder_id: string | null;
    tags: string[];
  }>): Article | null {
    const database = getDatabase();
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.is_read !== undefined) {
      fields.push('is_read = ?');
      params.push(updates.is_read);
    }
    if (updates.is_favorite !== undefined) {
      fields.push('is_favorite = ?');
      params.push(updates.is_favorite);
    }
    if (updates.is_archived !== undefined) {
      fields.push('is_archived = ?');
      params.push(updates.is_archived);
    }
    if (updates.folder_id !== undefined) {
      fields.push('folder_id = ?');
      params.push(updates.folder_id);
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      database.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    if (updates.tags !== undefined) {
      this.setArticleTags(id, updates.tags);
    }

    return this.getArticleById(id);
  },

  setArticleTags(articleId: string, tagsInput: string[]): void {
    const database = getDatabase();
    // Clear existing
    database.prepare('DELETE FROM article_tags WHERE article_id = ?').run(articleId);

    for (const item of tagsInput) {
      const trimmed = item.trim().toLowerCase();
      if (!trimmed) continue;

      // Find or create tag
      let tag = database.prepare('SELECT id FROM tags WHERE id = ? OR name = ?').get(trimmed, trimmed) as unknown as { id: string } | undefined;
      if (!tag) {
        const newTagId = 't-' + Math.random().toString(36).substring(2, 9);
        database.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(newTagId, trimmed, '#6366F1');
        tag = { id: newTagId };
      }

      database.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)').run(articleId, tag.id);
    }
  },

  deleteArticle(id: string): void {
    const database = getDatabase();
    database.prepare('DELETE FROM article_tags WHERE article_id = ?').run(id);
    database.prepare('DELETE FROM articles WHERE id = ?').run(id);
  },
};
