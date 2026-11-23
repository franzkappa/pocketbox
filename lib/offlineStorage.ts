import { Article, ArticleFilter } from './types';

const DB_NAME = 'pocketbox_offline';
const DB_VERSION = 1;
const STORE_NAME = 'articles';

function getIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('is_archived', 'is_archived', { unique: false });
        store.createIndex('is_favorite', 'is_favorite', { unique: false });
        store.createIndex('folder_id', 'folder_id', { unique: false });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function cacheArticlesOffline(articles: Article[]): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const article of articles) {
      store.put(article);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not cache articles to IndexedDB:', err);
  }
}

export async function getCachedArticlesOffline(options: {
  filter?: ArticleFilter;
  folder_id?: string;
  tag_id?: string;
  q?: string;
} = {}): Promise<Article[]> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve) => {
      request.onsuccess = () => {
        let results: Article[] = request.result || [];

        // Apply filter
        if (options.filter === 'archive') {
          results = results.filter((a) => a.is_archived === 1);
        } else if (options.filter === 'favorites') {
          results = results.filter((a) => a.is_favorite === 1);
        } else if (options.filter === 'newsletters') {
          results = results.filter((a) => a.source_type === 'newsletter' && a.is_archived === 0);
        } else {
          // inbox
          results = results.filter((a) => a.is_archived === 0);
        }

        // Apply folder
        if (options.folder_id) {
          results = results.filter((a) => a.folder_id === options.folder_id);
        }

        // Apply tag
        if (options.tag_id) {
          results = results.filter((a) => a.tags?.some((t) => t.id === options.tag_id || t.name === options.tag_id));
        }

        // Apply search query
        if (options.q && options.q.trim()) {
          const term = options.q.toLowerCase().trim();
          results = results.filter(
            (a) =>
              a.title.toLowerCase().includes(term) ||
              (a.excerpt && a.excerpt.toLowerCase().includes(term)) ||
              (a.site_name && a.site_name.toLowerCase().includes(term))
          );
        }

        // Sort descending by created_at
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        resolve(results);
      };
      request.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function getCachedArticleOffline(id: string): Promise<Article | null> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function updateCachedArticleOffline(id: string, updates: Partial<Article>): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result) {
        const updated = { ...request.result, ...updates, updated_at: new Date().toISOString() };
        store.put(updated);
      }
    };
  } catch (err) {
    console.warn('Could not update article in IndexedDB:', err);
  }
}

export async function deleteCachedArticleOffline(id: string): Promise<void> {
  try {
    const db = await getIndexedDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Could not delete article from IndexedDB:', err);
  }
}
