'use client';

import { useState, useEffect, useCallback, RefObject } from 'react';
import { flatRegistry } from '../registry';
import { PROPS_CACHE_TTL_MS } from '../lib/constants';
const propsCache = new Map<string, { ts: number; props: Record<string, unknown> }>();

// ---------------------------------------------------------------------------
// useAsyncProps – loads props via registryItem.getProps with caching
// ---------------------------------------------------------------------------

export interface AsyncPropsState {
  resolvedProps: Record<string, unknown> | null;
  isLoadingProps: boolean;
  propsError: string | null;
}

export function useAsyncProps(registryId: string): AsyncPropsState {
  const [resolvedProps, setResolvedProps] = useState<Record<string, unknown> | null>(null);
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [propsError, setPropsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const registryItem = flatRegistry[registryId];

    async function load() {
      setPropsError(null);

      if (!registryItem?.getProps) {
        setResolvedProps(null);
        setIsLoadingProps(false);
        return;
      }

      const cacheKey = registryId;
      const cached = propsCache.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.ts < PROPS_CACHE_TTL_MS) {
        setResolvedProps(cached.props);
        setIsLoadingProps(false);
        return;
      }

      setIsLoadingProps(true);
      try {
        const next = await Promise.resolve(registryItem.getProps());
        if (cancelled) return;
        propsCache.set(cacheKey, { ts: Date.now(), props: next });
        setResolvedProps(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load props';
        setPropsError(msg);
        setResolvedProps(null);
      } finally {
        if (!cancelled) setIsLoadingProps(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [registryId]);

  return { resolvedProps, isLoadingProps, propsError };
}

// ---------------------------------------------------------------------------
// useHtmlContent – fetches HTML and injects selection bridge script for srcdoc
// ---------------------------------------------------------------------------

export function useHtmlContent(htmlUrl: string, isHtml: boolean) {
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    if (!isHtml || !htmlUrl) {
      setHtmlContent('');
      return;
    }
    let cancelled = false;
    fetch(htmlUrl)
      .then((r) => r.text())
      .then((html) => {
        if (cancelled) return;
        // Dynamically import to keep the bridge module out of the initial bundle
        // when not needed (non-HTML nodes)
        import('../lib/iframe-selection-bridge').then(({ injectBridgeScript }) => {
          if (cancelled) return;
          setHtmlContent(injectBridgeScript(html));
        });
      })
      .catch(() => {
        if (!cancelled) setHtmlContent('');
      });
    return () => { cancelled = true; };
  }, [htmlUrl, isHtml]);

  return htmlContent;
}

// ---------------------------------------------------------------------------
// useScrollCapture – captures wheel events when the container can scroll
// ---------------------------------------------------------------------------

export function useScrollCapture(containerRef: RefObject<HTMLDivElement | null>) {
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = container;
      const isScrollableY = scrollHeight > clientHeight;
      const isScrollableX = scrollWidth > clientWidth;

      const canScrollUp = scrollTop > 0;
      const canScrollDown = scrollTop < scrollHeight - clientHeight;
      const canScrollLeft = scrollLeft > 0;
      const canScrollRight = scrollLeft < scrollWidth - clientWidth;

      const isScrollingDown = e.deltaY > 0;
      const isScrollingUp = e.deltaY < 0;
      const isScrollingRight = e.deltaX > 0;
      const isScrollingLeft = e.deltaX < 0;

      const shouldCapture =
        (isScrollableY && ((isScrollingDown && canScrollDown) || (isScrollingUp && canScrollUp))) ||
        (isScrollableX && ((isScrollingRight && canScrollRight) || (isScrollingLeft && canScrollLeft)));

      if (shouldCapture) {
        e.stopPropagation();
      }
    },
    [containerRef],
  );

  return handleWheel;
}
