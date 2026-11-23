'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Menu, 
  Search, 
  Plus, 
  Bookmark, 
  Archive, 
  Inbox, 
  Mail,
  RefreshCw, 
  BookOpen, 
  Sparkles,
  X
} from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { ArticleCard } from '@/components/ArticleCard';
import { ReaderView } from '@/components/ReaderView';
import { AddArticleModal } from '@/components/AddArticleModal';
import { ArticleTagsModal } from '@/components/ArticleTagsModal';
import { ArticleFolderModal } from '@/components/ArticleFolderModal';
import { LoginView } from '@/components/LoginView';
import { PullToRefresh } from '@/components/PullToRefresh';
import { 
  cacheArticlesOffline, 
  getCachedArticlesOffline, 
  updateCachedArticleOffline, 
  deleteCachedArticleOffline 
} from '@/lib/offlineStorage';
import type { Article, Folder, FolderType, Tag, ArticleFilter } from '@/lib/types';

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentFilter, setCurrentFilter] = useState<ArticleFilter>('inbox');
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [editingTagsArticle, setEditingTagsArticle] = useState<Article | null>(null);
  const [editingFolderArticle, setEditingFolderArticle] = useState<Article | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const fetchArticles = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
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

  // Unified reload handler for both Pull-To-Refresh and Header Refresh button
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const start = Date.now();
    try {
      await Promise.all([fetchArticles(true), fetchMetadata()]);
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      // Ensure smooth visual rotation feedback (at least 450ms)
      const elapsed = Date.now() - start;
      if (elapsed < 450) {
        await new Promise((resolve) => setTimeout(resolve, 450 - elapsed));
      }
      setIsRefreshing(false);
    }
  }, [fetchArticles, fetchMetadata, isRefreshing]);

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
    // Optimistic update: if current filter is inbox or newsletters, remove it from list when archived
    if ((currentFilter === 'inbox' || currentFilter === 'newsletters') && newArch === 1) {
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

  // Update article tags (add/remove tags on saved articles)
  const handleUpdateArticleTags = async (article: Article, tagNames: string[]) => {
    const normalized = Array.from(
      new Set(
        tagNames
          .map((t) => t.trim().replace(/^#+/, '').trim().toLowerCase())
          .filter(Boolean)
      )
    );

    const optimisticTags: Tag[] = normalized.map((name) => {
      const existing =
        tags.find((t) => t.name.toLowerCase() === name) ||
        article.tags?.find((t) => t.name.toLowerCase() === name);
      return existing || { id: `temp-${name}`, name, color: '#6366F1' };
    });

    const applyArticleTags = (updatedTags: Tag[]) => {
      const stillMatchesActiveTag =
        !selectedTagId || updatedTags.some((t) => t.id === selectedTagId);

      if (!stillMatchesActiveTag) {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
      } else {
        setArticles((prev) => {
          const exists = prev.some((a) => a.id === article.id);
          if (exists) {
            return prev.map((a) => (a.id === article.id ? { ...a, tags: updatedTags } : a));
          }
          return [{ ...article, tags: updatedTags }, ...prev];
        });
      }

      setSelectedArticle((prev) =>
        prev && prev.id === article.id ? { ...prev, tags: updatedTags } : prev
      );
      updateCachedArticleOffline(article.id, { tags: updatedTags });
    };

    applyArticleTags(optimisticTags);

    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: normalized }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.authRequired) {
          setNeedsAuth(true);
          return;
        }
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        fetchArticles(true);
        throw new Error(data.error || 'Failed to update tags');
      }

      if (data.article && Array.isArray(data.article.tags)) {
        applyArticleTags(data.article.tags);
      }
      fetchMetadata();
    } catch (err: any) {
      if (err instanceof TypeError || !navigator.onLine) {
        // Offline fallback already updated IndexedDB
        return;
      }
      throw err;
    }
  };

  // Quick remove a single tag from an article (used in ReaderView pills)
  const handleRemoveSingleTag = async (article: Article, tagName: string) => {
    const remaining = (article.tags || [])
      .map((t) => t.name)
      .filter((name) => name.toLowerCase() !== tagName.toLowerCase());
    try {
      await handleUpdateArticleTags(article, remaining);
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  // Update article folder (move saved article to another folder or remove from folder)
  const handleUpdateArticleFolder = async (
    article: Article,
    folderId: string | null,
    folderHint?: Folder | null
  ) => {
    const normalizedFolderId = folderId && folderId.trim() ? folderId.trim() : null;
    const optimisticFolder: Folder | null = normalizedFolderId
      ? folderHint || folders.find((f) => f.id === normalizedFolderId) || null
      : null;

    const applyArticleFolder = (updatedFolderId: string | null, updatedFolder: Folder | null) => {
      const stillMatchesActiveFolder =
        !selectedFolderId || updatedFolderId === selectedFolderId;

      if (!stillMatchesActiveFolder) {
        setArticles((prev) => prev.filter((a) => a.id !== article.id));
      } else {
        setArticles((prev) => {
          const exists = prev.some((a) => a.id === article.id);
          if (exists) {
            return prev.map((a) =>
              a.id === article.id
                ? { ...a, folder_id: updatedFolderId, folder: updatedFolder }
                : a
            );
          }
          return [
            { ...article, folder_id: updatedFolderId, folder: updatedFolder },
            ...prev,
          ];
        });
      }

      setSelectedArticle((prev) =>
        prev && prev.id === article.id
          ? { ...prev, folder_id: updatedFolderId, folder: updatedFolder }
          : prev
      );
      updateCachedArticleOffline(article.id, {
        folder_id: updatedFolderId,
        folder: updatedFolder,
      });
    };

    const previousFolderId = article.folder_id ?? null;
    const previousFolder = article.folder ?? null;

    applyArticleFolder(normalizedFolderId, optimisticFolder);

    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: normalizedFolderId }),
      });

      if (res.status === 401) {
        const data = await res.json();
        if (data.authRequired) {
          setNeedsAuth(true);
          return;
        }
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        applyArticleFolder(previousFolderId, previousFolder);
        fetchArticles(true);
        throw new Error(data.error || 'Failed to update folder');
      }

      if (data.article) {
        applyArticleFolder(data.article.folder_id ?? null, data.article.folder ?? null);
      }
      fetchMetadata();
    } catch (err: any) {
      if (err instanceof TypeError || !navigator.onLine) {
        // Offline fallback already updated IndexedDB
        return;
      }
      throw err;
    }
  };

  // Quick remove folder from an article (used in ReaderView folder pill)
  const handleRemoveArticleFolder = async (article: Article) => {
    try {
      await handleUpdateArticleFolder(article, null, null);
    } catch (err) {
      console.error('Failed to remove folder:', err);
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
  const handleAddFolder = async (
    name: string,
    color?: string,
    folderType: FolderType = 'article'
  ) => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, folder_type: folderType }),
    });
    const data = await res.json();
    if (data.success) {
      fetchMetadata();
    }
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    // Optimistic update
    setFolders((prev) =>
      prev
        .map((f) => (f.id === id ? { ...f, name: trimmed } : f))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    setArticles((prev) =>
      prev.map((a) =>
        a.folder_id === id && a.folder
          ? { ...a, folder: { ...a.folder, name: trimmed } }
          : a
      )
    );
    setSelectedArticle((prev) =>
      prev && prev.folder_id === id && prev.folder
        ? { ...prev, folder: { ...prev.folder, name: trimmed } }
        : prev
    );

    try {
      const res = await fetch(`/api/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        fetchMetadata();
        fetchArticles(true);
      } else {
        fetchMetadata();
      }
    } catch {
      fetchMetadata();
    }
  };

  const handleCreateFolderFromModal = async (
    name: string,
    color?: string,
    folderType: FolderType = 'article'
  ): Promise<Folder> => {
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, folder_type: folderType }),
    });
    if (res.status === 401) {
      const data = await res.json();
      if (data.authRequired) {
        setNeedsAuth(true);
        throw new Error('Authentication required');
      }
    }
    const data = await res.json();
    if (!res.ok || !data.success || !data.folder) {
      throw new Error(data.error || 'Failed to create folder');
    }
    const created: Folder = data.folder;
    setFolders((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
    );
    fetchMetadata();
    return created;
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
  const newsletterFolders = useMemo(
    () => folders.filter((f) => f.folder_type === 'newsletter'),
    [folders]
  );
  const articleFolders = useMemo(
    () => folders.filter((f) => f.folder_type !== 'newsletter'),
    [folders]
  );

  // Active filter title
  const viewTitle = useMemo(() => {
    if (activeFolder) {
      return activeFolder.folder_type === 'newsletter'
        ? `Newsletter: ${activeFolder.name}`
        : `Folder: ${activeFolder.name}`;
    }
    if (activeTag) return `Tag: #${activeTag.name}`;
    if (currentFilter === 'newsletters') return 'Newsletters';
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
        onSelectFolder={(id, folderType) => {
          if (folderType === 'newsletter') {
            setCurrentFilter('newsletters');
          } else if (folderType === 'article' && currentFilter === 'newsletters') {
            setCurrentFilter('inbox');
          }
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
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isOnline={isOnline}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
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

            {/* Search Bar, Refresh Button & Add Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className="relative w-28 xs:w-36 sm:w-60 transition-all duration-150 focus-within:w-36 sm:focus-within:w-64">
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

              {/* Refresh Button with spinning arrow */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center justify-center p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition active:scale-95 shrink-0 min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] touch-manipulation disabled:opacity-60"
                title="Ricarica articoli"
                aria-label="Ricarica articoli"
              >
                <RefreshCw
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isRefreshing ? 'animate-spin text-rose-400' : ''
                  }`}
                />
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs md:text-sm font-semibold shadow-lg shadow-rose-600/20 transition active:scale-95 shrink-0 min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] touch-manipulation"
                title="Add URL"
                aria-label="Add URL"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add URL</span>
              </button>
            </div>
          </div>
        </header>

        {/* Newsletter Series Quick Filter Bar */}
        {currentFilter === 'newsletters' && newsletterFolders.length > 0 && (
          <div className="px-3 sm:px-4 md:px-6 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              type="button"
              onClick={() => setSelectedFolderId(undefined)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition shrink-0 touch-manipulation ${
                !selectedFolderId
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <Mail className="w-3 h-3" />
              <span>All Newsletters</span>
            </button>
            {newsletterFolders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <button
                  type="button"
                  key={folder.id}
                  onClick={() =>
                    setSelectedFolderId(isSelected ? undefined : folder.id)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition shrink-0 touch-manipulation ${
                    isSelected
                      ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/50 shadow-sm'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-700/80 hover:text-white border border-slate-800'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color || '#6366F1' }}
                  />
                  <span>{folder.name}</span>
                  {folder.article_count !== undefined && folder.article_count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 text-slate-300">
                      {folder.article_count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Active Filter Pills (Horizontal scrollable on small screens) */}
        {(selectedFolderId || selectedTagId || searchQuery) && (
          <div className="px-3 sm:px-4 md:px-6 py-2 bg-slate-900/40 border-b border-slate-800/60 flex items-center gap-1.5 sm:gap-2 text-xs overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="text-slate-400 shrink-0">Filtered:</span>
            {activeFolder && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-medium shrink-0">
                {activeFolder.folder_type === 'newsletter' ? 'Newsletter' : 'Folder'}: {activeFolder.name}
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

        {/* Article Cards Grid / Scrollable Area with Pull-To-Refresh */}
        <PullToRefresh
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          className="flex-1 overflow-y-auto p-3.5 sm:p-4 md:p-6 pb-[calc(var(--sab)+1.5rem)] overscroll-contain"
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
              <p className="text-xs">Loading articles...</p>
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center max-w-sm mx-auto px-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-4 shadow-xl">
                {currentFilter === 'newsletters' ? (
                  <Mail className="w-8 h-8 text-indigo-400/80" />
                ) : currentFilter === 'favorites' ? (
                  <Bookmark className="w-8 h-8 text-amber-400/80" />
                ) : currentFilter === 'archive' ? (
                  <Archive className="w-8 h-8 text-emerald-400/80" />
                ) : (
                  <BookOpen className="w-8 h-8 text-rose-400/80" />
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {currentFilter === 'newsletters'
                  ? 'No newsletters yet'
                  : currentFilter === 'favorites'
                  ? 'No favorites yet'
                  : currentFilter === 'archive'
                  ? 'Archive is empty'
                  : 'Your inbox is clear'}
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                {currentFilter === 'newsletters'
                  ? 'Open any newsletter in Gmail on Firefox and click the PocketBox extension to archive and read it distraction-free.'
                  : currentFilter === 'inbox'
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
                  onEditFolder={setEditingFolderArticle}
                  onEditTags={setEditingTagsArticle}
                />
              ))}
            </div>
          )}
        </PullToRefresh>
      </div>

      {/* Reader View Modal */}
      {selectedArticle && (
        <ReaderView
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onToggleFavorite={handleToggleFavorite}
          onToggleArchive={handleToggleArchive}
          onEditFolder={setEditingFolderArticle}
          onRemoveFolder={handleRemoveArticleFolder}
          onEditTags={setEditingTagsArticle}
          onRemoveTag={handleRemoveSingleTag}
          isTagsModalOpen={Boolean(editingTagsArticle)}
          isFolderModalOpen={Boolean(editingFolderArticle)}
        />
      )}

      {/* Move to Folder Modal */}
      <ArticleFolderModal
        article={editingFolderArticle}
        folders={folders}
        onClose={() => setEditingFolderArticle(null)}
        onSelectFolder={handleUpdateArticleFolder}
        onCreateFolder={handleCreateFolderFromModal}
      />

      {/* Manage Article Tags Modal */}
      <ArticleTagsModal
        article={editingTagsArticle}
        allTags={tags}
        onClose={() => setEditingTagsArticle(null)}
        onSave={handleUpdateArticleTags}
      />

      {/* Add Article Modal */}
      <AddArticleModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        folders={articleFolders}
        tags={tags}
        onSave={handleSaveArticle}
      />
    </div>
  );
}
