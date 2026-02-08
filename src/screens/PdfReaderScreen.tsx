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

  const commitPageInput = React.useCallback(() => {
    const trimmed = pageInputValue.trim();
    if (!/^\d+$/.test(trimmed)) {
      setPageInputError('Enter a whole page number.');
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isInteger(parsed)) {
      setPageInputError('Enter a valid page number.');
      return;
    }

    if (parsed < 1 || parsed > pageCount) {
      setPageInputError(`Page must be between 1 and ${pageCount}.`);
      return;
    }

    setPage(parsed);
    setPageInputError(null);
  }, [pageInputValue, pageCount]);

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

  return (
    <Card className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={onBack} disabled={loading}>
            Back to Library
          </Button>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={loading || rendering || page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={loading || rendering || page >= pageCount}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="ml-2 flex items-center gap-2">
            <label htmlFor="page-input" className="text-sm text-muted-foreground">
              Page
            </label>
            <Input
              id="page-input"
              value={pageInputValue}
              onChange={(event) => setPageInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitPageInput();
                }
              }}
              onBlur={commitPageInput}
              aria-label="Page number"
              className="h-8 w-20"
              inputMode="numeric"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(1))))}
              disabled={loading || rendering}
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
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {pageInputError ? <p className="text-xs text-destructive">{pageInputError}</p> : null}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!error ? (
          <div className="relative flex w-full items-center justify-center py-4">
            <button
              type="button"
              className="absolute bottom-0 left-0 top-0 z-20 w-1/5 cursor-pointer bg-gradient-to-r from-black/5 to-transparent transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Previous page"
              onClick={goPrev}
              disabled={loading || rendering || page <= 1}
            />
            <button
              type="button"
              className="absolute bottom-0 right-0 top-0 z-20 w-1/5 cursor-pointer bg-gradient-to-l from-black/5 to-transparent transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Next page"
              onClick={goNext}
              disabled={loading || rendering || page >= pageCount}
            />
            {rendering ? <p className="text-sm text-muted-foreground">Rendering...</p> : null}
            <canvas ref={canvasRef} className={rendering ? 'hidden' : 'block shadow-md'} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
