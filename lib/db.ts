import { createClient, type Client } from '@libsql/client';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import type {
  Article,
  ArticleSourceType,
  ExtractedNewsletterSignals,
  Folder,
  FolderType,
  NewsletterClassificationResult,
  NewsletterRule,
  NewsletterSignalsInput,
  Tag,
  ArticleQueryOptions,
} from './types';
import {
  classifyNewsletterAgainstFolders,
  extractNewsletterSignals,
  pickNewsletterColor,
} from './newsletterClassifier';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'pocketbox.db');

const globalForDb = globalThis as unknown as { dbClient?: Client; schemaReady?: boolean };

function getClient(): Client {
  if (!globalForDb.dbClient) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl) {
      console.log('[DB] Connecting to Turso Cloud Database:', tursoUrl);
      globalForDb.dbClient = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      });
    } else {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      console.log('[DB] Connecting to local SQLite file:', DB_PATH);
      globalForDb.dbClient = createClient({
        url: `file:${DB_PATH}`,
      });
    }
  }
  return globalForDb.dbClient;
}

async function ensureSchema(client: Client): Promise<void> {
  if (globalForDb.schemaReady) return;

  await client.batch([
    `CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366F1',
      folder_type TEXT NOT NULL DEFAULT 'article',
      created_at TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS newsletter_rules (
      id TEXT PRIMARY KEY,
      folder_id TEXT NOT NULL,
      sender_email TEXT,
      sender_domain TEXT,
      sender_name TEXT,
      subject_prefix TEXT,
      masthead TEXT,
      utm_campaign TEXT,
      web_host TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      color TEXT NOT NULL DEFAULT '#10B981'
    );`,
    `CREATE TABLE IF NOT EXISTS articles (
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
      source_type TEXT NOT NULL DEFAULT 'article',
      folder_id TEXT,
      share_token TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );`,
    `CREATE TABLE IF NOT EXISTS article_tags (
      article_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (article_id, tag_id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(is_archived, is_favorite, is_read);`,
    `CREATE INDEX IF NOT EXISTS idx_articles_folder ON articles(folder_id);`,
    `CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_newsletter_rules_folder ON newsletter_rules(folder_id);`,
  ], 'write');

  // Idempotent migrations for existing databases: ensure source_type on articles and folder_type on folders exist
  try {
    const tableInfo = await client.execute('PRAGMA table_info(articles)');
    const hasSourceType = tableInfo.rows.some(
      (col) => String(col.name).toLowerCase() === 'source_type'
    );
    if (!hasSourceType) {
      await client.execute(
        "ALTER TABLE articles ADD COLUMN source_type TEXT NOT NULL DEFAULT 'article'"
      );
    }
    await client.execute(
      'CREATE INDEX IF NOT EXISTS idx_articles_source_type ON articles(source_type, is_archived)'
    );
  } catch (migErr) {
    console.warn('[DB] source_type migration notice:', migErr);
  }

  try {
    const tableInfo = await client.execute('PRAGMA table_info(articles)');
    const hasShareToken = tableInfo.rows.some(
      (col) => String(col.name).toLowerCase() === 'share_token'
    );
    if (!hasShareToken) {
      await client.execute('ALTER TABLE articles ADD COLUMN share_token TEXT');
    }
    await client.execute(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_share_token ON articles(share_token)'
    );
  } catch (shareMigErr) {
    console.warn('[DB] share_token migration notice:', shareMigErr);
  }

  try {
    const folderTableInfo = await client.execute('PRAGMA table_info(folders)');
    const hasFolderType = folderTableInfo.rows.some(
      (col) => String(col.name).toLowerCase() === 'folder_type'
    );
    if (!hasFolderType) {
      await client.execute(
        "ALTER TABLE folders ADD COLUMN folder_type TEXT NOT NULL DEFAULT 'article'"
      );
    }
  } catch (folderMigErr) {
    console.warn('[DB] folder_type migration notice:', folderMigErr);
  }

  try {
    const folderRes = await client.execute('SELECT COUNT(*) as count FROM folders');
    const folderCount = Number(folderRes.rows[0]?.count ?? 0);
    if (folderCount === 0) {
      const now = new Date().toISOString();
      await client.batch([
        { sql: 'INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)', args: ['f-tech', 'Technology', '#3B82F6', now] },
        { sql: 'INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)', args: ['f-work', 'Work', '#10B981', now] },
        { sql: 'INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)', args: ['f-long', 'Long Reads', '#8B5CF6', now] },
        { sql: 'INSERT INTO folders (id, name, color, created_at) VALUES (?, ?, ?, ?)', args: ['f-pers', 'Personal', '#F59E0B', now] },
        { sql: 'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', args: ['t-must', 'must-read', '#EF4444'] },
        { sql: 'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', args: ['t-quick', 'quick', '#10B981'] },
        { sql: 'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', args: ['t-ref', 'reference', '#6366F1'] },
      ], 'write');
    }
  } catch (seedErr) {
    console.warn('[DB] Seed check notice:', seedErr);
  }

  globalForDb.schemaReady = true;
}

