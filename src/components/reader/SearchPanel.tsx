import * as React from 'react';
import type { ReaderSettings } from '../../../shared/ipc';
import { Search } from 'lucide-react';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getReaderButtonStyles, getReaderThemePalette } from '@/lib/reader-theme';

export type ReaderSearchResultItem = {
  id: string;
  excerpt: string;
  start: number;
  end: number;
  locationLabel?: string;
  chapterLabel?: string;
};

type SearchPanelProps = {
  open: boolean;
  settings: ReaderSettings;
  query: string;
  results: ReaderSearchResultItem[];
  isSearching: boolean;
  activeIndex: number;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onSelectResult: (index: number) => void;
  onRegisterActivity?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  rightOffset?: number;
  emptyQueryMessage?: string;
  noResultsMessage?: string;
};

export function SearchPanel({
  open,
  settings,
  query,
  results,
  isSearching,
  activeIndex,
  onClose,
  onQueryChange,
  onPrev,
  onNext,
  onSelectResult,
  onRegisterActivity,
  inputRef,
  placeholder,
  rightOffset = 12,
  emptyQueryMessage = 'Type a query to search this book.',
  noResultsMessage = 'No matches found.'
}: SearchPanelProps) {
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);

  return (
    <ReaderSidePanel
      open={open}
      title="Search"
      settings={settings}
      onClose={onClose}
      icon={<Search className="h-4 w-4" />}
      rightOffset={rightOffset}
    >
      <div className="space-y-3">
        <div className="space-y-2 border-b pb-3" style={{ borderColor: palette.chromeBorder }}>
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              onRegisterActivity?.();
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }
              event.preventDefault();
              if (event.shiftKey) {
                onPrev();
              } else {
                onNext();
              }
            }}
            placeholder={placeholder}
            aria-label="Search in document"
            style={{
              backgroundColor: palette.inputBg,
              borderColor: palette.buttonBorder,
              color: palette.inputText
            }}
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPrev}
              disabled={results.length === 0}
              style={getReaderButtonStyles(settings)}
            >
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onNext}
              disabled={results.length === 0}
              style={getReaderButtonStyles(settings)}
            >
              Next
            </Button>
            <span className="text-xs" style={{ color: palette.mutedText }}>
              {results.length > 0 && activeIndex >= 0 ? `${activeIndex + 1} / ${results.length}` : `0 / ${results.length}`}
            </span>
          </div>
          <p className="text-xs" style={{ color: palette.mutedText }}>
            {isSearching ? 'Searching...' : `${results.length} results`}
          </p>
        </div>
        {!query.trim() ? <p className="text-xs" style={{ color: palette.mutedText }}>{emptyQueryMessage}</p> : null}
        {query.trim() && !isSearching && results.length === 0 ? (
          <p className="text-xs" style={{ color: palette.mutedText }}>{noResultsMessage}</p>
        ) : null}
        <div className="space-y-2">
          {results.map((result, index) => {
            const safeStart = Math.max(0, Math.min(result.start, result.excerpt.length));
            const safeEnd = Math.max(safeStart, Math.min(result.end, result.excerpt.length));
            const before = result.excerpt.slice(0, safeStart);
            const match = result.excerpt.slice(safeStart, safeEnd);
            const after = result.excerpt.slice(safeEnd);

            return (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelectResult(index)}
                className="w-full rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{
                  borderColor: index === activeIndex ? palette.accentBorder : palette.chromeBorder,
                  backgroundColor: index === activeIndex ? palette.accentBg : palette.panelBg,
                  color: index === activeIndex ? palette.accentText : palette.chromeText
                }}
              >
                {result.locationLabel ? (
                  <span
                    className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{
                      backgroundColor: palette.accentBg,
                      borderColor: palette.accentBorder,
                      color: palette.accentText
                    }}
                  >
                    {result.locationLabel}
                  </span>
                ) : null}
                {result.chapterLabel ? (
                  <p className="mt-1 text-[11px] font-semibold" style={{ color: palette.chromeText }}>
                    {result.chapterLabel}
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-relaxed" style={{ color: palette.chromeText }}>
                  {before}
                  <mark className="rounded bg-yellow-200 px-0.5">{match}</mark>
                  {after}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </ReaderSidePanel>
  );
}
