import * as React from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function PdfReaderScreen({ title, base64, loading, onBack }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const pageInputRef = React.useRef<HTMLInputElement | null>(null);
  const [doc, setDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(1);
  const [pageInputValue, setPageInputValue] = React.useState('1');
  const [pageInputError, setPageInputError] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    let canceled = false;

    const renderPage = async () => {
      if (!doc || !canvasRef.current) {
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
        await pdfPage.render({ canvasContext: context, viewport }).promise;
      } catch {
        if (!canceled) {
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
    };
  }, [doc, page, scale]);

  React.useEffect(() => {
    setPageInputValue(String(page));
  }, [page]);

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
          pageInputRef.current.blur();
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
    <Card className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
      <CardHeader className="space-y-1.5 pb-2">
        <div className="grid grid-cols-3 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start px-2.5"
            onClick={onBack}
            disabled={loading}
          >
            Back to Library
          </Button>
          <CardTitle className="text-center text-lg">{title}</CardTitle>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))))}
              disabled={loading || rendering}
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-14 text-center text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.min(3, Number((prev + 0.1).toFixed(1))))}
              disabled={loading || rendering}
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center gap-0">
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <label htmlFor="page-input" className="text-sm text-muted-foreground">
              Page
            </label>
            <Input
              ref={pageInputRef}
              id="page-input"
              value={pageInputValue}
              onChange={(event) => {
                setPageInputValue(event.target.value.replace(/\D+/g, ''));
                setPageInputError(null);
              }}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const ok = tryJumpToPage(pageInputValue);
                  if (ok) {
                    event.currentTarget.blur();
                  }
                }
              }}
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
              aria-label="Page number"
              className="h-8 w-20"
              inputMode="numeric"
            />
            <span className="text-sm text-muted-foreground">/ {pageCount}</span>
          </div>
          <div className="min-h-3">
            {pageInputError ? <p className="text-xs text-destructive">{pageInputError}</p> : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 p-4 pt-0">
        <section className="flex h-full min-h-0 flex-col items-center overflow-auto rounded-md bg-muted/20">
          <div className="flex w-full max-w-5xl flex-1 flex-col items-center justify-center">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {!error ? (
              <div className="group relative flex w-full items-center justify-center py-4">
                <button
                  type="button"
                  className="absolute bottom-0 left-0 top-0 z-20 w-[20%] cursor-pointer opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Previous page"
                  title="Previous page"
                  onClick={goPrev}
                  disabled={loading || rendering || page <= 1}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
                  <ChevronLeft className="pointer-events-none absolute left-3 top-1/2 h-6 w-6 -translate-y-1/2 text-foreground/70" />
                </button>
                <button
                  type="button"
                  className="absolute bottom-0 right-0 top-0 z-20 w-[20%] cursor-pointer opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Next page"
                  title="Next page"
                  onClick={goNext}
                  disabled={loading || rendering || page >= pageCount}
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/10 to-transparent" />
                  <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 text-foreground/70" />
                </button>
                {rendering ? <p className="text-sm text-muted-foreground">Rendering...</p> : null}
                <canvas ref={canvasRef} className={rendering ? 'hidden' : 'block shadow-md'} />
              </div>
            ) : null}
          </div>

          <div className="w-full max-w-5xl px-2 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={goPrev}
                disabled={loading || rendering || page <= 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={goNext}
                disabled={loading || rendering || page >= pageCount}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
