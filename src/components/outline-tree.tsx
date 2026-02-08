import * as React from 'react';

export type PdfOutlineItem = {
  title?: string | null;
  dest?: unknown;
  items?: PdfOutlineItem[] | null;
};

function normalizeOutlineTitle(rawTitle: string | null | undefined, fallback: string): string {
  if (!rawTitle) {
    return fallback;
  }

  // Replace non-breaking/figure/narrow spaces and zero-width chars that can break layout.
  const cleaned = rawTitle
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || fallback;
}

type Props = {
  items: PdfOutlineItem[];
  onSelect: (item: PdfOutlineItem, key: string) => void;
  level?: number;
  path?: string;
};

export function OutlineTree({ items, onSelect, level = 0, path = 'root' }: Props) {
  return (
    <ul className={level === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {items.map((item, index) => {
        const key = `${path}.${index}`;
        const title = normalizeOutlineTitle(item.title, `Section ${index + 1}`);

        return (
          <li key={key}>
            <button
              type="button"
              className="w-full overflow-hidden text-wrap break-words rounded px-2 py-1 text-left text-sm whitespace-normal hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ paddingLeft: `${0.5 + level * 0.75}rem` }}
              onClick={() => onSelect(item, key)}
              aria-label={`Go to section: ${title}`}
            >
              {title}
            </button>
            {item.items && item.items.length > 0 ? (
              <OutlineTree items={item.items} onSelect={onSelect} level={level + 1} path={key} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
