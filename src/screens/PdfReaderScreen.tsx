import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ListTree,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus
} from 'lucide-react';
import { type PdfOutlineItem } from '@/components/outline-tree';
import { PdfSidebar } from '@/components/pdf-sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker?url';

GlobalWorkerOptions.workerSrc = workerSrc;

type Props = {
  title: string;
  base64: string;
  loading: boolean;
  onBack: () => void;
};

type ScaleMode = 'fitWidth' | 'manual';

function clampScale(nextScale: number): number {
  return Math.min(2.5, Math.max(0.5, nextScale));
}

function computeFitWidthScale(basePageWidth: number, availableWidth: number): number {
  if (basePageWidth <= 0 || availableWidth <= 0) {
    return 1;
  }
  return clampScale(availableWidth / basePageWidth);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeOutlineItems(items: unknown): PdfOutlineItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const node = item as { title?: string; dest?: unknown; items?: unknown };
    return {
      title: node.title ?? '',
      dest: node.dest,
      items: normalizeOutlineItems(node.items)
    };
  });
}

export function PdfReaderScreen({ title, base64, loading, onBack }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pageStageRef = React.useRef<HTMLDivElement | null>(null);
  const pageInputRef = React.useRef<HTMLInputElement | null>(null);
  const readerViewportRef = React.useRef<HTMLElement | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(1);
  const [pageInputValue, setPageInputValue] = React.useState('1');
  const [pageInputError, setPageInputError] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [scaleMode, setScaleMode] = React.useState<ScaleMode>('fitWidth');
  const [fitWidthReady, setFitWidthReady] = React.useState(false);
  const [canvasWidth, setCanvasWidth] = React.useState<number>(0);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [outlineItems, setOutlineItems] = React.useState<PdfOutlineItem[]>([]);
  const [outlineLoading, setOutlineLoading] = React.useState(false);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const outlinePageCacheRef = React.useRef<Map<string, number>>(new Map());

  const goPrev = React.useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goNext = React.useCallback(() => {
    setPage((prev) => Math.min(pageCount, prev + 1));
  }, [pageCount]);

  const tryJumpToPage = React.useCallback(
    (rawValue: string): boolean => {
      const trimmed = rawValue.trim();
      if (!/^\d+$/.test(trimmed)) {
        setPageInputError('Enter a whole page number.');
        return false;
      }

      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isInteger(parsed)) {
        setPageInputError('Enter a valid page number.');
        return false;
      }

      const clamped = Math.min(pageCount, Math.max(1, parsed));
      setPage(clamped);
      setPageInputError(null);
      setPageInputValue(String(clamped));
      return true;
    },
    [pageCount]
  );

  React.useEffect(() => {
    let canceled = false;

    const loadDocument = async () => {
      setError(null);
      setRendering(true);
      setScaleMode('fitWidth');
      setScale(1);
      setFitWidthReady(false);
      setCanvasWidth(0);
      try {
        const data = base64ToUint8Array(base64);
        const loadedDoc = await getDocument({ data }).promise;
        if (canceled) {
          return;
        }
        setDoc(loadedDoc);
        setPage(1);
        setPageCount(loadedDoc.numPages);
      } catch {
        if (!canceled) {
          setError('Failed to load PDF.');
        }
      } finally {
        if (!canceled) {
          setRendering(false);
        }
      }
    };

    void loadDocument();
    return () => {
      canceled = true;
    };
  }, [base64]);

  React.useEffect(() => {
    const viewportElement = readerViewportRef.current;
    if (!viewportElement) {
      return;
    }

    const updateWidth = () => {
      setViewportWidth(viewportElement.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        setViewportWidth(entry.contentRect.width);
      });
      observer.observe(viewportElement);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  React.useEffect(() => {
    let canceled = false;

    const applyFitWidthScale = async () => {
      if (!doc) {
        return;
      }

      if (scaleMode !== 'fitWidth') {
        setFitWidthReady(true);
        return;
      }

      if (viewportWidth <= 0) {
        return;
      }

      try {
        const pdfPage = await doc.getPage(page);
        if (canceled) {
          return;
        }

        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const nextScale = computeFitWidthScale(baseViewport.width, Math.max(1, viewportWidth - 72));
        setScale((prev) => (Math.abs(prev - nextScale) < 0.001 ? prev : nextScale));
        setFitWidthReady(true);
      } catch {
        setFitWidthReady(true);
      }
    };

    void applyFitWidthScale();

    return () => {
      canceled = true;
    };
  }, [doc, page, scaleMode, viewportWidth]);

  React.useEffect(() => {
    let canceled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;

    const renderPage = async () => {
      if (!doc || !canvasRef.current) {
        return;
      }

      if (scaleMode === 'fitWidth' && !fitWidthReady) {
        return;
      }

      setRendering(true);
      setError(null);
      try {
        const pdfPage = await doc.getPage(page);
        if (canceled || !canvasRef.current) {
          return;
        }

        const viewport = pdfPage.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) {
          setError('Canvas is not available.');
          return;
        }

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        setCanvasWidth(viewport.width);
        renderTask = pdfPage.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const normalized = message.toLowerCase();
        const isCanceled = normalized.includes('cancel') || normalized.includes('multiple render() operations');
        if (!canceled && !isCanceled) {
          setError('Failed to render PDF page.');
        }
      } finally {
        if (!canceled) {
          setRendering(false);
        }
      }
    };

    void renderPage();
    return () => {
      canceled = true;
      renderTask?.cancel();
    };
  }, [doc, fitWidthReady, page, scale, scaleMode]);

  React.useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

  React.useEffect(() => {
    let canceled = false;

    const loadOutline = async () => {
      if (!doc) {
        setOutlineItems([]);
        return;
      }

      setOutlineLoading(true);
      outlinePageCacheRef.current.clear();
      try {
        const outline = await doc.getOutline();
        if (!canceled) {
          setOutlineItems(normalizeOutlineItems(outline));
        }
      } catch {
        if (!canceled) {
          setOutlineItems([]);
        }
      } finally {
        if (!canceled) {
          setOutlineLoading(false);
        }
      }
    };

    void loadOutline();
    return () => {
      canceled = true;
    };
  }, [doc]);

  const resolveOutlineItemPage = React.useCallback(
    async (item: PdfOutlineItem, key: string): Promise<number | null> => {
      if (!doc) {
        return null;
      }

      const cached = outlinePageCacheRef.current.get(key);
      if (cached) {
        return cached;
      }

      let destArray: unknown[] | null = null;
      if (typeof item.dest === 'string') {
        destArray = (await doc.getDestination(item.dest)) as unknown[] | null;
      } else if (Array.isArray(item.dest)) {
        destArray = item.dest as unknown[];
      } else {
        return null;
      }

      if (!destArray || destArray.length === 0) {
        return null;
      }

      const pageRef = destArray[0];
      if (!pageRef) {
        return null;
      }

      try {
        const pageIndex = await doc.getPageIndex(pageRef as Parameters<PDFDocumentProxy['getPageIndex']>[0]);
        const pageNumber = pageIndex + 1;
        outlinePageCacheRef.current.set(key, pageNumber);
        return pageNumber;
      } catch {
        return null;
      }
    },
    [doc]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isTextInput =
        activeElement?.tagName === 'INPUT' ||
        activeElement?.tagName === 'TEXTAREA' ||
        activeElement?.isContentEditable === true;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        pageInputRef.current?.focus();
        pageInputRef.current?.select();
        return;
      }

      if (event.key === 'Escape') {
        if (activeElement === pageInputRef.current) {
          pageInputRef.current?.blur();
        }
        return;
      }

      if (isTextInput) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        setPage(1);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        setPage(pageCount);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goNext, goPrev, pageCount]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#f3f5f7]">
      <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={loading}>
            Back
          </Button>

          <div className="min-w-0 max-w-[320px] flex-1 px-2">
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
          </div>

          <div className="ml-auto flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
            <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={loading || page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input
              ref={pageInputRef}
              value={pageInputValue}
              onChange={(event) => {
                setPageInputValue(event.target.value.replace(/\D+/g, ''));
                setPageInputError(null);
              }}
              onFocus={() => pageInputRef.current?.select()}
              onBlur={() => {
                const trimmed = pageInputValue.trim();
                if (trimmed.length === 0) {
                  setPageInputValue(String(page));
                  setPageInputError(null);
                  return;
                }
                const ok = tryJumpToPage(trimmed);
                if (!ok) {
                  setPageInputValue(String(page));
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const ok = tryJumpToPage(pageInputValue);
                  if (ok) {
                    pageInputRef.current?.blur();
                  }
                }
              }}
              className="h-8 w-14 border-slate-300 text-center text-sm"
              disabled={loading || rendering}
              aria-label="Page number"
              inputMode="numeric"
            />
            <span className="px-1 text-xs text-slate-600">/ {pageCount}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goNext}
              disabled={loading || page >= pageCount}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="ml-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScaleMode('manual');
                setScale((prev) => clampScale(Number((prev - 0.1).toFixed(1))));
              }}
              disabled={loading || rendering}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-16 text-center text-xs font-medium text-slate-700">
              {scaleMode === 'fitWidth' ? 'Fit' : `${Math.round(scale * 100)}%`}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScaleMode('fitWidth')}
              disabled={loading || rendering}
            >
              Fit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScaleMode('manual');
                setScale(1);
              }}
              disabled={loading || rendering}
            >
              100%
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setScaleMode('manual');
                setScale((prev) => clampScale(Number((prev + 0.1).toFixed(1))));
              }}
              disabled={loading || rendering}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? 'Hide contents' : 'Show contents'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
        </div>
        {pageInputError ? <p className="px-4 pb-2 text-xs text-destructive">{pageInputError}</p> : null}
      </header>

      <main className="flex w-full flex-1 min-h-0 min-w-0">
        {sidebarOpen ? (
          <div className="h-full w-[300px] shrink-0 border-r border-slate-200 bg-white">
            <PdfSidebar
              outlineItems={outlineItems}
              outlineLoading={outlineLoading}
              onOutlineSelect={async (item, key) => {
                const resolvedPage = await resolveOutlineItemPage(item, key);
                if (!resolvedPage) {
                  return;
                }
                setPage(resolvedPage);
                setPageInputError(null);
              }}
            />
          </div>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col bg-[#eef1f5]">
          <div ref={readerViewportRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
            <div className="w-full min-h-full flex justify-center px-8 py-6">
              <div
                ref={pageStageRef}
                className="group relative"
                style={{ width: canvasWidth > 0 ? `${canvasWidth}px` : 'auto', maxWidth: '100%' }}
              >
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {!error ? (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-2 text-slate-700 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Previous page"
                      title="Previous page"
                      onClick={goPrev}
                      disabled={loading || rendering || page <= 1}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full border border-slate-300 bg-white/95 p-2 text-slate-700 opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Next page"
                      title="Next page"
                      onClick={goNext}
                      disabled={loading || rendering || page >= pageCount}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>

                    {rendering ? (
                      <div className="pointer-events-none absolute right-3 top-3 z-30 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-2 py-1 text-xs text-slate-600 shadow-sm">
                        <ListTree className="h-3.5 w-3.5" />
                        Rendering...
                      </div>
                    ) : null}

                    <div className="overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.5)]">
                      <canvas ref={canvasRef} className="block" />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
