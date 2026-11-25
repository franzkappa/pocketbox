'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  Minus,
  Plus,
  Type,
} from 'lucide-react';
import type { SharedArticle } from '@/lib/types';

interface SharedArticleReaderProps {
  article: SharedArticle;
}

type Theme = 'paper' | 'sepia' | 'slate' | 'oled';
type FontFamily = 'serif' | 'sans' | 'mono';

export function SharedArticleReader({ article }: SharedArticleReaderProps) {
  const [theme, setTheme] = useState<Theme>('paper');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [fontSize, setFontSize] = useState<number>(19);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  const contentRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);

  const isNewsletter = article.source_type === 'newsletter';

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('pocketbox_theme') as Theme | null;
      const savedFont = localStorage.getItem('pocketbox_font') as FontFamily | null;
      const savedSize = localStorage.getItem('pocketbox_size');
      if (savedTheme && ['paper', 'sepia', 'slate', 'oled'].includes(savedTheme)) {
        setTheme(savedTheme);
      }
      if (savedFont && ['serif', 'sans', 'mono'].includes(savedFont)) {
        setFontFamily(savedFont);
      }
      if (savedSize) {
        const parsed = Number(savedSize);
        if (!Number.isNaN(parsed)) {
          setFontSize(Math.min(28, Math.max(14, parsed)));
        }
      }
    } catch {
      // ignore localStorage access errors
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

  useEffect(() => {
    if (!showSettings) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSettings(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings]);

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

  useEffect(() => {
    if (!contentRef.current) return;
    const imgs = contentRef.current.querySelectorAll('.reader-content img');
    imgs.forEach((img) => {
      if (!img.getAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
    });
  }, [article.content_html]);

  const themeClasses: Record<
    Theme,
    { bg: string; text: string; header: string; card: string; border: string }
  > = {
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

  const savedDate = article.created_at
    ? new Date(article.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })
    : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col select-text ${currentTheme.bg} ${currentTheme.text} transition-colors duration-200`}
    >
      {/* Top Header Bar */}
      <header
        className={`sticky top-0 z-40 pt-safe border-b backdrop-blur-md transition-colors ${currentTheme.header}`}
      >
        <div className="h-12 sm:h-14 px-3 sm:px-5 max-w-[820px] mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Bookmark className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold tracking-tight">PocketBox</span>
              <span className="text-[11px] font-medium opacity-60 hidden xs:inline truncate">
                • {isNewsletter ? 'Saved newsletter' : 'Saved article'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 sm:p-2.5 rounded-xl hover:bg-black/10 transition touch-manipulation min-w-[38px] min-h-[38px] flex items-center justify-center"
                title="Typography & Theme settings"
                aria-label="Typography settings"
              >
                <Type className="w-4 h-4" />
              </button>

              {showSettings && (
                <div
                  className={`absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] p-4 rounded-2xl shadow-2xl border ${currentTheme.card} ${currentTheme.border} ${currentTheme.text} z-50`}
                >
                  <div className="text-xs font-bold uppercase tracking-wider mb-3 opacity-60">
                    Reader Appearance
                  </div>

                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2">Theme</div>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => updateTheme('paper')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#FCFCFC] text-[#1C1C1E] ${
                          theme === 'paper' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-slate-300'
                        }`}
                        title="Light"
                      >
                        Aa
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTheme('sepia')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#F8F1E5] text-[#3E2723] ${
                          theme === 'sepia' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-[#EBDCC7]'
                        }`}
                        title="Sepia"
                      >
                        Aa
                      </button>
                      <button
                        type="button"
                        onClick={() => updateTheme('slate')}
                        className={`h-9 rounded-xl border flex items-center justify-center font-bold text-xs bg-[#181C22] text-[#DDE2E8] ${
                          theme === 'slate' ? 'ring-2 ring-rose-500 border-rose-500' : 'border-[#262D37]'
                        }`}
                        title="Slate"
                      >
                        Aa
                      </button>
                      <button
                        type="button"
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

                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2">Font Style</div>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => updateFontFamily('serif')}
                        className={`py-1.5 px-2 rounded-lg font-serif border ${
                          fontFamily === 'serif' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Serif
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFontFamily('sans')}
                        className={`py-1.5 px-2 rounded-lg font-sans border ${
                          fontFamily === 'sans' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Sans
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFontFamily('mono')}
                        className={`py-1.5 px-2 rounded-lg font-mono border ${
                          fontFamily === 'mono' ? 'bg-rose-500 text-white border-rose-500' : 'border-black/10'
                        }`}
                      >
                        Mono
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold mb-2 flex justify-between">
                      <span>Size</span>
                      <span className="opacity-60">{fontSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateFontSize(-1)}
                        className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs touch-manipulation min-h-[36px]"
                        aria-label="Decrease font size"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateFontSize(1)}
                        className="flex-1 py-1.5 rounded-lg border border-black/10 hover:bg-black/10 flex items-center justify-center font-semibold text-xs touch-manipulation min-h-[36px]"
                        aria-label="Increase font size"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {article.original_url && (
              <a
                href={article.original_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-black/10 transition text-xs font-semibold opacity-85 hover:opacity-100 touch-manipulation min-h-[38px]"
                title={isNewsletter ? 'Open newsletter web version' : 'Open original article'}
                aria-label={isNewsletter ? 'Open newsletter web version' : 'Open original article'}
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  {isNewsletter ? 'Web version' : 'Original'}
                </span>
              </a>
            )}
          </div>
        </div>

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
        <article className="max-w-[680px] mx-auto">
          <div className="mb-8 pb-6 border-b border-black/10">
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold opacity-75 mb-3">
              {isNewsletter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-500 border border-indigo-500/25">
                  <Mail className="w-3 h-3" />
                  <span>Newsletter</span>
                </span>
              )}
              {article.site_name && (
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
                  <span>{article.site_name}</span>
                </span>
              )}
              {article.site_name && <span>•</span>}
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{article.reading_time_minutes} min read</span>
              </span>
            </div>

            <h1
              className={`font-bold leading-tight tracking-tight mb-4 ${fontClass}`}
              style={{ fontSize: `${Math.round(fontSize * 1.55)}px` }}
            >
              {article.title}
            </h1>

            <div className="text-xs opacity-70 space-y-1">
              {article.byline && (
                <div>{isNewsletter ? `From ${article.byline}` : `By ${article.byline}`}</div>
              )}
              {savedDate && <div>Saved on {savedDate}</div>}
            </div>

            {article.original_url && (
              <div className="mt-4">
                <a
                  href={article.original_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 max-w-full px-3 py-1.5 rounded-xl border text-xs font-medium opacity-85 hover:opacity-100 transition ${currentTheme.card} ${currentTheme.border}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span className="shrink-0 font-semibold">
                    {isNewsletter ? 'Web version:' : 'Original article:'}
                  </span>
                  <span className="truncate underline underline-offset-2">
                    {article.original_url}
                  </span>
                </a>
              </div>
            )}
          </div>

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

          <div
            className={`reader-content ${fontClass}`}
            style={{ fontSize: `${fontSize}px` }}
            dangerouslySetInnerHTML={{
              __html: article.content_html || `<p>${article.excerpt || ''}</p>`,
            }}
          />

          <footer className="mt-16 pt-8 border-t border-black/10 text-center opacity-60 text-xs pb-12">
            Saved copy shared via PocketBox
          </footer>
        </article>
      </main>
    </div>
  );
}
