'use client';

import React, { useRef, useEffect } from 'react';
import { RefreshCw, Check } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  children: React.ReactNode;
  className?: string;
  as?: 'main' | 'div';
}

export function PullToRefresh({
  onRefresh,
  isRefreshing,
  children,
  className = '',
  as: Component = 'main',
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<SVGSVGElement | null>(null);
  const checkIconRef = useRef<SVGSVGElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentPullRef = useRef(0);
  const canPullRef = useRef(false);
  const isPullRefreshingRef = useRef(false);
  const hasVibratedRef = useRef(false);

  const THRESHOLD = 65;
  const MAX_PULL = 90;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore multi-touch or if already refreshing
      if (e.touches.length !== 1 || isPullRefreshingRef.current) return;

      // Only allow pull-down if container is scrolled all the way to the top
      if (container.scrollTop <= 0) {
        canPullRef.current = true;
        startYRef.current = e.touches[0].clientY;
        startXRef.current = e.touches[0].clientX;
        currentPullRef.current = 0;
        hasVibratedRef.current = false;

        if (indicatorRef.current) {
          indicatorRef.current.style.transition = 'none';
        }
      } else {
        canPullRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPullRef.current || isPullRefreshingRef.current || e.touches.length !== 1) return;

      if (container.scrollTop > 0) {
        canPullRef.current = false;
        if (indicatorRef.current) {
          indicatorRef.current.style.height = '0px';
          indicatorRef.current.style.opacity = '0';
        }
        return;
      }

      const touch = e.touches[0];
      const dy = touch.clientY - startYRef.current;
      const dx = touch.clientX - startXRef.current;

      // If user is swiping horizontally, cancel pull
      if (Math.abs(dx) > Math.abs(dy)) {
        canPullRef.current = false;
        return;
      }

      // If user drags up, abort immediately
      if (dy < 0) {
        canPullRef.current = false;
        return;
      }

      // User is dragging down from top
      if (dy > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }

        // Apply damping resistance
        const pull = Math.min(MAX_PULL, dy * 0.45);
        currentPullRef.current = pull;

        if (indicatorRef.current) {
          indicatorRef.current.style.height = `${pull}px`;
          indicatorRef.current.style.opacity = `${Math.min(1, pull / 25)}`;
        }

        if (pillRef.current) {
          const scale = Math.min(1, 0.75 + (pull / THRESHOLD) * 0.25);
          pillRef.current.style.transform = `scale(${scale})`;
        }

        if (iconRef.current) {
          const rotation = Math.min(360, (pull / THRESHOLD) * 270);
          iconRef.current.style.transform = `rotate(${rotation}deg)`;
        }

        if (pull >= THRESHOLD) {
          if (textRef.current) textRef.current.textContent = 'Rilascia per aggiornare';
          if (pillRef.current) {
            pillRef.current.classList.add('border-rose-500/80', 'text-white', 'shadow-rose-500/20');
          }
          if (iconRef.current) {
            iconRef.current.classList.add('text-rose-400');
          }
          if (window.navigator?.vibrate && !hasVibratedRef.current) {
            window.navigator.vibrate(10);
            hasVibratedRef.current = true;
          }
        } else {
          if (textRef.current) textRef.current.textContent = 'Trascina per aggiornare';
          if (pillRef.current) {
            pillRef.current.classList.remove('border-rose-500/80', 'text-white', 'shadow-rose-500/20');
          }
          if (iconRef.current) {
            iconRef.current.classList.remove('text-rose-400');
          }
          hasVibratedRef.current = false;
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!canPullRef.current || isPullRefreshingRef.current) return;
      canPullRef.current = false;

      const pull = currentPullRef.current;
      currentPullRef.current = 0;

      if (indicatorRef.current) {
        indicatorRef.current.style.transition = 'height 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';
      }

      if (pull >= THRESHOLD) {
        isPullRefreshingRef.current = true;
        if (indicatorRef.current) {
          indicatorRef.current.style.height = '48px';
          indicatorRef.current.style.opacity = '1';
        }
        if (textRef.current) {
          textRef.current.textContent = 'Aggiornamento...';
        }
        if (iconRef.current) {
          iconRef.current.classList.add('animate-spin', 'text-rose-400');
          iconRef.current.style.transform = '';
        }

        try {
          await onRefresh();
          // Subtle success indicator
          if (textRef.current) {
            textRef.current.textContent = 'Aggiornato!';
          }
          if (iconRef.current) {
            iconRef.current.style.display = 'none';
          }
          if (checkIconRef.current) {
            checkIconRef.current.style.display = 'block';
          }
          await new Promise((r) => setTimeout(r, 350));
        } catch {
          // In case of error, still close gracefully
        } finally {
          if (indicatorRef.current) {
            indicatorRef.current.style.height = '0px';
            indicatorRef.current.style.opacity = '0';
          }
          setTimeout(() => {
            if (iconRef.current) {
              iconRef.current.classList.remove('animate-spin');
              iconRef.current.style.display = 'block';
              iconRef.current.style.transform = '';
            }
            if (checkIconRef.current) {
              checkIconRef.current.style.display = 'none';
            }
            if (textRef.current) {
              textRef.current.textContent = 'Trascina per aggiornare';
            }
            isPullRefreshingRef.current = false;
          }, 250);
        }
      } else {
        if (indicatorRef.current) {
          indicatorRef.current.style.height = '0px';
          indicatorRef.current.style.opacity = '0';
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [onRefresh]);

  return (
    <Component ref={containerRef as any} className={className}>
      {/* Pull down indicator pill */}
      <div
        ref={indicatorRef}
        style={{ height: '0px', opacity: 0 }}
        className="w-full flex items-center justify-center overflow-hidden pointer-events-none select-none flex-shrink-0"
        aria-hidden="true"
      >
        <div
          ref={pillRef}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-slate-700/80 shadow-xl text-slate-300 text-xs font-medium backdrop-blur-md transition-colors"
        >
          <RefreshCw
            ref={iconRef}
            className="w-3.5 h-3.5 text-slate-400 transition-colors"
          />
          <Check
            ref={checkIconRef}
            style={{ display: 'none' }}
            className="w-3.5 h-3.5 text-emerald-400"
          />
          <span ref={textRef} className="text-[11px] font-medium tracking-tight">
            Trascina per aggiornare
          </span>
        </div>
      </div>

      {children}
    </Component>
  );
}
