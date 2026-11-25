'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Bookmark, 
  Archive, 
  ArchiveRestore, 
  ExternalLink, 
  Type, 
  Sun, 
  Moon, 
  Clock, 
  Globe, 
  Mail,
  Minus, 
  Plus,
  Folder as FolderIcon,
  Tag as TagIcon,
  Share2,
  Check,
  Loader2,
  X
} from 'lucide-react';
import type { Article } from '@/lib/types';

interface ReaderViewProps {
  article: Article;
  onClose: () => void;
  onToggleFavorite: (article: Article) => void;
  onToggleArchive: (article: Article) => void;
  onEditFolder: (article: Article) => void;
  onRemoveFolder: (article: Article) => void;
  onEditTags: (article: Article) => void;
  onRemoveTag: (article: Article, tagName: string) => void;
  onShare: (article: Article) => Promise<boolean>;
  isTagsModalOpen?: boolean;
  isFolderModalOpen?: boolean;
}

type Theme = 'paper' | 'sepia' | 'slate' | 'oled';
type FontFamily = 'serif' | 'sans' | 'mono';

export function ReaderView({
  article,
  onClose,
  onToggleFavorite,
  onToggleArchive,
  onEditFolder,
  onRemoveFolder,
  onEditTags,
  onRemoveTag,
  onShare,
  isTagsModalOpen = false,
  isFolderModalOpen = false,
}: ReaderViewProps) {
  // Preferences persisted in localStorage
  const [theme, setTheme] = useState<Theme>('paper');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [fontSize, setFontSize] = useState<number>(19);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const contentRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShareState('idle');
    return () => {
      if (shareTimerRef.current) {
        clearTimeout(shareTimerRef.current);
      }
    };
  }, [article.id]);

  const handleShareClick = async () => {
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
  const isGmailUrl = /^https?:\/\/mail\.google\.com\//i.test(article.url);
  const externalLinkTitle = isNewsletter
    ? isGmailUrl
      ? 'Open email in Gmail'
      : 'Open newsletter web version'
    : 'Open original website';
  const hasFolder = Boolean(article.folder);
  const hasTags = Boolean(article.tags && article.tags.length > 0);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('pocketbox_theme') as Theme;
      const savedFont = localStorage.getItem('pocketbox_font') as FontFamily;
      const savedSize = localStorage.getItem('pocketbox_size');
      if (savedTheme) setTheme(savedTheme);
      if (savedFont) setFontFamily(savedFont);
      if (savedSize) setFontSize(Number(savedSize));
    } catch {
      // ignore
    }
  }, []);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem('pocketbox_theme', newTheme);
    } catch {}
  };

  const updateFontFamily = (font: FontFamily) => {
    setFontFamily(font);
    try {
      localStorage.setItem('pocketbox_font', font);
    } catch {}
  };

  const updateFontSize = (delta: number) => {
    setFontSize((prev) => {
      const updated = Math.min(28, Math.max(14, prev + delta));
      try {
        localStorage.setItem('pocketbox_size', updated.toString());
      } catch {}
      return updated;
    });
  };

  // Keyboard shortcut: Esc to close settings or exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTagsModalOpen || isFolderModalOpen) return;
        if (showSettings) {
          setShowSettings(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSettings, isTagsModalOpen, isFolderModalOpen]);

  // Close settings popover when clicking or tapping outside
  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showSettings]);

  // Track scroll progress directly on DOM node via requestAnimationFrame (no React re-renders while scrolling)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        if (!el || !progressBarRef.current) return;
        const totalHeight = el.scrollHeight - el.clientHeight;
        if (totalHeight <= 0) {
          progressBarRef.current.style.width = '100%';
          return;
        }
        const progress = Math.min(100, Math.max(0, (el.scrollTop / totalHeight) * 100));
        progressBarRef.current.style.width = `${progress}%`;
      });
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Ensure all images in article content decode asynchronously to eliminate scroll stutter and flicker
  useEffect(() => {
    if (!contentRef.current) return;
    const imgs = contentRef.current.querySelectorAll('.reader-content img');
    imgs.forEach((img) => {
      if (!img.getAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
    });
  }, [article.id, article.content_html]);

  // Theme styling definitions
  const themeClasses: Record<
    Theme,
    { bg: string; text: string; header: string; card: string; border: string; pill: string; pillAdd: string }
  > = {
    paper: {
      bg: 'bg-[#FCFCFC]',
      text: 'text-[#1C1C1E]',
      header: 'bg-[#FCFCFC]/90 border-[#E5E5EA]',
      card: 'bg-[#F2F2F7]',
      border: 'border-[#E5E5EA]',
      pill: 'bg-black/[0.05] border-black/10',
      pillAdd: 'border-black/15 hover:bg-black/[0.06]',
    },
    sepia: {
      bg: 'bg-[#F8F1E5]',
      text: 'text-[#3E2723]',
      header: 'bg-[#F8F1E5]/90 border-[#EBDCC7]',
      card: 'bg-[#EFE4D2]',
      border: 'border-[#EBDCC7]',
      pill: 'bg-[#3E2723]/[0.07] border-[#3E2723]/15',
      pillAdd: 'border-[#3E2723]/20 hover:bg-[#3E2723]/[0.08]',
    },
    slate: {
      bg: 'bg-[#181C22]',
      text: 'text-[#DDE2E8]',
      header: 'bg-[#181C22]/90 border-[#262D37]',
      card: 'bg-[#22272E]',
      border: 'border-[#262D37]',
      pill: 'bg-white/[0.07] border-white/10',
      pillAdd: 'border-white/15 hover:bg-white/[0.08]',
    },
    oled: {
      bg: 'bg-[#000000]',
      text: 'text-[#EDEDED]',
      header: 'bg-[#000000]/90 border-[#1F1F1F]',
      card: 'bg-[#121212]',
      border: 'border-[#1F1F1F]',
      pill: 'bg-white/[0.09] border-white/15',
      pillAdd: 'border-white/20 hover:bg-white/[0.12]',
    },
  };

  const currentTheme = themeClasses[theme];

  const fontClass =
    fontFamily === 'serif'
      ? 'font-serif'
      : fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col ${currentTheme.bg} ${currentTheme.text} transition-colors duration-200`}
    >
      {/* Top Header Bar with Safe Area Clearance */}
      <header
        className={`sticky top-0 z-40 pt-safe border-b backdrop-blur-md transition-colors ${currentTheme.header}`}
      >
        <div className="h-12 sm:h-14 px-3 sm:px-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-black/10 transition text-sm font-semibold touch-manipulation min-h-[38px] min-w-[38px]"
            title="Back to library (Esc)"
            aria-label="Back to library"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Library</span>
          </button>

          {/* Reader Center Title (compact) */}
          <div className="hidden md:flex flex-col items-center max-w-sm truncate text-center">
            <span className="text-xs font-semibold truncate opacity-80">{article.title}</span>
            <span className="text-[10px] opacity-60 truncate">
              {article.site_name || new URL(article.url).hostname}
            </span>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Typography & Theme Popover Toggle */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="Typography & Theme settings"
                aria-label="Typography settings"
              >
                <Type className="w-4 h-4" />
              </button>

              {/* Typography Popover */}
              {showSettings && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 mt-2 w-64 max-w-[calc(100vw-1.5rem)] p-4 rounded-2xl shadow-2xl border ${currentTheme.card} ${currentTheme.border} ${currentTheme.text} z-50 animate-fade-in`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">
                    Reader Appearance
                  </div>

                  {/* Theme selection */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2">Theme</div>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => updateTheme('paper')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#FCFCFC] text-[#1C1C1E] ${
                          theme === 'paper' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-slate-300'
                        }`}
                        title="Light"
                      >
                        Aa
                      </button>
                      <button
                        onClick={() => updateTheme('sepia')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#F8F1E5] text-[#3E2723] ${
                          theme === 'sepia' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-[#EBDCC7]'
                        }`}
                        title="Sepia"
                      >
                        Aa
                      </button>
                      <button
                        onClick={() => updateTheme('slate')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#181C22] text-[#DDE2E8] ${
                          theme === 'slate' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-[#262D37]'
                        }`}
                        title="Slate"
                      >
                        Aa
                      </button>
                      <button
                        onClick={() => updateTheme('oled')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#000000] text-[#EDEDED] ${
                          theme === 'oled' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-[#262D37]'
                        }`}
                        title="OLED Pure Black"
                      >
                        Aa
                      </button>
                    </div>
                  </div>

                  {/* Font selection */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2">Font Style</div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                      <button
                        onClick={() => updateFontFamily('serif')}
                        className={`py-1.5 px-2 rounded-lg font-serif border ${
                          fontFamily === 'serif' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Serif
                      </button>
                      <button
                        onClick={() => updateFontFamily('sans')}
                        className={`py-1.5 px-2 rounded-lg font-sans border ${
                          fontFamily === 'sans' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Sans
                      </button>
                      <button
                        onClick={() => updateFontFamily('mono')}
                        className={`py-1.5 px-2 rounded-lg font-mono border ${
                          fontFamily === 'mono' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Mono
                      </button>
                    </div>
                  </div>

                  {/* Font size adjustment */}
                  <div>
                    <div className="text-xs font-semibold mb-2 flex justify-between">
                      <span>Size</span>
                      <span className="opacity-60">{fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateFontSize(-1)}
                        className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs touch-manipulation min-h-[36px]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => updateFontSize(1)}
                        className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs touch-manipulation min-h-[36px]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Move to Folder */}
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onEditFolder(article);
              }}
              className={`p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center ${
                hasFolder ? 'text-blue-500' : 'opacity-80'
              }`}
              title={article.folder ? `Folder: ${article.folder.name} (change)` : 'Move to folder'}
              aria-label="Move to folder"
            >
              <FolderIcon className="w-4 h-4" />
            </button>

            {/* Manage Tags */}
            <button
              type="button"
              onClick={() => {
                setShowSettings(false);
                onEditTags(article);
              }}
              className={`p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center ${
                hasTags ? 'text-rose-500' : 'opacity-80'
              }`}
              title="Manage tags"
              aria-label="Manage tags"
            >
              <TagIcon className="w-4 h-4" />
            </button>

            {/* Toggle Favorite */}
            <button
              onClick={() => onToggleFavorite(article)}
              className={`p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center ${
                isFavorite ? 'text-amber-500' : 'opacity-80'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Favorite'}
              aria-label="Favorite"
            >
              <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            {/* Toggle Archive */}
            <button
              onClick={() => onToggleArchive(article)}
              className={`p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center ${
                isArchived ? 'text-emerald-500' : 'opacity-80'
              }`}
              title={isArchived ? 'Move to Inbox' : 'Archive article'}
              aria-label="Archive"
            >
              {isArchived ? (
                <ArchiveRestore className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
            </button>

            {/* Share Saved Copy Link */}
            <button
              type="button"
              onClick={handleShareClick}
              disabled={shareState === 'loading'}
              className={`p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[36px] sm:min-w-[38px] min-h-[38px] flex items-center justify-center ${
                shareState === 'copied' ? 'text-emerald-500' : 'opacity-80'
              }`}
              title={shareState === 'copied' ? 'Share link copied!' : 'Copy share link'}
              aria-label={shareState === 'copied' ? 'Share link copied' : 'Copy share link'}
            >
              {shareState === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : shareState === 'copied' ? (
                <Check className="w-4 h-4" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Open Original Link */}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition opacity-80 touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center"
              title={externalLinkTitle}
              aria-label={externalLinkTitle}
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Scroll Progress Bar along header bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/5 dark:bg-white/10 pointer-events-none">
          <div
            ref={progressBarRef}
            className="h-full bg-rose-500 will-change-[width]"
            style={{ width: '0%' }}
          />
        </div>
      </header>

      {/* Main Reading Canvas */}
      <main
        ref={contentRef}
        onClick={() => {
          if (showSettings) setShowSettings(false);
        }}
        className="flex-1 overflow-y-auto px-4 py-6 md:py-12 pb-[calc(var(--sab)+3rem)] overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-[680px] mx-auto">
          {/* Article Header Metadata */}
          <div className="mb-8 pb-6 border-b border-black/10">
            {/* Domain / Newsletter Source & Reading Time */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold opacity-75 mb-3">
              {isNewsletter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
                  <Mail className="w-3 h-3" />
                  <span>Newsletter</span>
                </span>
              )}
              <span
                className={`flex items-center gap-1.5 ${
                  isNewsletter ? 'text-indigo-500' : 'text-rose-500'
                }`}
              >
                {isNewsletter ? (
                  <Mail className="w-3.5 h-3.5" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span>{article.site_name || new URL(article.url).hostname}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{article.reading_time_minutes} min read</span>
              </span>
            </div>

            {/* Title */}
            <h1
              className={`font-bold leading-tight tracking-tight mb-4 ${fontClass}`}
              style={{ fontSize: `${Math.round(fontSize * 1.55)}px` }}
            >
              {article.title}
            </h1>

            {/* Author / Byline & Date */}
            <div className="text-xs opacity-70 space-y-1">
              {article.byline && (
                <div>{isNewsletter ? `From ${article.byline}` : `By ${article.byline}`}</div>
              )}
              <div>Saved on {new Date(article.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
            </div>

            {/* Article Folder & Tags Row */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              {article.folder ? (
                <span
                  className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border transition ${currentTheme.pill}`}
                >
                  <button
                    type="button"
                    onClick={() => onEditFolder(article)}
                    className="inline-flex items-center gap-1.5 hover:opacity-80 transition touch-manipulation"
                    title="Change folder"
                    aria-label={`Change folder (${article.folder.name})`}
                  >
                    <FolderIcon
                      className="w-3 h-3 shrink-0"
                      style={{ color: article.folder.color || '#3B82F6' }}
                    />
                    <span>{article.folder.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFolder(article)}
                    className="p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/10 transition touch-manipulation"
                    title={`Remove from ${article.folder.name}`}
                    aria-label={`Remove from folder ${article.folder.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onEditFolder(article)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed opacity-75 hover:opacity-100 transition touch-manipulation ${currentTheme.pillAdd}`}
                  title="Add to folder"
                >
                  <FolderIcon className="w-3 h-3" />
                  <span>Add to folder</span>
                </button>
              )}

              {article.tags &&
                article.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border transition ${currentTheme.pill}`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color || '#10B981' }}
                    />
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveTag(article, tag.name)}
                      className="p-0.5 rounded-full opacity-60 hover:opacity-100 hover:bg-black/10 transition touch-manipulation"
                      title={`Remove #${tag.name}`}
                      aria-label={`Remove tag ${tag.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}

              <button
                type="button"
                onClick={() => onEditTags(article)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed opacity-75 hover:opacity-100 transition touch-manipulation ${currentTheme.pillAdd}`}
                title="Add or edit tags"
              >
                <Plus className="w-3 h-3" />
                <span>{hasTags ? 'Edit tags' : 'Add tag'}</span>
              </button>
            </div>
          </div>

          {/* Lead Image (if present) */}
          {article.lead_image_url && (
            <div
              className="mb-8 rounded-2xl overflow-hidden shadow-lg isolate"
              style={{ transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}
            >
              <img
                src={article.lead_image_url}
                alt={article.title}
                className="w-full max-h-[420px] object-cover"
                loading="eager"
                decoding="async"
                style={{
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                }}
              />
            </div>
          )}

          {/* Extracted Clean Article Body */}
          <div
            className={`reader-content ${fontClass}`}
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{
              __html: article.content_html || `<p>${article.excerpt || ''}</p>`,
            }}
          />

          {/* Article End Mark */}
          <div className="mt-16 pt-8 border-t border-black/10 flex flex-col items-center justify-center text-center opacity-60 text-xs gap-2 pb-12">
            <div>Finished reading</div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onToggleArchive(article)}
                className="px-4 py-2 rounded-xl bg-black/10 hover:bg-black/20 font-semibold transition"
              >
                {isArchived ? 'Move to Inbox' : '✓ Mark as Read & Archive'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
