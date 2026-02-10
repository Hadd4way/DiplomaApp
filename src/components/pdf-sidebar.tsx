import * as React from 'react';
import { OutlineTree, type PdfOutlineItem } from '@/components/outline-tree';

type Props = {
  outlineItems: PdfOutlineItem[];
  outlineLoading: boolean;
  onOutlineSelect: (item: PdfOutlineItem, key: string) => void;
};

export function PdfSidebar({
  outlineItems,
  outlineLoading,
  onOutlineSelect
}: Props) {
  return (
    <aside className="h-full w-full overflow-y-auto bg-white">
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document Map</h3>
        </div>

        <div className="min-h-0 flex-1 px-2 py-3">
          {outlineLoading ? (
            <p className="px-2 py-1 text-sm text-slate-500">Loading contents...</p>
          ) : outlineItems.length > 0 ? (
            <OutlineTree items={outlineItems} onSelect={onOutlineSelect} />
          ) : (
            <p className="px-2 py-1 text-sm text-slate-500">No table of contents found.</p>
          )}
        </div>
      </div>
    </aside>
  );
}
