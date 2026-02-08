import * as React from 'react';
import { Input } from '@/components/ui/input';
import { OutlineTree, type PdfOutlineItem } from '@/components/outline-tree';

type Props = {
  numPages: number;
  pageInputRef: React.RefObject<HTMLInputElement | null>;
  pageInputValue: string;
  pageInputError: string | null;
  loading: boolean;
  rendering: boolean;
  onPageInputChange: (value: string) => void;
  onPageInputFocus: () => void;
  onPageInputEnter: () => void;
  onPageInputBlur: () => void;
  onJumpToPage: (value: string) => boolean;
  outlineItems: PdfOutlineItem[];
  outlineLoading: boolean;
  onOutlineSelect: (item: PdfOutlineItem, key: string) => void;
};

export function PdfSidebar({
  numPages,
  pageInputRef,
  pageInputValue,
  pageInputError,
  loading,
  rendering,
  onPageInputChange,
  onPageInputFocus,
  onPageInputEnter,
  onPageInputBlur,
  onJumpToPage,
  outlineItems,
  outlineLoading,
  onOutlineSelect
}: Props) {
  return (
    <aside className="w-[290px] shrink-0 overflow-hidden rounded-md border bg-background">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-3 py-3">
          <h3 className="text-sm font-semibold">Contents</h3>
          <div className="mt-2 flex items-center gap-2 rounded-md border px-2 py-1">
            <label htmlFor="page-input" className="text-sm text-muted-foreground">
              Page
            </label>
            <Input
              ref={pageInputRef}
              id="page-input"
              value={pageInputValue}
              onChange={(event) => onPageInputChange(event.target.value)}
              onFocus={onPageInputFocus}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const ok = onJumpToPage(pageInputValue);
                  if (ok) {
                    onPageInputEnter();
                  }
                }
              }}
              onBlur={onPageInputBlur}
              aria-label="Page number"
              className="h-8 w-20"
              inputMode="numeric"
              disabled={loading || rendering}
            />
            <span className="text-sm text-muted-foreground">/ {numPages}</span>
          </div>
          <div className="min-h-4 pt-1">
            {pageInputError ? <p className="text-xs text-destructive">{pageInputError}</p> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {outlineLoading ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">Loading contents...</p>
          ) : outlineItems.length > 0 ? (
            <OutlineTree items={outlineItems} onSelect={onOutlineSelect} />
          ) : (
            <p className="px-2 py-1 text-sm text-muted-foreground">No table of contents found.</p>
          )}
        </div>
      </div>
    </aside>
  );
}

