'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bookmark, Archive, ArchiveRestore, Trash2, Clock, Globe, Mail, Tag as TagIcon, Folder as FolderIcon, Share2, Check, Loader2, ExternalLink } from 'lucide-react';
import type { Article } from '@/lib/types';
import { getSafeHttpUrl, getSourceLinkLabels, getUrlHostname } from '@/lib/url';

interface ArticleCardProps {
  article: Article;
  onOpen: (article: Article) => void;
  onToggleFavorite: (article: Article) => void;
  onToggleArchive: (article: Article) => void;
  onDelete: (article: Article) => void;
  onEditFolder: (article: Article) => void;
  onEditTags: (article: Article) => void;
  onShare: (article: Article) => Promise<boolean>;
}

export function ArticleCard({
  article,
  onOpen,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  onEditFolder,
  onEditTags,
  onShare,
}: ArticleCardProps) {
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
    };
  }, []);

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shareState === 'loading') return;
    setShareState('loading');
    try {
      const ok = await onShare(article);
      if (ok) {
        setShareState('copied');
        if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
        shareTimerRef.current = setTimeout(() => setShareState('idle'), 2000);
      } else {
        setShareState('idle');
      }
    } catch {
      setShareState('idle');
    }
  };
  const isFavorite = article.is_favorite === 1;
  const isArchived = article.is_archived === 1;
  const isNewsletter = article.source_type === 'newsletter';
  const hasFolder = Boolean(article.folder);
  const hasTags = Boolean(article.tags && article.tags.length > 0);
  const safeSourceUrl = getSafeHttpUrl(article.url);
  const sourceHostname = getUrlHostname(article.url);
  const sourceLabels = getSourceLinkLabels(article.source_type, article.url);
  const sourceName = article.site_name || sourceHostname;

  const sourceBadgeContent = (
    <>
      {isNewsletter ? (
        <Mail className="w-3 h-3 flex-shrink-0" />
      ) : (
        <Globe className="w-3 h-3 flex-shrink-0" />
      )}
      <span className="truncate">{sourceName}</span>
    </>
  );

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
        <div
          className={`w-full h-1.5 bg-gradient-to-r ${
            isNewsletter
              ? 'from-indigo-500/50 to-violet-500/40'
              : 'from-rose-500/30 to-purple-500/30'
          }`}
        />
      )}

      {/* Content Area */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Metadata Row: Site Name (Source Link) & Reading Time */}
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2 gap-2">
            {safeSourceUrl ? (
              <a
                href={safeSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`group/source inline-flex items-center gap-1.5 truncate max-w-[65%] font-semibold hover:underline underline-offset-2 touch-manipulation ${
                  isNewsletter ? 'text-indigo-400/95 hover:text-indigo-300' : 'text-rose-400/90 hover:text-rose-300'
                }`}
                title={`${sourceLabels.actionTitle}: ${safeSourceUrl}`}
                aria-label={`${sourceName} — ${sourceLabels.actionTitle}`}
              >
                {sourceBadgeContent}
                <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-70 group-hover/source:opacity-100" />
              </a>
            ) : (
              <span
                className={`flex items-center gap-1.5 truncate max-w-[65%] font-semibold ${
                  isNewsletter ? 'text-indigo-400/95' : 'text-rose-400/90'
                }`}
              >
                {sourceBadgeContent}
              </span>
            )}
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

        {/* Newsletter Badge, Folder & Tag Pills */}
        {(isNewsletter || article.folder || hasTags) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {isNewsletter && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                <span>Newsletter</span>
              </span>
            )}
            {article.folder && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFolder(article);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold max-w-[160px] transition hover:brightness-125 touch-manipulation"
                style={{
                  backgroundColor: `${article.folder.color}20`,
                  color: article.folder.color || '#3B82F6',
                }}
                title="Change folder"
                aria-label={`Change folder (${article.folder.name})`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: article.folder.color || '#3B82F6' }}
                />
                <span className="truncate">{article.folder.name}</span>
              </button>
            )}

            {article.tags && article.tags.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTags(article);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium max-w-[160px] transition touch-manipulation"
                title="Edit tags"
                aria-label="Edit tags"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: article.tags[0].color || '#10B981' }}
                />
                <span className="truncate">
                  #{article.tags[0].name}
                  {article.tags.length > 1 && ` +${article.tags.length - 1}`}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Footer Area: Date & Actions */}
        <div
          className={`${
            isNewsletter || article.folder || hasTags ? 'mt-3' : 'mt-4'
          } pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2`}
        >
          <span className="text-[11px] text-slate-400 flex-shrink-0">
            {formattedDate}
          </span>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Move to Folder */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditFolder(article);
              }}
              className={`p-2 rounded-lg transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95 ${
                hasFolder
                  ? 'text-blue-400 bg-blue-400/10 hover:bg-blue-400/20'
                  : 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
              }`}
              title={article.folder ? `Folder: ${article.folder.name} (change)` : 'Move to folder'}
              aria-label="Move to folder"
            >
              <FolderIcon className="w-3.5 h-3.5" />
            </button>

            {/* Manage Tags */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTags(article);
              }}
              className={`p-2 rounded-lg transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95 ${
                hasTags
                  ? 'text-rose-400 bg-rose-400/10 hover:bg-rose-400/20'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
              }`}
              title="Manage tags"
              aria-label="Manage tags"
            >
              <TagIcon className="w-3.5 h-3.5" />
            </button>

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

            {/* Share Saved Copy */}
            <button
              type="button"
              onClick={handleShareClick}
              disabled={shareState === 'loading'}
              className={`p-2 rounded-lg transition touch-manipulation min-w-[34px] min-h-[34px] flex items-center justify-center active:scale-95 ${
                shareState === 'copied'
                  ? 'text-emerald-400 bg-emerald-400/10'
                  : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
              }`}
              title={shareState === 'copied' ? 'Share link copied!' : 'Copy share link'}
              aria-label={shareState === 'copied' ? 'Share link copied' : 'Copy share link'}
            >
              {shareState === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : shareState === 'copied' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Share2 className="w-3.5 h-3.5" />
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