export const db = {
  async getFolders(folderType?: FolderType): Promise<Folder[]> {
    const client = getClient();
    await ensureSchema(client);
    const whereClause = folderType ? 'WHERE f.folder_type = ?' : '';
    const args = folderType ? [folderType] : [];
    const rs = await client.execute({
      sql: `
        SELECT f.*, COUNT(a.id) as article_count
        FROM folders f
        LEFT JOIN articles a ON a.folder_id = f.id AND a.is_archived = 0
        ${whereClause}
        GROUP BY f.id
        ORDER BY f.name ASC
      `,
      args,
    });
    return rs.rows.map(row => ({
      id: String(row.id),
      name: String(row.name),
      color: String(row.color || '#6366F1'),
      folder_type: (row.folder_type === 'newsletter' ? 'newsletter' : 'article') as FolderType,
      created_at: String(row.created_at || ''),
      article_count: Number(row.article_count || 0),
    }));
  },

  async getFolderById(id: string): Promise<Folder | null> {
    const client = getClient();
    await ensureSchema(client);
    const rs = await client.execute({
      sql: 'SELECT * FROM folders WHERE id = ?',
      args: [id],
    });
    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];
    return {
      id: String(row.id),
      name: String(row.name),
      color: String(row.color || '#6366F1'),
      folder_type: (row.folder_type === 'newsletter' ? 'newsletter' : 'article') as FolderType,
      created_at: String(row.created_at || ''),
    };
  },

  async getFolderByName(name: string): Promise<Folder | null> {
    const client = getClient();
    await ensureSchema(client);
    const trimmed = name.trim();
    if (!trimmed) return null;
    const rs = await client.execute({
      sql: 'SELECT * FROM folders WHERE LOWER(name) = LOWER(?) LIMIT 1',
      args: [trimmed],
    });
    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];
    return {
      id: String(row.id),
      name: String(row.name),
      color: String(row.color || '#6366F1'),
      folder_type: (row.folder_type === 'newsletter' ? 'newsletter' : 'article') as FolderType,
      created_at: String(row.created_at || ''),
    };
  },

  async createFolder(
    name: string,
    color: string = '#6366F1',
    folderType: FolderType = 'article'
  ): Promise<Folder> {
    const client = getClient();
    await ensureSchema(client);
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Folder name is required');
    }
    const normalizedType: FolderType = folderType === 'newsletter' ? 'newsletter' : 'article';
    const id = 'f-' + Math.random().toString(36).substring(2, 9);
    const created_at = new Date().toISOString();
    await client.execute({
      sql: 'INSERT INTO folders (id, name, color, folder_type, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, trimmed, color, normalizedType, created_at],
    });
    return {
      id,
      name: trimmed,
      color,
      folder_type: normalizedType,
      created_at,
      article_count: 0,
    };
  },

  async updateFolder(
    id: string,
    updates: Partial<{ name: string; color: string; folder_type: FolderType }>
  ): Promise<Folder | null> {
    const client = getClient();
    await ensureSchema(client);
    const fields: string[] = [];
    const args: (string | number | null)[] = [];

    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error('Folder name is required');
      fields.push('name = ?');
      args.push(trimmed);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      args.push(updates.color);
    }
    if (updates.folder_type !== undefined) {
      fields.push('folder_type = ?');
      args.push(updates.folder_type === 'newsletter' ? 'newsletter' : 'article');
    }

    if (fields.length > 0) {
      args.push(id);
      await client.execute({
        sql: `UPDATE folders SET ${fields.join(', ')} WHERE id = ?`,
        args,
      });
    }

    return this.getFolderById(id);
  },

  async findOrCreateNewsletterFolder(name: string, color?: string): Promise<Folder> {
    const client = getClient();
    await ensureSchema(client);
    const trimmed = name.trim() || 'Newsletter';
    const chosenColor = color || pickNewsletterColor(trimmed);

    const existing = await this.getFolderByName(trimmed);
    if (existing) {
      if (existing.folder_type === 'newsletter') {
        return existing;
      }
      // If it's a custom folder (not one of the 4 seeded default article folders), promote it to newsletter
      const SEEDED_IDS = new Set(['f-tech', 'f-work', 'f-long', 'f-pers']);
      if (!SEEDED_IDS.has(existing.id)) {
        const promoted = await this.updateFolder(existing.id, { folder_type: 'newsletter' });
        return promoted || existing;
      }
      // If it collided with a seeded default folder name (e.g. "Technology"), disambiguate
      const disambiguatedName = `${trimmed} (Newsletter)`;
      const existingDisambiguated = await this.getFolderByName(disambiguatedName);
      if (existingDisambiguated) return existingDisambiguated;
      return this.createFolder(disambiguatedName, chosenColor, 'newsletter');
    }

    return this.createFolder(trimmed, chosenColor, 'newsletter');
  },

  async getNewsletterRules(): Promise<NewsletterRule[]> {
    const client = getClient();
    await ensureSchema(client);
    const rs = await client.execute(`
      SELECT r.*
      FROM newsletter_rules r
      JOIN folders f ON f.id = r.folder_id
      ORDER BY r.updated_at DESC
    `);
    return rs.rows.map((row) => ({
      id: String(row.id),
      folder_id: String(row.folder_id),
      sender_email: row.sender_email ? String(row.sender_email) : null,
      sender_domain: row.sender_domain ? String(row.sender_domain) : null,
      sender_name: row.sender_name ? String(row.sender_name) : null,
      subject_prefix: row.subject_prefix ? String(row.subject_prefix) : null,
      masthead: row.masthead ? String(row.masthead) : null,
      utm_campaign: row.utm_campaign ? String(row.utm_campaign) : null,
      web_host: row.web_host ? String(row.web_host) : null,
      updated_at: String(row.updated_at || ''),
    }));
  },

  async recordNewsletterRule(
    folderId: string,
    signals: ExtractedNewsletterSignals
  ): Promise<void> {
    const client = getClient();
    await ensureSchema(client);

    const senderEmail = signals.senderEmail || null;
    const senderDomain = signals.senderDomain || null;
    const senderName = signals.senderPublicationName || null;
    const subjectPrefix = signals.subjectPrefix || signals.subjectSeriesName || null;
    const masthead = signals.masthead || signals.logoAlt || signals.footerSeries || null;
    const utmCampaign = signals.utmCampaign || null;
    const webHost = signals.webHost || null;

    if (
      !senderEmail &&
      !senderDomain &&
      !senderName &&
      !subjectPrefix &&
      !masthead &&
      !utmCampaign &&
      !webHost
    ) {
      return;
    }

    const now = new Date().toISOString();

    // Check if an equivalent rule already exists for this folder
    const existingRs = await client.execute({
      sql: `
        SELECT id FROM newsletter_rules
        WHERE folder_id = ?
          AND COALESCE(sender_email, '') = ?
          AND COALESCE(sender_name, '') = ?
          AND COALESCE(subject_prefix, '') = ?
          AND COALESCE(masthead, '') = ?
        LIMIT 1
      `,
      args: [
        folderId,
        senderEmail || '',
        senderName || '',
        subjectPrefix || '',
        masthead || '',
      ],
    });

    if (existingRs.rows.length > 0) {
      await client.execute({
        sql: `
          UPDATE newsletter_rules
          SET sender_domain = COALESCE(?, sender_domain),
              utm_campaign = COALESCE(?, utm_campaign),
              web_host = COALESCE(?, web_host),
              updated_at = ?
          WHERE id = ?
        `,
        args: [
          senderDomain,
          utmCampaign,
          webHost,
          now,
          String(existingRs.rows[0].id),
        ],
      });
      return;
    }

    const id = 'nr-' + Math.random().toString(36).substring(2, 10);
    await client.execute({
      sql: `
        INSERT INTO newsletter_rules (
          id, folder_id, sender_email, sender_domain, sender_name,
          subject_prefix, masthead, utm_campaign, web_host, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        folderId,
        senderEmail,
        senderDomain,
        senderName,
        subjectPrefix,
        masthead,
        utmCampaign,
        webHost,
        now,
      ],
    });
  },

  async classifyNewsletter(
    input: NewsletterSignalsInput
  ): Promise<NewsletterClassificationResult> {
    const client = getClient();
    await ensureSchema(client);
    const [newsletterFolders, rules] = await Promise.all([
      this.getFolders('newsletter'),
      this.getNewsletterRules(),
    ]);
    return classifyNewsletterAgainstFolders(input, newsletterFolders, rules);
  },

  async resolveAutoNewsletterFolder(
    input: NewsletterSignalsInput,
    options?: {
      explicitFolderId?: string | null;
      explicitFolderName?: string | null;
      disableAuto?: boolean;
    }
  ): Promise<Folder | null> {
    const client = getClient();
    await ensureSchema(client);

    if (options?.disableAuto) {
      return null;
    }

    const signals = extractNewsletterSignals(input);

    // 1. User explicitly chose an existing folder ID
    if (options?.explicitFolderId) {
      const folder = await this.getFolderById(options.explicitFolderId);
      if (folder) {
        const SEEDED_IDS = new Set(['f-tech', 'f-work', 'f-long', 'f-pers']);
        if (folder.folder_type !== 'newsletter' && !SEEDED_IDS.has(folder.id)) {
          await this.updateFolder(folder.id, { folder_type: 'newsletter' });
        }
        await this.recordNewsletterRule(folder.id, signals);
        return folder;
      }
    }

    // 2. User confirmed or customized a new newsletter folder name in the popup
    if (options?.explicitFolderName && options.explicitFolderName.trim()) {
      const folder = await this.findOrCreateNewsletterFolder(options.explicitFolderName.trim());
      await this.recordNewsletterRule(folder.id, signals);
      return folder;
    }

    // 3. Automatic multi-indicator classification & folder creation
    const classification = await this.classifyNewsletter(input);
    const targetFolder =
      classification.matchedFolder ||
      (await this.findOrCreateNewsletterFolder(
        classification.suggestedFolderName,
        classification.suggestedColor
      ));

    await this.recordNewsletterRule(targetFolder.id, classification.signals);
    return targetFolder;
  },

  async learnNewsletterFolderFromArticle(
    article: Article,
    targetFolderId: string | null
  ): Promise<void> {
    if (!targetFolderId || article.source_type !== 'newsletter') return;
    const folder = await this.getFolderById(targetFolderId);
    if (!folder) return;

    const SEEDED_IDS = new Set(['f-tech', 'f-work', 'f-long', 'f-pers']);
    if (folder.folder_type !== 'newsletter' && !SEEDED_IDS.has(folder.id)) {
      await this.updateFolder(folder.id, { folder_type: 'newsletter' });
    }

    const signals = extractNewsletterSignals({
      title: article.title,
      siteName: article.site_name,
      byline: article.byline,
      url: article.url,
      html: article.content_html,
    });
    await this.recordNewsletterRule(folder.id, signals);
  },

  async deleteFolder(id: string): Promise<void> {
    const client = getClient();
    await ensureSchema(client);
    await client.batch([
      { sql: 'DELETE FROM newsletter_rules WHERE folder_id = ?', args: [id] },
      { sql: 'DELETE FROM folders WHERE id = ?', args: [id] },
    ], 'write');
  },

  async getTags(): Promise<Tag[]> {
    const client = getClient();
    await ensureSchema(client);
    const rs = await client.execute(`
      SELECT t.*, COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON at.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name ASC
    `);
    return rs.rows.map(row => ({
      id: String(row.id),
      name: String(row.name),
      color: String(row.color || '#10B981'),
      article_count: Number(row.article_count || 0),
    }));
  },

  async createTag(name: string, color: string = '#10B981'): Promise<Tag> {
    const client = getClient();
    await ensureSchema(client);
    const normalizedName = name.trim().replace(/^#+/, '').trim().toLowerCase();
    const id = 't-' + Math.random().toString(36).substring(2, 9);
    await client.execute({
      sql: 'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
      args: [id, normalizedName, color],
    });
    return { id, name: normalizedName, color, article_count: 0 };
  },

  async deleteTag(id: string): Promise<void> {
    const client = getClient();
    await ensureSchema(client);
    await client.execute({
      sql: 'DELETE FROM tags WHERE id = ?',
      args: [id],
    });
  },

  async getArticles(options: ArticleQueryOptions = {}): Promise<Article[]> {
    const client = getClient();
    await ensureSchema(client);
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.filter === 'archive') {
      conditions.push('a.is_archived = 1');
    } else if (options.filter === 'favorites') {
      conditions.push('a.is_favorite = 1');
    } else if (options.filter === 'newsletters') {
      conditions.push("a.source_type = 'newsletter' AND a.is_archived = 0");
    } else {
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
        a.id, a.url, a.title, a.byline, a.excerpt, a.content_html, a.text_content, a.site_name,
        a.lead_image_url, a.reading_time_minutes, a.source_type, a.folder_id, a.share_token,
        a.is_read, a.is_favorite, a.is_archived, a.created_at, a.updated_at,
        f.name as folder_name, f.color as folder_color, f.folder_type as folder_type
      FROM articles a
      LEFT JOIN folders f ON f.id = a.folder_id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;

    const rs = await client.execute({ sql: query, args: params });
    if (rs.rows.length === 0) return [];

    const articleIds = rs.rows.map(r => String(r.id));
    const placeholders = articleIds.map(() => '?').join(',');
    const tagRs = await client.execute({
      sql: `
        SELECT at.article_id, t.id, t.name, t.color
        FROM tags t
        JOIN article_tags at ON at.tag_id = t.id
        WHERE at.article_id IN (${placeholders})
      `,
      args: articleIds,
    });

    const tagsByArticle = new Map<string, Tag[]>();
    for (const tRow of tagRs.rows) {
      const artId = String(tRow.article_id);
      if (!tagsByArticle.has(artId)) {
        tagsByArticle.set(artId, []);
      }
      tagsByArticle.get(artId)!.push({
        id: String(tRow.id),
        name: String(tRow.name),
        color: String(tRow.color || '#10B981'),
      });
    }

    return rs.rows.map(row => {
      const folder = row.folder_id && row.folder_name
        ? {
            id: String(row.folder_id),
            name: String(row.folder_name),
            color: String(row.folder_color || '#6366F1'),
            folder_type: (row.folder_type === 'newsletter' ? 'newsletter' : 'article') as FolderType,
            created_at: '',
          }
        : null;

      return {
        id: String(row.id),
        url: String(row.url),
        title: String(row.title),
        byline: row.byline ? String(row.byline) : null,
        excerpt: row.excerpt ? String(row.excerpt) : null,
        content_html: row.content_html ? String(row.content_html) : null,
        text_content: row.text_content ? String(row.text_content) : null,
        site_name: row.site_name ? String(row.site_name) : null,
        lead_image_url: row.lead_image_url ? String(row.lead_image_url) : null,
        reading_time_minutes: Number(row.reading_time_minutes || 1),
        source_type: (row.source_type === 'newsletter' ? 'newsletter' : 'article') as ArticleSourceType,
        folder_id: row.folder_id ? String(row.folder_id) : null,
        share_token: row.share_token ? String(row.share_token) : null,
        is_read: Number(row.is_read || 0),
        is_favorite: Number(row.is_favorite || 0),
        is_archived: Number(row.is_archived || 0),
        created_at: String(row.created_at || ''),
        updated_at: String(row.updated_at || ''),
        folder,
        tags: tagsByArticle.get(String(row.id)) || [],
      };
    });
  },

  async getArticleById(id: string): Promise<Article | null> {
    const client = getClient();
    await ensureSchema(client);
    const rs = await client.execute({
      sql: `
        SELECT 
          a.*,
          f.name as folder_name, f.color as folder_color, f.folder_type as folder_type
        FROM articles a
        LEFT JOIN folders f ON f.id = a.folder_id
        WHERE a.id = ?
      `,
      args: [id],
    });

    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];

    const folder = row.folder_id && row.folder_name
      ? {
          id: String(row.folder_id),
          name: String(row.folder_name),
          color: String(row.folder_color || '#6366F1'),
          folder_type: (row.folder_type === 'newsletter' ? 'newsletter' : 'article') as FolderType,
          created_at: '',
        }
      : null;

    const tagRs = await client.execute({
      sql: `
        SELECT t.id, t.name, t.color
        FROM tags t
        JOIN article_tags at ON at.tag_id = t.id
        WHERE at.article_id = ?
      `,
      args: [id],
    });

    const tags: Tag[] = tagRs.rows.map(t => ({
      id: String(t.id),
      name: String(t.name),
      color: String(t.color || '#10B981'),
    }));

    return {
      id: String(row.id),
      url: String(row.url),
      title: String(row.title),
      byline: row.byline ? String(row.byline) : null,
      excerpt: row.excerpt ? String(row.excerpt) : null,
      content_html: row.content_html ? String(row.content_html) : null,
      text_content: row.text_content ? String(row.text_content) : null,
      site_name: row.site_name ? String(row.site_name) : null,
      lead_image_url: row.lead_image_url ? String(row.lead_image_url) : null,
      reading_time_minutes: Number(row.reading_time_minutes || 1),
      source_type: (row.source_type === 'newsletter' ? 'newsletter' : 'article') as ArticleSourceType,
      folder_id: row.folder_id ? String(row.folder_id) : null,
      share_token: row.share_token ? String(row.share_token) : null,
      is_read: Number(row.is_read || 0),
      is_favorite: Number(row.is_favorite || 0),
      is_archived: Number(row.is_archived || 0),
      created_at: String(row.created_at || ''),
      updated_at: String(row.updated_at || ''),
      folder,
      tags,
    };
  },

  async getArticleByShareToken(token: string): Promise<Article | null> {
    const client = getClient();
    await ensureSchema(client);
    const trimmed = token.trim();
    if (!trimmed) return null;

    const rs = await client.execute({
      sql: `
        SELECT
          id, url, title, byline, excerpt, content_html, text_content, site_name,
          lead_image_url, reading_time_minutes, source_type, share_token,
          is_read, is_favorite, is_archived, created_at, updated_at
        FROM articles
        WHERE share_token = ?
        LIMIT 1
      `,
      args: [trimmed],
    });

    if (rs.rows.length === 0) return null;
    const row = rs.rows[0];

    return {
      id: String(row.id),
      url: String(row.url),
      title: String(row.title),
      byline: row.byline ? String(row.byline) : null,
      excerpt: row.excerpt ? String(row.excerpt) : null,
      content_html: row.content_html ? String(row.content_html) : null,
      text_content: row.text_content ? String(row.text_content) : null,
      site_name: row.site_name ? String(row.site_name) : null,
      lead_image_url: row.lead_image_url ? String(row.lead_image_url) : null,
      reading_time_minutes: Number(row.reading_time_minutes || 1),
      source_type: (row.source_type === 'newsletter' ? 'newsletter' : 'article') as ArticleSourceType,
      folder_id: null,
      share_token: row.share_token ? String(row.share_token) : null,
      is_read: Number(row.is_read || 0),
      is_favorite: Number(row.is_favorite || 0),
      is_archived: Number(row.is_archived || 0),
      created_at: String(row.created_at || ''),
      updated_at: String(row.updated_at || ''),
    };
  },

  async createOrGetShareToken(id: string): Promise<string | null> {
    const client = getClient();
    await ensureSchema(client);

    const existing = await client.execute({
      sql: 'SELECT id, share_token FROM articles WHERE id = ? LIMIT 1',
      args: [id],
    });
    if (existing.rows.length === 0) return null;

    const currentToken = existing.rows[0].share_token
      ? String(existing.rows[0].share_token).trim()
      : '';
    if (currentToken) return currentToken;

    const newToken = crypto.randomBytes(16).toString('base64url');
    const now = new Date().toISOString();

    await client.execute({
      sql: 'UPDATE articles SET share_token = ?, updated_at = ? WHERE id = ? AND share_token IS NULL',
      args: [newToken, now, id],
    });

    const refreshed = await client.execute({
      sql: 'SELECT share_token FROM articles WHERE id = ? LIMIT 1',
      args: [id],
    });
    const finalToken = refreshed.rows[0]?.share_token
      ? String(refreshed.rows[0].share_token).trim()
      : '';
    return finalToken || newToken;
  },

  async getArticleByUrl(url: string): Promise<Article | null> {
    const client = getClient();
    await ensureSchema(client);
    const rs = await client.execute({
      sql: 'SELECT id FROM articles WHERE url = ?',
      args: [url],
    });
    if (rs.rows.length === 0) return null;
    return this.getArticleById(String(rs.rows[0].id));
  },

  async createArticle(data: {
    url: string;
    title: string;
    byline?: string | null;
    excerpt?: string | null;
    content_html?: string | null;
    text_content?: string | null;
    site_name?: string | null;
    lead_image_url?: string | null;
    reading_time_minutes?: number;
    source_type?: ArticleSourceType;
    folder_id?: string | null;
    tags?: string[];
  }): Promise<Article> {
    const client = getClient();
    await ensureSchema(client);
    const id = 'art_' + Math.random().toString(36).substring(2, 10);
    const now = new Date().toISOString();
    const sourceType: ArticleSourceType =
      data.source_type === 'newsletter' ? 'newsletter' : 'article';

    await client.execute({
      sql: `
        INSERT INTO articles (
          id, url, title, byline, excerpt, content_html, text_content,
          site_name, lead_image_url, reading_time_minutes, source_type, folder_id,
          is_read, is_favorite, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)
      `,
      args: [
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
        sourceType,
        data.folder_id || null,
        now,
        now,
      ],
    });

    if (data.tags && data.tags.length > 0) {
      await this.setArticleTags(id, data.tags);
    }

    const created = await this.getArticleById(id);
    return created!;
  },

  async updateArticle(id: string, updates: Partial<{
    title: string;
    byline: string | null;
    excerpt: string | null;
    content_html: string | null;
    text_content: string | null;
    site_name: string | null;
    lead_image_url: string | null;
    reading_time_minutes: number;
    source_type: ArticleSourceType;
    is_read: number;
    is_favorite: number;
    is_archived: number;
    folder_id: string | null;
    tags: string[];
  }>): Promise<Article | null> {
    const client = getClient();
    await ensureSchema(client);
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      params.push(updates.title);
    }
    if (updates.byline !== undefined) {
      fields.push('byline = ?');
      params.push(updates.byline);
    }
    if (updates.excerpt !== undefined) {
      fields.push('excerpt = ?');
      params.push(updates.excerpt);
    }
    if (updates.content_html !== undefined) {
      fields.push('content_html = ?');
      params.push(updates.content_html);
    }
    if (updates.text_content !== undefined) {
      fields.push('text_content = ?');
      params.push(updates.text_content);
    }
    if (updates.site_name !== undefined) {
      fields.push('site_name = ?');
      params.push(updates.site_name);
    }
    if (updates.lead_image_url !== undefined) {
      fields.push('lead_image_url = ?');
      params.push(updates.lead_image_url);
    }
    if (updates.reading_time_minutes !== undefined) {
      fields.push('reading_time_minutes = ?');
      params.push(updates.reading_time_minutes);
    }
    if (updates.source_type !== undefined) {
      fields.push('source_type = ?');
      params.push(updates.source_type === 'newsletter' ? 'newsletter' : 'article');
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
      params.push(updates.folder_id || null);
    }

    if (fields.length > 0 || updates.tags !== undefined) {
      fields.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id);
      await client.execute({
        sql: `UPDATE articles SET ${fields.join(', ')} WHERE id = ?`,
        args: params,
      });
    }

    if (updates.tags !== undefined) {
      await this.setArticleTags(id, updates.tags);
    }

    return this.getArticleById(id);
  },

  async setArticleTags(articleId: string, tagsInput: string[]): Promise<void> {
    const client = getClient();
    await ensureSchema(client);
    await client.execute({
      sql: 'DELETE FROM article_tags WHERE article_id = ?',
      args: [articleId],
    });

    if (!Array.isArray(tagsInput)) return;

    const seen = new Set<string>();
    for (const item of tagsInput) {
      if (typeof item !== 'string') continue;
      const trimmed = item.trim().replace(/^#+/, '').trim().toLowerCase();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);

      const tagRs = await client.execute({
        sql: 'SELECT id FROM tags WHERE id = ? OR name = ?',
        args: [trimmed, trimmed],
      });

      let tagId = tagRs.rows[0]?.id ? String(tagRs.rows[0].id) : null;
      if (!tagId) {
        tagId = 't-' + Math.random().toString(36).substring(2, 9);
        await client.execute({
          sql: 'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
          args: [tagId, trimmed, '#6366F1'],
        });
      }

      await client.execute({
        sql: 'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)',
        args: [articleId, tagId],
      });
    }
  },

  async deleteArticle(id: string): Promise<void> {
    const client = getClient();
    await ensureSchema(client);
    await client.batch([
      { sql: 'DELETE FROM article_tags WHERE article_id = ?', args: [id] },
      { sql: 'DELETE FROM articles WHERE id = ?', args: [id] },
    ], 'write');
  },
};
