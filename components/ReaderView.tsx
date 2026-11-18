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
  Minus, 
  Plus 
} from 'lucide-react';
import type { Article } from '@/lib/types';

interface ReaderViewProps {
  article: Article;
  onClose: () => void;
  onToggleFavorite: (article: Article) => void;
  onToggleArchive: (article: Article) => void;
}

type Theme = 'paper' | 'sepia' | 'slate' | 'oled';
type FontFamily = 'serif' | 'sans' | 'mono';

export function ReaderView({
  article,
  onClose,
  onToggleFavorite,
  onToggleArchive,
}: ReaderViewProps) {
  // Preferences persisted in localStorage
  const [theme, setTheme] = useState<Theme>('paper');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [fontSize, setFontSize] = useState<number>(19);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const isFavorite = article.is_favorite === 1;
  const isArchived = article.is_archived === 1;

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

  // Keyboard shortcut: Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Track scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const el = contentRef.current;
      if (!el) return;
      const totalHeight = el.scrollHeight - el.clientHeight;
      if (totalHeight <= 0) {
        setScrollProgress(100);
        return;
      }
      const progress = (el.scrollTop / totalHeight) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    const el = contentRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll, { passive: true });
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Theme styling definitions
  const themeClasses: Record<Theme, { bg: string; text: string; header: string; card: string; border: string }> = {
    paper: {
      bg: 'bg-[#FCFCFC]',
      text: 'text-[#1C1C1E]',
      header: 'bg-[#FCFCFC]/90 border-[#E5E5EA]',
      card: 'bg-[#F2F2F7]',
      border: 'border-[#E5E5EA]',
    },
    sepia: {
      bg: 'bg-[#F8F1E5]',
      text: 'text-[#3E2723]',
      header: 'bg-[#F8F1E5]/90 border-[#EBDCC7]',
      card: 'bg-[#EFE4D2]',
      border: 'border-[#EBDCC7]',
    },
    slate: {
      bg: 'bg-[#181C22]',
      text: 'text-[#DDE2E8]',
      header: 'bg-[#181C22]/90 border-[#262D37]',
      card: 'bg-[#22272E]',
      border: 'border-[#262D37]',
    },
    oled: {
      bg: 'bg-[#000000]',
      text: 'text-[#EDEDED]',
      header: 'bg-[#000000]/90 border-[#1F1F1F]',
      card: 'bg-[#121212]',
      border: 'border-[#1F1F1F]',
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
      {/* Scroll Progress Bar at very top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-transparent z-50">
        <div
          className="h-full bg-rose-500 transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Top Header Bar */}
      <header
        className={`sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b backdrop-blur-md ${currentTheme.header}`}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-black/10 transition text-sm font-semibold"
          title="Back to library (Esc)"
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
        <div className="flex items-center gap-1.5">
          {/* Typography & Theme Popover Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl hover:bg-black/10 transition"
              title="Typography & Theme settings"
            >
              <Type className="w-4 h-4" />
            </button>

            {/* Typography Popover */}
            {showSettings && (
              <div
                className={`absolute right-0 mt-2 w-64 p-4 rounded-2xl shadow-2xl border ${currentTheme.card} ${currentTheme.border} ${currentTheme.text} z-50 animate-fade-in`}
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
                      className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updateFontSize(1)}
                      className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Favorite */}
          <button
            onClick={() => onToggleFavorite(article)}
            className={`p-2 rounded-xl hover:bg-black/10 transition ${
              isFavorite ? 'text-amber-500' : 'opacity-80'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Favorite'}
          >
            <Bookmark className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>

          {/* Toggle Archive */}
          <button
            onClick={() => onToggleArchive(article)}
            className={`p-2 rounded-xl hover:bg-black/10 transition ${
              isArchived ? 'text-emerald-500' : 'opacity-80'
            }`}
            title={isArchived ? 'Move to Inbox' : 'Archive article'}
          >
            {isArchived ? (
              <ArchiveRestore className="w-4 h-4" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
          </button>

          {/* Open Original Link */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl hover:bg-black/10 transition opacity-80"
            title="Open original website"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </header>

      {/* Main Reading Canvas */}
      <main
        ref={contentRef}
        onClick={() => {
          if (showSettings) setShowSettings(false);
        }}
        className="flex-1 overflow-y-auto px-4 py-8 md:py-12"
      >
        <div className="max-w-[680px] mx-auto">
          {/* Article Header Metadata */}
          <div className="mb-8 pb-6 border-b border-black/10">
            {/* Domain & Reading Time */}
            <div className="flex items-center gap-3 text-xs font-semibold opacity-70 mb-3">
              <span className="flex items-center gap-1.5 text-rose-500">
                <Globe className="w-3.5 h-3.5" />
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
              {article.byline && <div>By {article.byline}</div>}
              <div>Saved on {new Date(article.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
            </div>
          </div>

          {/* Lead Image (if present) */}
          {article.lead_image_url && (
            <div className="mb-8 rounded-2xl overflow-hidden shadow-lg">
              <img
                src={article.lead_image_url}
                alt={article.title}
                className="w-full max-h-[420px] object-cover"
                loading="eager"
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
