import * as React from 'react';
import { ChevronLeft, ChevronRight, ListTree, Minus, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ePub from 'epubjs';

type TocItem = {
  id?: string;
  label?: string;
  href?: string;
  subitems?: TocItem[];
};

type Props = {
  title: string;
  bookId: string;
  loading: boolean;
  onBack: () => void;
};

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function normalizeToc(items: unknown): TocItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const entry = item as { id?: string; label?: string; href?: string; subitems?: unknown };
    return {
      id: entry.id,
      label: entry.label,
      href: entry.href,
      subitems: normalizeToc(entry.subitems)
    };
  });
}

function TocTree({
  items,
  onSelect,
  level = 0,
  path = 'root'
}: {
  items: TocItem[];
  onSelect: (item: TocItem) => void;
  level?: number;
  path?: string;
}) {
  return (
    <ul className={level === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {items.map((item, index) => {
        const key = `${path}.${item.id ?? index}`;
        const title = (item.label ?? '').trim() || `Chapter ${index + 1}`;
        return (
          <li key={key}>
            <button
              type="button"
              className="w-full overflow-hidden text-wrap break-words rounded px-2 py-1 text-left text-sm whitespace-normal hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ paddingLeft: `${0.5 + level * 0.75}rem` }}
              onClick={() => onSelect(item)}
            >
              {title}
            </button>
            {item.subitems && item.subitems.length > 0 ? (
              <TocTree items={item.subitems} onSelect={onSelect} level={level + 1} path={key} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function EpubReaderScreen({ title, bookId, loading, onBack }: Props) {
  const readerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const bookRef = React.useRef<any>(null);
  const renditionRef = React.useRef<any>(null);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCfiRef = React.useRef<string | null>(null);
  const [tocItems, setTocItems] = React.useState<TocItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [fontPercent, setFontPercent] = React.useState(100);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  const persistCfi = React.useCallback(
    async (cfi: string) => {
      const safeCfi = cfi.trim();
      if (!safeCfi || !window.api) {
        return;
      }
      await window.api.epubProgress.set({ bookId, cfi: safeCfi });
    },
    [bookId]
  );

  const goPrev = React.useCallback(() => {
    renditionRef.current?.prev?.();
  }, []);

  const goNext = React.useCallback(() => {
    renditionRef.current?.next?.();
  }, []);

  React.useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) {
      return;
    }
    rendition.themes?.fontSize?.(`${fontPercent}%`);
  }, [fontPercent]);

  React.useEffect(() => {
    const container = readerContainerRef.current;
    if (!container) {
      return;
    }
    const prefix = `[epub:${bookId}]`;
    const t0 = performance.now();
    const log = (...args: unknown[]) => console.log(prefix, ...args);
    const warn = (...args: unknown[]) => console.warn(prefix, ...args);
    const elapsed = () => `${Math.round(performance.now() - t0)}ms`;

    let canceled = false;
    log('init:start', { at: new Date().toISOString() });
    setReady(false);
    setError(null);
    setTocItems([]);
    latestCfiRef.current = null;
    container.replaceChildren();

    const init = async () => {
      try {
        if (!window.api) {
          throw new Error('Renderer API is unavailable. Open this app via Electron.');
        }
        log('ipc:getEpubData:start');
        const epubDataResult = await window.api.books.getEpubData({ bookId });
        if (canceled) {
          log('init:aborted:after-getEpubData', { elapsed: elapsed() });
          return;
        }
        if (!epubDataResult.ok) {
          throw new Error(epubDataResult.error);
        }
        log('ipc:getEpubData:ok', {
          title: epubDataResult.title,
          base64Length: epubDataResult.base64.length,
          elapsed: elapsed()
        });
        const epubBytes = Uint8Array.from(atob(epubDataResult.base64), (char) => char.charCodeAt(0));
        log('epub:bytes:decoded', { byteLength: epubBytes.byteLength, elapsed: elapsed() });

        let startCfi: string | null = null;
        log('ipc:epubProgress:get:start');
        const progressResult = await withTimeout(
          window.api.epubProgress.get({ bookId }),
          4000,
          'Timed out while loading reading progress.'
        ).catch(() => null);
        if (canceled) {
          log('init:aborted:after-getProgress', { elapsed: elapsed() });
          return;
        }
        if (progressResult && progressResult.ok) {
          startCfi = progressResult.cfi;
        }
        log('ipc:epubProgress:get:done', { hasStartCfi: Boolean(startCfi), elapsed: elapsed() });

        const openCandidates: Array<{
          label: string;
          createBook: () => any;
        }> = [
          { label: 'array-buffer-binary', createBook: () => ePub(epubBytes.buffer, { openAs: 'binary' }) },
          { label: 'base64', createBook: () => ePub(epubDataResult.base64, { encoding: 'base64' }) }
        ];

        let lastOpenError: unknown = null;
        for (const candidate of openCandidates) {
          if (canceled) {
            return;
          }
          const candidateStart = performance.now();
          try {
            log('candidate:start', { candidate: candidate.label, elapsed: elapsed() });
            const book = candidate.createBook();
            const rendition = book.renderTo(container, {
              width: '100%',
              height: '100%'
            });
            bookRef.current = book;
            renditionRef.current = rendition;
            log('candidate:renderTo:ok', {
              candidate: candidate.label,
              elapsed: elapsed()
            });

            const onRelocated = (location: { start?: { cfi?: string } } | null | undefined) => {
              const cfi = location?.start?.cfi?.trim();
              if (!cfi) {
                return;
              }
              log('event:relocated', {
                candidate: candidate.label,
                cfi,
                elapsed: elapsed()
              });
              latestCfiRef.current = cfi;
              if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
              }
              saveTimerRef.current = setTimeout(() => {
                saveTimerRef.current = null;
                void persistCfi(cfi);
              }, 400);
            };
            rendition.on?.('relocated', onRelocated);
            const onRendered = (section: unknown) => {
              log('event:rendered', { candidate: candidate.label, section, elapsed: elapsed() });
            };
            const onDisplayError = (errorPayload: unknown) => {
              warn('event:displayError', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            rendition.on?.('rendered', onRendered);
            rendition.on?.('displayError', onDisplayError);
            const onBookError = (errorPayload: unknown) => {
              warn('event:bookError', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            const onOpenFailed = (errorPayload: unknown) => {
              warn('event:openFailed', { candidate: candidate.label, errorPayload, elapsed: elapsed() });
            };
            book.on?.('error', onBookError);
            book.on?.('openFailed', onOpenFailed);

            log('navigation:load:start', { candidate: candidate.label, elapsed: elapsed() });
            void withTimeout(
              book.loaded.navigation,
              8000,
              `EPUB contents load timed out (${candidate.label}).`
            )
              .then((navigation) => {
                if (!canceled) {
                  log('navigation:load:ok', {
                    candidate: candidate.label,
                    tocCount: normalizeToc((navigation as { toc?: unknown } | undefined)?.toc).length,
                    elapsed: elapsed()
                  });
                  setTocItems(normalizeToc((navigation as { toc?: unknown } | undefined)?.toc));
                }
              })
              .catch((navError) => {
                warn('navigation:load:error', {
                  candidate: candidate.label,
                  ...formatError(navError),
                  elapsed: elapsed()
                });
                if (!canceled) {
                  setTocItems([]);
                }
              });

            if (startCfi) {
              try {
                log('display:start', { candidate: candidate.label, target: 'startCfi', elapsed: elapsed() });
                await withTimeout(
                  rendition.display(startCfi),
                  20000,
                  `EPUB start position timed out (${candidate.label}).`
                );
                log('display:ok', { candidate: candidate.label, target: 'startCfi', elapsed: elapsed() });
              } catch {
                warn('display:startCfi:failed:fallback', { candidate: candidate.label, elapsed: elapsed() });
                log('display:start', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
                await withTimeout(rendition.display(), 20000, `EPUB first page timed out (${candidate.label}).`);
                log('display:ok', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
              }
            } else {
              log('display:start', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
              await withTimeout(rendition.display(), 20000, `EPUB first page timed out (${candidate.label}).`);
              log('display:ok', { candidate: candidate.label, target: 'default', elapsed: elapsed() });
            }

            if (!canceled) {
              setReady(true);
              rendition.themes?.fontSize?.(`${fontPercent}%`);
            }
            log('candidate:success', {
              candidate: candidate.label,
              candidateElapsed: `${Math.round(performance.now() - candidateStart)}ms`,
              elapsed: elapsed()
            });

            return () => {
              rendition.off?.('relocated', onRelocated);
              rendition.off?.('rendered', onRendered);
              rendition.off?.('displayError', onDisplayError);
              book.off?.('error', onBookError);
              book.off?.('openFailed', onOpenFailed);
            };
          } catch (candidateError) {
            lastOpenError = candidateError;
            warn('candidate:error', {
              candidate: candidate.label,
              ...formatError(candidateError),
              candidateElapsed: `${Math.round(performance.now() - candidateStart)}ms`,
              elapsed: elapsed()
            });
            renditionRef.current?.destroy?.();
            bookRef.current?.destroy?.();
            renditionRef.current = null;
            bookRef.current = null;
            container.replaceChildren();
          }
        }

        throw lastOpenError instanceof Error ? lastOpenError : new Error('Failed to load EPUB.');
      } catch (err) {
        if (canceled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        warn('init:error', { ...formatError(err), elapsed: elapsed() });
        setError(message || 'Failed to load EPUB.');
      }
    };
    let cleanupRelocated: (() => void) | undefined;
    void init().then((cleanupFn) => {
      cleanupRelocated = cleanupFn;
    });

    return () => {
      canceled = true;
      log('init:cleanup', { elapsed: elapsed() });
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (latestCfiRef.current) {
        void persistCfi(latestCfiRef.current);
      }
      cleanupRelocated?.();
      renditionRef.current?.destroy?.();
      bookRef.current?.destroy?.();
      renditionRef.current = null;
      bookRef.current = null;
    };
  }, [bookId, persistCfi]);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#f3f5f7]">
      <header className="shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-14 items-center gap-2 px-3">
          <Button type="button" variant="outline" size="sm" onClick={onBack} disabled={loading}>
            Back
          </Button>
          <div className="min-w-0 max-w-[420px] flex-1 px-2">
            <p className="truncate text-sm font-semibold text-slate-800">{title}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setSidebarOpen((prev) => !prev)}>
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <div className="ml-2 flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFontPercent((prev) => Math.max(80, prev - 10))}
              disabled={!ready}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-16 text-center text-xs font-medium text-slate-700">{`${fontPercent}%`}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFontPercent((prev) => Math.min(180, prev + 10))}
              disabled={!ready}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex w-full flex-1 min-h-0 min-w-0">
        {sidebarOpen ? (
          <aside className="h-full w-[300px] shrink-0 border-r border-slate-200 bg-white">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contents</h3>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
                {tocItems.length > 0 ? (
                  <TocTree
                    items={tocItems}
                    onSelect={(item) => {
                      if (!item.href) {
                        return;
                      }
                      void renditionRef.current?.display?.(item.href);
                    }}
                  />
                ) : (
                  <p className="px-2 py-1 text-sm text-slate-500">No table of contents found.</p>
                )}
              </div>
            </div>
          </aside>
        ) : null}

        <div className="relative flex min-h-0 min-w-0 flex-1 bg-[#eef1f5]">
          <div className="flex h-full w-full items-center justify-center p-4">
            <div className="relative h-full w-full max-w-5xl overflow-hidden rounded-sm border border-slate-300 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.5)]">
              <div ref={readerContainerRef} className="h-full w-full" />
            </div>
          </div>
          {error ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-700">{error}</p>
            </div>
          ) : null}
        </div>
      </main>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={goPrev} disabled={!ready}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Prev
          </Button>
          <div className="inline-flex items-center gap-2 text-xs text-slate-600">
            <ListTree className="h-3.5 w-3.5" />
            {ready ? 'Ready' : 'Loading EPUB...'}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={goNext} disabled={!ready}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
