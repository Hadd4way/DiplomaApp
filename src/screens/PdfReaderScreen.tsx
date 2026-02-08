import * as React from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [scale, setScale] = React.useState(1);
  const [rendering, setRendering] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={loading || rendering || page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={loading || rendering || page >= pageCount}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>
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
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/20">
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!error ? (
          <div className="flex items-center justify-center py-4">
            {rendering ? <p className="text-sm text-muted-foreground">Rendering...</p> : null}
            <canvas ref={canvasRef} className={rendering ? 'hidden' : 'block shadow-md'} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
