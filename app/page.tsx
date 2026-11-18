'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Menu, 
  Search, 
  Plus, 
  Bookmark, 
  Archive, 
  Inbox, 
  RefreshCw, 
  BookOpen, 
  Sparkles,
  X
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ArticleCard } from '@/components/ArticleCard';
import { ReaderView } from '@/components/ReaderView';
import { AddArticleModal } from '@/components/AddArticleModal';
import { LoginView } from '@/components/LoginView';
import { 
  cacheArticlesOffline, 
  getCachedArticlesOffline, 
  updateCachedArticleOffline, 
  deleteCachedArticleOffline 
} from '@/lib/offlineStorage';
import type { Article, Folder, Tag, ArticleFilter } from '@/lib/types';

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentFilter, setCurrentFilter] = useState<ArticleFilter>('inbox');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Monitor online status
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch folders and tags
  const fetchMetadata = useCallback(async () => {
    try {
      const [foldersRes, tagsRes] = await Promise.all([
        fetch('/api/folders').then((r) => r.json()),
        fetch('/api/tags').then((r) => r.json()),
      ]);
      if (foldersRes.success) setFolders(foldersRes.folders);
      if (tagsRes.success) setTags(tagsRes.tags);
    } catch (e) {
      console.warn('Could not fetch folders/tags from server (offline):', e);
    }
  }, []);

  // Fetch articles
  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('filter', currentFilter);
      if (selectedFolderId) params.set('folder_id', selectedFolderId);
      if (selectedTagId) params.set('tag_id', selectedTagId);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/articles?${params.toString()}`);
      if (res.status === 401) {
        const data = await res.json();
        if (data.authRequired) {
          setNeedsAuth(true);
          setIsLoading(false);
          return;
        }
      }
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();

      if (data.success && Array.isArray(data.articles)) {
        setArticles(data.articles);
        setIsOnline(true);
        // Cache to IndexedDB for offline access
        cacheArticlesOffline(data.articles);
      }
    } catch (err) {
      console.warn('Network fetch failed, loading from offline IndexedDB cache...', err);
      setIsOnline(false);
      const cached = await getCachedArticlesOffline({
        filter: currentFilter,
        folder_id: selectedFolderId,
        tag_id: selectedTagId,
        q: searchQuery.trim(),
      });
      setArticles(cached);
    } finally {
      setIsLoading(false);
    }
  }, [currentFilter, selectedFolderId, selectedTagId, searchQuery]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setNeedsAuth(true);
    } catch (e) {
      console.warn('Logout error:', e);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  // Handle open article in Reader View
  const handleOpenArticle = async (article: Article) => {
    // If full content is not in list view, fetch full record
    if (!article.content_html) {
      try {
        const res = await fetch(`/api/articles/${article.id}`);
        const data = await res.json();
        if (data.success) {
          setSelectedArticle(data.article);
          return;
        }
      } catch {
        // use article as is
      }
    }
    setSelectedArticle(article);
  };

  // Toggle favorite
  const handleToggleFavorite = async (article: Article) => {
    const newFav = article.is_favorite === 1 ? 0 : 1;
    // Optimistic update
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, is_favorite: newFav } : a))
    );
    if (selectedArticle && selectedArticle.id === article.id) {
      setSelectedArticle({ ...selectedArticle, is_favorite: newFav });
    }
    updateCachedArticleOffline(article.id, { is_favorite: newFav });

    try {
      await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: newFav }),
      });
      fetchMetadata();
    } catch {
      // Offline fallback already updated IndexedDB
    }
  };

  // Toggle archive
  const handleToggleArchive = async (article: Article) => {
    const newArch = article.is_archived === 1 ? 0 : 1;
    // Optimistic update: if current filter is inbox, remove it from list
    if (currentFilter === 'inbox' && newArch === 1) {
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } else if (currentFilter === 'archive' && newArch === 0) {
      setArticles((prev) => prev.filter((a) => a.id !== article.id));
    } else {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, is_archived: newArch } : a))
      );
    }

    if (selectedArticle && selectedArticle.id === article.id) {
      setSelectedArticle({ ...selectedArticle, is_archived: newArch });
    }
    updateCachedArticleOffline(article.id, { is_archived: newArch });

    try {
      await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: newArch }),
      });
      fetchMetadata();
    } catch {
      // Offline fallback already updated IndexedDB
    }
  };

  // Delete article
  const handleDeleteArticle = async (article: Article) => {
    setArticles((prev) => prev.filter((a) => a.id !== article.id));
    if (selectedArticle && selectedArticle.id === article.id) {
      setSelectedArticle(null);
    }
    deleteCachedArticleOffline(article.id);

    try {
      await fetch(`/api/articles/${article.id}`, { method: 'DELETE' });
      fetchMetadata();
    } catch {
      // Offline fallback
    }
  };

  // Save new article
  const handleSaveArticle = async (url: string, folderId?: string, tagNames?: string[]) => {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, folder_id: folderId, tags: tagNames }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to save article');
    }
    // Refresh list & metadata
    fetchArticles();
    fetchMetadata();
  };

  // Folder & Tag management
  const handleAddFolder = async (name: string, color?: string) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    const data = await res.json();
    if (data.success) {
      fetchMetadata();
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Delete this folder? Articles in this folder will remain in your library.')) return;
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    if (selectedFolderId === id) setSelectedFolderId(undefined);
    fetchMetadata();
    fetchArticles();
  };

  const handleAddTag = async (name: string, color?: string) => {
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    const data = await res.json();
    if (data.success) {
      fetchMetadata();
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    if (selectedTagId === id) setSelectedTagId(undefined);
    fetchMetadata();
    fetchArticles();
  };

  const activeFolder = folders.find((f) => f.id === selectedFolderId);
  const activeTag = tags.find((t) => t.id === selectedTagId);

  // Active filter title
  const viewTitle = useMemo(() => {
    if (activeFolder) return `Folder: ${activeFolder.name}`;
    if (activeTag) return `Tag: #${activeTag.name}`;
    if (currentFilter === 'favorites') return 'Favorites';
    if (currentFilter === 'archive') return 'Archive';
    return 'Inbox';
  }, [currentFilter, activeFolder, activeTag]);

  if (needsAuth) {
    return (
      <LoginView
        onSuccess={() => {
          setNeedsAuth(false);
          fetchArticles();
          fetchMetadata();
        }}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 overflow-hidden font-sans">
      {/* Desktop / Mobile Sidebar */}
      <Sidebar
        currentFilter={currentFilter}
        onSelectFilter={(f) => {
          setCurrentFilter(f);
          setSelectedFolderId(undefined);
          setSelectedTagId(undefined);
        }}
        selectedFolderId={selectedFolderId}
        onSelectFolder={(id) => {
          setSelectedFolderId(id);
          setSelectedTagId(undefined);
        }}
        selectedTagId={selectedTagId}
        onSelectTag={(id) => {
          setSelectedTagId(id);
        }}
        folders={folders}
        tags={tags}
        onAddFolder={handleAddFolder}
        onDeleteFolder={handleDeleteFolder}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isOnline={isOnline}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar with Safe Area Clearance for iOS Status Bar */}
        <header className="pt-safe border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md flex-shrink-0 z-30 transition-all">
          <div className="h-14 sm:h-16 px-3 sm:px-4 md:px-6 flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              {/* Hamburger button for mobile */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0 active:scale-95"
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <h1 className="text-sm sm:text-base md:text-lg font-bold text-white flex items-center gap-1.5 sm:gap-2 truncate min-w-0">
                <span className="truncate">{viewTitle}</span>
                {articles.length > 0 && (
                  <span className="text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 shrink-0">
                    {articles.length}
                  </span>
                )}
              </h1>
            </div>

            {/* Search Bar & Add Button (Optimized for iPhone SE 375px width) */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-32 xs:w-40 sm:w-64 transition-all duration-150 focus-within:w-40 sm:focus-within:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-1.5 sm:py-2 text-base md:text-sm bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white touch-manipulation"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-rose-600/20 transition active:scale-95 shrink-0 min-w-[40px] min-h-[40px] touch-manipulation"
                title="Add URL"
                aria-label="Add URL"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add URL</span>
              </button>
            </div>
          </div>
        </header>

        {/* Active Filter Pills (Horizontal scrollable on small screens) */}
        {(selectedFolderId || selectedTagId || searchQuery) && (
          <div className="px-3 sm:px-4 md:px-6 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="text-slate-400 shrink-0">Filtered:</span>
            {activeFolder && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium shrink-0">
                Folder: {activeFolder.name}
                <button onClick={() => setSelectedFolderId(undefined)} className="hover:text-white p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeTag && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 font-medium shrink-0">
                #{activeTag.name}
                <button onClick={() => setSelectedTagId(undefined)} className="hover:text-white p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium shrink-0">
                Query: "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="hover:text-white p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setSelectedFolderId(undefined);
                setSelectedTagId(undefined);
                setSearchQuery('');
              }}
              className="ml-auto text-slate-400 hover:text-white underline text-[11px] shrink-0 pl-2"
            >
              Clear
            </button>
          </div>
        )}

        {/* Article Cards Grid / Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-6 pb-[calc(var(--sab)+1.5rem)] overscroll-contain">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <p className="text-xs">Loading articles...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center max-w-sm mx-auto px-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
                {currentFilter === 'favorites' ? (
                  <Bookmark className="w-8 h-8 text-amber-400/80" />
                ) : currentFilter === 'archive' ? (
                  <Archive className="w-8 h-8 text-emerald-400/80" />
                ) : (
                  <BookOpen className="w-8 h-8 text-rose-400/80" />
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {currentFilter === 'favorites'
                  ? 'No favorites yet'
                  : currentFilter === 'archive'
                  ? 'Archive is empty'
                  : 'Your inbox is clear'}
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {currentFilter === 'inbox'
                  ? 'Save articles from Firefox on Mac or iPhone, or click "+ Add URL" to save your first read.'
                  : 'Articles you star or archive will appear right here.'}
              </p>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save an Article</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onOpen={handleOpenArticle}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleArchive={handleToggleArchive}
                  onDelete={handleDeleteArticle}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Reader View Modal */}
      {selectedArticle && (
        <ReaderView
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={handleToggleArchive}
        />
      )}

      {/* Add Article Modal */}
      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        folders={folders}
        tags={tags}
        onSave={handleSaveArticle}
      />
    </div>
  );
}
