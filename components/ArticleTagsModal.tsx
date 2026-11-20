'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Tag as TagIcon, Plus, Check, Loader2 } from 'lucide-react';
import type { Article, Tag } from '@/lib/types';

interface ArticleTagsModalProps {
  article: Article | null;
  allTags: Tag[];
  onClose: () => void;
  onSave: (article: Article, tagNames: string[]) => Promise<void>;
}

function normalizeTagName(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim().toLowerCase();
}

export function ArticleTagsModal({
  article,
  allTags,
  onClose,
  onSave,
}: ArticleTagsModalProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (article) {
      setSelectedTags((article.tags || []).map((t) => t.name.toLowerCase()));
      setNewTagInput('');
      setError(null);
      setLoading(false);
    }
  }, [article]);

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [article, loading, onClose]);

  const tagColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTags) {
      map.set(t.name.toLowerCase(), t.color || '#10B981');
    }
    return map;
  }, [allTags]);

  const normalizedQuery = normalizeTagName(newTagInput);

  const filteredAllTags = useMemo(() => {
    if (!normalizedQuery) return allTags;
    return allTags.filter((t) => t.name.toLowerCase().includes(normalizedQuery));
  }, [allTags, normalizedQuery]);

  const exactExistingMatch = useMemo(() => {
    if (!normalizedQuery) return false;
    return allTags.some((t) => t.name.toLowerCase() === normalizedQuery);
  }, [allTags, normalizedQuery]);

  if (!article) return null;

  const toggleTag = (tagName: string) => {
    const norm = normalizeTagName(tagName);
    if (!norm) return;
    setSelectedTags((prev) =>
      prev.includes(norm) ? prev.filter((t) => t !== norm) : [...prev, norm]
    );
  };

  const addInputTag = () => {
    const norm = normalizeTagName(newTagInput);
    if (!norm) return;
    setSelectedTags((prev) => (prev.includes(norm) ? prev : [...prev, norm]));
    setNewTagInput('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && newTagInput.trim()) {
      e.preventDefault();
      addInputTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pending = normalizeTagName(newTagInput);
    const finalTags =
      pending && !selectedTags.includes(pending)
        ? [...selectedTags, pending]
        : selectedTags;

    try {
      setLoading(true);
      setError(null);
      await onSave(article, finalTags);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update tags');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in pt-safe pb-safe overflow-y-auto"
      onClick={() => {
        if (!loading) onClose();
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
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <TagIcon className="w-4 h-4" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">Manage Tags</h3>
            </div>
            <p className="mt-1.5 text-xs text-slate-400 line-clamp-1">{article.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center -mr-1 -mt-1 shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto pr-0.5">
          {error && (
            <div className="p-3 text-xs text-rose-300 bg-rose-500/15 border border-rose-500/30 rounded-xl">
              {error}
            </div>
          )}

          {/* Currently Assigned Tags */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400">
                Assigned Tags ({selectedTags.length})
              </label>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            {selectedTags.length === 0 ? (
              <div className="px-3 py-2.5 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-xs text-slate-500">
                No tags assigned to this article yet.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tagName) => (
                  <span
                    key={tagName}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs font-medium rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/40"
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tagColorMap.get(tagName) || '#6366F1' }}
                    />
                    <span>#{tagName}</span>
                    <button
                      type="button"
                      onClick={() => toggleTag(tagName)}
                      className="p-0.5 rounded-full hover:bg-rose-500/30 text-rose-200 hover:text-white transition touch-manipulation"
                      title={`Remove #${tagName}`}
                      aria-label={`Remove tag ${tagName}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Add / Filter Tag Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Add or Create Tag
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Type tag name..."
                autoFocus
                className="flex-1 px-3 py-2 text-base sm:text-sm bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
              />
              <button
                type="button"
                onClick={addInputTag}
                disabled={!normalizedQuery}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-1 transition touch-manipulation min-h-[40px] shrink-0"
                title="Add tag"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* Existing Tags Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Available Tags
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
              {normalizedQuery &&
                !exactExistingMatch &&
                !selectedTags.includes(normalizedQuery) && (
                  <button
                    type="button"
                    onClick={addInputTag}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full border border-dashed border-rose-500/60 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition touch-manipulation"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Create &ldquo;#{normalizedQuery}&rdquo;</span>
                  </button>
                )}

              {filteredAllTags.map((t) => {
                const norm = t.name.toLowerCase();
                const active = selectedTags.includes(norm);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggleTag(norm)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-full border transition touch-manipulation ${
                      active
                        ? 'bg-rose-500 border-rose-500 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    {active ? (
                      <Check className="w-3 h-3 shrink-0" />
                    ) : (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color || '#10B981' }}
                      />
                    )}
                    <span>#{t.name}</span>
                  </button>
                );
              })}

              {filteredAllTags.length === 0 && !normalizedQuery && (
                <p className="text-xs text-slate-500">
                  No existing tags yet. Type a name above to create one.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800/80 shrink-0">
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
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-rose-600/20 transition active:scale-95 touch-manipulation min-h-[40px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Tags</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
