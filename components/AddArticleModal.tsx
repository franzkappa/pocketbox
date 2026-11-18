'use client';

import React, { useState } from 'react';
import { X, Loader2, Link2, Plus } from 'lucide-react';
import type { Folder, Tag } from '@/lib/types';

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  tags: Tag[];
  onSave: (url: string, folderId?: string, tagNames?: string[]) => Promise<void>;
}

export function AddArticleModal({
  isOpen,
  onClose,
  folders,
  tags,
  onSave,
}: AddArticleModalProps) {
  const [url, setUrl] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      setLoading(true);
      setError(null);
      await onSave(
        url.trim(),
        selectedFolderId || undefined,
        selectedTags.length > 0 ? selectedTags : undefined
      );
      setUrl('');
      setSelectedFolderId('');
      setSelectedTags([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save article');
    } finally {
      setLoading(false);
    }
  };

  const toggleTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagName));
    } else {
      setSelectedTags([...selectedTags, tagName]);
    }
  };

  const handleAddNewTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTagInput.trim()) {
      e.preventDefault();
      const val = newTagInput.trim().toLowerCase();
      if (!selectedTags.includes(val)) {
        setSelectedTags([...selectedTags, val]);
      }
      setNewTagInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in pt-safe pb-safe overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 overflow-hidden my-auto max-h-[calc(100dvh-2rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-white">Save Article to PocketBox</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center -mr-1"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-1">
          {error && (
            <div className="p-3 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Article URL
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              autoFocus
              className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          {/* Folder Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Folder (Optional)
            </label>
            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="w-full px-3 py-2 text-base sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">No Folder (General)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tags Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Tags (Optional)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => {
                const active = selectedTags.includes(t.name);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTag(t.name)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition touch-manipulation ${
                      active
                        ? 'bg-rose-500 border-rose-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    #{t.name}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={handleAddNewTag}
              placeholder="Type tag & press Enter..."
              className="w-full px-3 py-2 text-base sm:text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition touch-manipulation min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-600/20 transition active:scale-95 touch-manipulation min-h-[40px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Extracting Article...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Article</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
