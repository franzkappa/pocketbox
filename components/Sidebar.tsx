'use client';

import React, { useState } from 'react';
import { 
  Inbox, 
  Bookmark, 
  Archive, 
  Folder as FolderIcon, 
  Tag as TagIcon, 
  Plus, 
  X, 
  Trash2, 
  Wifi, 
  WifiOff,
  RefreshCw 
} from 'lucide-react';
import type { Folder, Tag, ArticleFilter } from '@/lib/types';

interface SidebarProps {
  currentFilter: ArticleFilter;
  onSelectFilter: (filter: ArticleFilter) => void;
  selectedFolderId?: string;
  onSelectFolder: (folderId?: string) => void;
  selectedTagId?: string;
  onSelectTag: (tagId?: string) => void;
  folders: Folder[];
  tags: Tag[];
  onAddFolder: (name: string, color?: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onAddTag: (name: string, color?: string) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  isOnline: boolean;
  onLogout?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Sidebar({
  currentFilter,
  onSelectFilter,
  selectedFolderId,
  onSelectFolder,
  selectedTagId,
  onSelectTag,
  folders,
  tags,
  onAddFolder,
  onDeleteFolder,
  onAddTag,
  onDeleteTag,
  isOpen,
  onClose,
  isOnline,
  onLogout,
  onRefresh,
  isRefreshing,
}: SidebarProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onAddFolder(newFolderName.trim());
    setNewFolderName('');
    setShowAddFolder(false);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    await onAddTag(newTagName.trim());
    setNewTagName('');
    setShowAddTag(false);
  };

  const navItemClass = (active: boolean) =>
    `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
      active
        ? 'bg-rose-500/15 text-rose-400 font-semibold shadow-sm'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header with Safe Area Clearance */}
      <div className="p-4 sm:p-5 pt-[calc(var(--sat)+1rem)] md:pt-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <span className="text-white text-base font-bold">📦</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              PocketBox
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Local Read-It-Later</p>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-95"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Nav Items */}
      <div className="p-3 space-y-1">
        <button
          onClick={() => {
            onSelectFilter('inbox');
            onSelectFolder(undefined);
            onSelectTag(undefined);
            onClose();
          }}
          className={navItemClass(currentFilter === 'inbox' && !selectedFolderId && !selectedTagId)}
        >
          <Inbox className="w-4 h-4 text-rose-400" />
          <span className="flex-1 text-left">Inbox</span>
        </button>

        <button
          onClick={() => {
            onSelectFilter('favorites');
            onSelectFolder(undefined);
            onSelectTag(undefined);
            onClose();
          }}
          className={navItemClass(currentFilter === 'favorites' && !selectedFolderId && !selectedTagId)}
        >
          <Bookmark className="w-4 h-4 text-amber-400" />
          <span className="flex-1 text-left">Favorites</span>
        </button>

        <button
          onClick={() => {
            onSelectFilter('archive');
            onSelectFolder(undefined);
            onSelectTag(undefined);
            onClose();
          }}
          className={navItemClass(currentFilter === 'archive' && !selectedFolderId && !selectedTagId)}
        >
          <Archive className="w-4 h-4 text-emerald-400" />
          <span className="flex-1 text-left">Archive</span>
        </button>
      </div>

      {/* Folders Section */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400 tracking-wider uppercase">
            <span>Folders</span>
            <button
              onClick={() => setShowAddFolder(!showAddFolder)}
              className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
              title="Add Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showAddFolder && (
            <form onSubmit={handleCreateFolder} className="mt-2 mb-2 px-1">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-base md:text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </form>
          )}

          <div className="mt-1 space-y-0.5">
            {folders.map((folder) => {
              const isSelected = selectedFolderId === folder.id;
              return (
                <div
                  key={folder.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition ${
                    isSelected
                      ? 'bg-slate-800 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  onClick={() => {
                    onSelectFolder(isSelected ? undefined : folder.id);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: folder.color || '#3B82F6' }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
                    {folder.article_count !== undefined && folder.article_count > 0 && (
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">
                        {folder.article_count}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folder.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tags Section */}
        <div>
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-400 tracking-wider uppercase">
            <span>Tags</span>
            <button
              onClick={() => setShowAddTag(!showAddTag)}
              className="p-1 rounded hover:bg-slate-800 hover:text-white transition"
              title="Add Tag"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {showAddTag && (
            <form onSubmit={handleCreateTag} className="mt-2 mb-2 px-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name..."
                autoFocus
                className="w-full px-2.5 py-1.5 text-base md:text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </form>
          )}

          <div className="mt-1 flex flex-wrap gap-1.5 px-1">
            {tags.map((tag) => {
              const isSelected = selectedTagId === tag.id;
              return (
                <button
                  key={tag.id}
                  onClick={() => {
                    onSelectTag(isSelected ? undefined : tag.id);
                    onClose();
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition touch-manipulation ${
                    isSelected
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tag.color || '#10B981' }}
                  />
                  <span>{tag.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Connection Status with Safe Area Clearance */}
      <div className="p-3 pb-[calc(var(--sab)+0.75rem)] border-t border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center justify-between px-2 py-1 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>PocketBox Cloud: Online</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>Offline Mode (IndexedDB)</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                title="Ricarica articoli"
                aria-label="Ricarica articoli"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-rose-400' : ''}`} />
              </button>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                title="Esci da PocketBox"
              >
                Esci
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900/90 border-r border-slate-800 flex-shrink-0 backdrop-blur-md">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-out Drawer (Optimized for iPhone SE) */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex-1 flex flex-col max-w-[280px] xs:max-w-xs w-full bg-slate-900 border-r border-slate-800 shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
