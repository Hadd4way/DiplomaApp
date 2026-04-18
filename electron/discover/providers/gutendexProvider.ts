import type {
  DiscoverBookFormatDescriptor,
  DiscoverBookResult,
  DiscoverSearchRequest
} from '../../../shared/ipc';

type GutendexBook = {
  id: number;
  title: string;
  authors?: Array<{ name?: string | null }>;
  languages?: string[];
  download_count?: number | null;
  formats?: Record<string, string>;
};

type GutendexResponse = {
  results?: GutendexBook[];
};

const GUTENDEX_BASE_URL = 'https://gutendex.com/books';

function isUsableDownloadUrl(downloadUrl: string | undefined) {
  return Boolean(downloadUrl && /^https?:\/\//i.test(downloadUrl) && !downloadUrl.toLocaleLowerCase().endsWith('.zip'));
}

function mapMimeTypeToKind(mimeType: string): DiscoverBookFormatDescriptor['kind'] {
  const value = mimeType.toLocaleLowerCase();
  if (value.startsWith('application/epub+zip')) {
    return 'epub';
  }
  if (value.startsWith('text/plain')) {
    return 'txt';
  }
  if (value.startsWith('text/html') || value.startsWith('application/xhtml+xml')) {
    return 'html';
  }
  return 'other';
}

function mapFormats(formats: Record<string, string> | undefined): DiscoverBookFormatDescriptor[] {
  if (!formats) {
    return [];
  }

  return Object.entries(formats)
    .filter(([mimeType, url]) => {
      const kind = mapMimeTypeToKind(mimeType);
      return kind !== 'other' && isUsableDownloadUrl(url);
    })
    .map(([mimeType, url]) => ({
      kind: mapMimeTypeToKind(mimeType),
      mimeType,
      url
    }))
    .sort((left, right) => {
      const weights: Record<DiscoverBookFormatDescriptor['kind'], number> = {
        epub: 0,
        txt: 1,
        html: 2,
        other: 3
      };

      return weights[left.kind] - weights[right.kind];
    });
}

function mapCoverUrl(formats: Record<string, string> | undefined) {
  const jpegUrl = formats?.['image/jpeg'];
  const pngUrl = formats?.['image/png'];
  return jpegUrl ?? pngUrl ?? null;
}

function mapBook(book: GutendexBook): DiscoverBookResult | null {
  const formats = mapFormats(book.formats);
  if (formats.length === 0) {
    return null;
  }

  const authorNames = (book.authors ?? [])
    .map((author) => author.name?.trim() || null)
    .filter((author): author is string => Boolean(author));
  const languages = (book.languages ?? []).map((language) => language.trim()).filter(Boolean);

  return {
    id: `gutenberg:${book.id}`,
    source: 'gutenberg',
    title: book.title?.trim() || 'Untitled',
    author: authorNames.length > 0 ? authorNames.join(', ') : null,
    languages,
    coverUrl: mapCoverUrl(book.formats),
    downloadCount: typeof book.download_count === 'number' ? book.download_count : null,
    formats
  };
}

export const gutendexProvider = {
  async search(query: string, options: Omit<DiscoverSearchRequest, 'query'> = {}): Promise<DiscoverBookResult[]> {
    const url = new URL(GUTENDEX_BASE_URL);
    url.searchParams.set('search', query);

    const language = options.language?.trim();
    if (language) {
      url.searchParams.set('languages', language);
    }

    if (typeof options.page === 'number' && Number.isFinite(options.page) && options.page > 1) {
      url.searchParams.set('page', String(Math.floor(options.page)));
    }

    const response = await fetch(url, {
      headers: {
        'user-agent': 'DiplomaApp/1.0 (Discover Books MVP)'
      }
    });
    if (!response.ok) {
      throw new Error(`Gutendex search failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as GutendexResponse;
    return (payload.results ?? []).map(mapBook).filter((book): book is DiscoverBookResult => Boolean(book));
  }
};
