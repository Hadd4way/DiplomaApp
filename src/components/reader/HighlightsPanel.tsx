import * as React from 'react';
import type { ReaderSettings } from '../../../shared/ipc';
import { Highlighter, MessageSquare, Trash2 } from 'lucide-react';
import { ReaderSidePanel } from '@/components/reader/ReaderSidePanel';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { getReaderButtonStyles, getReaderThemePalette } from '@/lib/reader-theme';

export type ReaderHighlightItem = {
  id: string;
  text: string | null;
  note: string | null;
  page?: number | null;
  cfiRange?: string | null;
  createdAt: number;
};

export type HighlightsPanelProps = {
  items: ReaderHighlightItem[];
  isOpen: boolean;
  onClose: () => void;
  onJumpToItem: (item: ReaderHighlightItem) => void;
  onDeleteItem: (item: ReaderHighlightItem) => void;
  onEditNote?: (item: ReaderHighlightItem) => void;
  title?: string;
  settings: ReaderSettings;
  rightOffset?: number;
  emptyMessage?: string;
};

function formatCreatedAt(value: number): string {
  if (!Number.isFinite(value)) {
    return '';
  }
  return new Date(value).toLocaleString();
}

function getLocationLabel(item: ReaderHighlightItem, pageLabel: string, flowLabel: string, fallbackLabel: string): string {
  if (typeof item.page === 'number' && Number.isFinite(item.page)) {
    return `${pageLabel} ${item.page}`;
  }
  if (item.cfiRange) {
    return flowLabel;
  }
  return fallbackLabel;
}

export function HighlightsPanel({
  items,
  isOpen,
  onClose,
  onJumpToItem,
  onDeleteItem,
  onEditNote,
  title = 'Highlights',
  settings,
  rightOffset = 12,
  emptyMessage = 'No highlights for this book.'
}: HighlightsPanelProps) {
  const { t } = useLanguage();
  const palette = React.useMemo(() => getReaderThemePalette(settings), [settings]);

  return (
    <ReaderSidePanel
      open={isOpen}
      title={title}
      settings={settings}
      onClose={onClose}
      icon={<Highlighter className="h-4 w-4" />}
      rightOffset={rightOffset}
    >
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs" style={{ color: palette.mutedText }}>
            {emptyMessage === 'No highlights for this book.' ? t.readerPanels.noHighlights : emptyMessage}
          </p>
        ) : null}
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-md border p-3"
            style={{ borderColor: palette.chromeBorder, backgroundColor: palette.panelBg }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.mutedText }}>
                  {getLocationLabel(item, t.hub.page, t.readerPanels.flowHighlight, t.readerPanels.highlight)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed" style={{ color: palette.chromeText }}>
                  {item.text ?? t.readerPanels.highlightWithoutText}
                </p>
                {item.note ? (
                  <div
                    className="mt-2 rounded-md border px-2 py-1.5"
                    style={{ borderColor: palette.accentBorder, backgroundColor: palette.accentBg }}
                  >
                    <p className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: palette.accentText }}>
                      <MessageSquare className="h-3 w-3" />
                      {t.readerPanels.note}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs" style={{ color: palette.chromeText }}>
                      {item.note}
                    </p>
                  </div>
                ) : null}
                <p className="mt-2 text-[11px]" style={{ color: palette.mutedText }}>
                  {formatCreatedAt(item.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onJumpToItem(item)}
                  style={getReaderButtonStyles(settings)}
                >
                  {t.readerPanels.jump}
                </Button>
                {onEditNote ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEditNote(item)}
                    style={getReaderButtonStyles(settings)}
                  >
                    {item.note ? t.readerPanels.editNote : t.readerPanels.addNote}
                  </Button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: '#fecaca',
                    color: '#b91c1c',
                    backgroundColor: 'transparent'
                  }}
                  onClick={() => onDeleteItem(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t.readerPanels.delete}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ReaderSidePanel>
  );
}
