declare module 'epubjs' {
  type Contents = {
    document: Document;
    window: Window;
  };

  type Annotation = unknown;

  type Annotations = {
    add: (
      type: string,
      cfiRange: string,
      data?: object,
      cb?: ((event: Event) => void) | null,
      className?: string,
      styles?: object
    ) => Annotation;
    remove: (cfiRange: string, type: string) => void;
  };

  type Rendition = {
    display: (target?: string) => Promise<void>;
    prev: () => Promise<void>;
    next: () => Promise<void>;
    getRange: (cfi: string, ignoreClass?: string) => Range;
    views?: {
      forEach?: (cb: (view: { document?: Document }) => void) => void;
    };
    destroy?: () => void;
    on?: (event: string, cb: (...payload: any[]) => void) => void;
    off?: (event: string, cb: (...payload: any[]) => void) => void;
    themes?: {
      fontSize?: (value: string) => void;
      default?: (rules: Record<string, Record<string, string>>) => void;
      select?: (name: string) => void;
    };
    annotations?: Annotations;
  };

  type SectionSearchMatch = {
    cfi?: string;
    excerpt?: string;
  };

  type Section = {
    href: string;
    index: number;
    load: (request?: (path: string) => Promise<unknown>) => Promise<unknown>;
    unload?: () => void;
    search?: (query: string, maxSeqEle?: number) => SectionSearchMatch[];
    find?: (query: string) => SectionSearchMatch[];
  };

  type Book = {
    ready: Promise<void>;
    load: (path: string) => Promise<unknown>;
    locations?: {
      generate?: (chars?: number) => Promise<void>;
      length?: () => number;
      percentageFromCfi?: (cfi: string) => number;
    };
    spine?: {
      spineItems?: Section[];
    };
    loaded: {
      spine: Promise<unknown>;
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
