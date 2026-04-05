import * as React from 'react';
import { OutlineTree, type PdfOutlineItem } from '@/components/outline-tree';
import type { ReaderThemePalette } from '@/lib/reader-theme';

type Props = {
  outlineItems: PdfOutlineItem[];
  outlineLoading: boolean;
  onOutlineSelect: (item: PdfOutlineItem, key: string) => void;
  palette: ReaderThemePalette;
};

export function PdfSidebar({
  outlineItems,
  outlineLoading,
  onOutlineSelect,
  palette
}: Props) {
  return (
    <aside className="h-full w-full overflow-y-auto" style={{ backgroundColor: palette.panelBg }}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b px-4 py-3" style={{ borderColor: palette.chromeBorder }}>
          <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>
            Contents
          </h3>
        </div>

        <div className="min-h-0 flex-1 px-2 py-3">
          {outlineLoading ? (
            <p className="px-2 py-1 text-sm" style={{ color: palette.mutedText }}>
              Loading contents...
            </p>
          ) : outlineItems.length > 0 ? (
            <OutlineTree items={outlineItems} onSelect={onOutlineSelect} />
          ) : (
            <p className="px-2 py-1 text-sm" style={{ color: palette.mutedText }}>
              No table of contents found.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
