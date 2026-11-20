'use client';

import React from 'react';
import { Bookmark, Archive, ArchiveRestore, Trash2, Clock, Globe } from 'lucide-react';
import type { Article } from '@/lib/types';

interface ArticleCardProps {
  article: Article;
  onOpen: (article: Article) => void;
  onToggleFavorite: (article: Article) => void;
  onToggleArchive: (article: Article) => void;
  onDelete: (article: Article) => void;
}

export function ArticleCard({
  article,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
}: ArticleCardProps) {
  const isFavorite = article.is_favorite === 1;
  const isArchived = article.is_archived === 1;

  // Format date nicely
  const formattedDate = new Date(article.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <article
      onClick={() => onOpen(article)}
      className="group relative flex flex-col justify-between bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shadow-sm hover:shadow-xl hover:shadow-black/40 hover:-translate-y-0.5 isolate"
      style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
    >
      {/* Top Media / Thumbnail */}
      {article.lead_image_url ? (
        <div
          className="relative w-full h-44 bg-slate-950 overflow-hidden isolate"
          style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
        >
          <img
            src={article.lead_image_url}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            style={{
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            onError={(e) => {
              // Hide image container on broken image link
              (e.target as HTMLElement).parentElement?.classList.add('hidden');
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80 pointer-events-none" />
        </div>
      ) : (
        <div className="w-full h-1.5 bg-gradient-to-r from-rose-500/30 to-purple-500/30" />
      )}

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Metadata Row: Site Name & Reading Time */}
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2">
            <span className="flex items-center gap-1.5 truncate max-w-[65%] text-rose-400/90 font-semibold">
              <Globe className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{article.site_name || new URL(article.url).hostname}</span>
            </span>
            <span className="flex items-center gap-1 text-slate-400 flex-shrink-0">
              <Clock className="w-3 h-3" />
              <span>{article.reading_time_minutes} min read</span>
            </span>
          </div>

          {/* Title */}
          <h2 className="text-base font-bold text-slate-100 group-hover:text-rose-300 transition-colors line-clamp-2 leading-snug">
            {article.title}
          </h2>

          {/* Excerpt */}
          {article.excerpt && (
            <p className="mt-2 text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {article.excerpt}
            </p>
          )}
        </div>

        {/* Footer Area: Folder / Tags & Actions */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {/* Folder & Tag Pills */}
          <div className="flex items-center gap-1.5 overflow-hidden flex-1">
            {article.folder && (
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 truncate"
                style={{
                  backgroundColor: `${article.folder.color}20`,
                  color: article.folder.color || '#3B82F6',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: article.folder.color || '#3B82F6' }}
                />
                <span className="truncate">{article.folder.name}</span>
              </span>
            )}

            {article.tags && article.tags.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-medium truncate">
                #{article.tags[0].name}
                {article.tags.length > 1 && ` +${article.tags.length - 1}`}
              </span>
            )}

            <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">
              {formattedDate}
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Favorite Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(article);
              }}
              className={`p-2 rounded-lg transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95 ${
                isFavorite
                  ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
              }`}
              title={isFavorite ? 'Favorited' : 'Favorite'}
              aria-label={isFavorite ? 'Favorited' : 'Favorite'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Archive Toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleArchive(article);
              }}
              className={`p-2 rounded-lg transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95 ${
                isArchived
                  ? 'text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'
              }`}
              title={isArchived ? 'Move to Inbox' : 'Archive'}
              aria-label={isArchived ? 'Move to Inbox' : 'Archive'}
            >
              {isArchived ? (
                <ArchiveRestore className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this article?')) {
                  onDelete(article);
                }
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
