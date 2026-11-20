'use client';

import React, { useState, useEffect } from 'react';
import { X, Folder as FolderIcon, Inbox, Plus, Check, Loader2 } from 'lucide-react';
import type { Article, Folder } from '@/lib/types';

interface ArticleFolderModalProps {
  article: Article | null;
  folders: Folder[];
  onClose: () => void;
  onSelectFolder: (article: Article, folderId: string | null, folder?: Folder | null) => Promise<void>;
  onCreateFolder: (name: string, color?: string) => Promise<Folder>;
}

const FOLDER_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

export function ArticleFolderModal({
  article,
  folders,
  onClose,
  onSelectFolder,
  onCreateFolder,
}: ArticleFolderModalProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(FOLDER_COLORS[0]);
  const [pendingTarget, setPendingTarget] = useState<string | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = pendingTarget !== undefined || creating;

  useEffect(() => {
    if (article) {
      setNewFolderName('');
      setSelectedColor(FOLDER_COLORS[0]);
      setPendingTarget(undefined);
      setCreating(false);
      setError(null);
    }
  }, [article]);

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [article, isBusy, onClose]);

  if (!article) return null;

  const currentFolderId = article.folder_id || null;

  const handleSelect = async (targetFolderId: string | null, targetFolder?: Folder | null) => {
    if (isBusy) return;
    if (targetFolderId === currentFolderId) {
      onClose();
      return;
    }

    try {
      setPendingTarget(targetFolderId);
      setError(null);
      await onSelectFolder(article, targetFolderId, targetFolder);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to move article');
    } finally {
      setPendingTarget(undefined);
    }
  };

  const handleCreateAndMove = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed || isBusy) return;

    const existing = folders.find(
      (f) => f.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      await handleSelect(existing.id, existing);
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const created = await onCreateFolder(trimmed, selectedColor);
      await onSelectFolder(article, created.id, created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in pt-safe pb-safe overflow-y-auto"
      onClick={() => {
        if (!isBusy) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <FolderIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">Move to Folder</h3>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 line-clamp-1">{article.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center -mr-1 -mt-1 shrink-0 disabled:opacity-40"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-3 p-3 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl shrink-0">
            {error}
          </div>
        )}

        {/* Folder List */}
        <div className="mt-4 space-y-1.5 overflow-y-auto pr-0.5 flex-1">
          {/* No Folder (General) Option */}
          <button
            type="button"
            onClick={() => handleSelect(null, null)}
            disabled={isBusy}
            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition touch-manipulation min-h-[44px] border ${
              currentFolderId === null
                ? 'bg-blue-500/15 border-blue-500/40 text-white font-semibold'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/70 hover:text-white hover:border-slate-700'
            } disabled:opacity-60`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Inbox className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate">No Folder (General)</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pendingTarget === null ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : currentFolderId === null ? (
                <Check className="w-4 h-4 text-blue-400" />
              ) : null}
            </div>
          </button>

          {/* Existing Folders */}
          {folders.map((folder) => {
            const isCurrent = currentFolderId === folder.id;
            const isPending = pendingTarget === folder.id;
            return (
              <button
                type="button"
                key={folder.id}
                onClick={() => handleSelect(folder.id, folder)}
                disabled={isBusy}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition touch-manipulation min-h-[44px] border ${
                  isCurrent
                    ? 'bg-blue-500/15 border-blue-500/40 text-white font-semibold'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/70 hover:text-white hover:border-slate-700'
                } disabled:opacity-60`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: folder.color || '#6366F1' }}
                  />
                  <span className="truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {folder.article_count !== undefined && folder.article_count > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {folder.article_count}
                    </span>
                  )}
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  ) : isCurrent ? (
                    <Check className="w-4 h-4 text-blue-400" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* Create New Folder & Move */}
        <form
          onSubmit={handleCreateAndMove}
          className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5 shrink-0"
        >
          <label className="block text-xs font-semibold text-slate-400">
            Create New Folder
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name..."
              disabled={isBusy}
              className="flex-1 px-3 py-2 text-base sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newFolderName.trim() || isBusy}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1.5 transition touch-manipulation min-h-[40px] shrink-0 active:scale-95"
              title="Create folder and move article"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create</span>
            </button>
          </div>

          {/* Color Swatches */}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[11px] text-slate-500">Color:</span>
            <div className="flex items-center gap-1.5">
              {FOLDER_COLORS.map((color) => {
                const active = selectedColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={isBusy}
                    className={`w-5 h-5 rounded-full transition touch-manipulation flex items-center justify-center ${
                      active ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
