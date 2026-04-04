declare module 'epubjs' {
  type Rendition = {
    display: (target?: string) => Promise<void>;
    prev: () => Promise<void>;
    next: () => Promise<void>;
    views?: {
      forEach?: (cb: (view: { document?: Document }) => void) => void;
    };
    destroy?: () => void;
    on?: (event: string, cb: (payload: any) => void) => void;
    off?: (event: string, cb: (payload: any) => void) => void;
    themes?: {
      fontSize?: (value: string) => void;
      default?: (rules: Record<string, Record<string, string>>) => void;
      select?: (name: string) => void;
    };
  };

  type Book = {
    ready: Promise<void>;
    loaded: {
      navigation: Promise<{ toc?: unknown }>;
    };
    renderTo: (element: HTMLElement, options: { width: string; height: string }) => Rendition;
    destroy?: () => void;
  };

  export default function ePub(
    input: string | ArrayBuffer,
    options?: {
      openAs?: 'binary' | 'base64' | 'epub' | 'opf' | 'json' | 'directory' | undefined;
      encoding?: 'binary' | 'base64' | undefined;
      replacements?: 'base64' | 'blobUrl' | 'none' | undefined;
    }
  ): Book;
}
