import * as React from 'react';
import { AlertCircle, ArrowRight, Bookmark, Clock3, LoaderCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScreenEmptyState, ScreenErrorState, ScreenLoadingState } from '@/components/ScreenState';
import { SkeletonGrid } from '@/components/Skeletons';
import { useLanguage } from '@/contexts/LanguageContext';
import { LIST_BATCH_SIZE } from '@/lib/constants';
import { useIncrementalList } from '@/lib/useIncrementalList';
import { useWishlist } from '@/lib/useWishlist';

type Props = {
  onSearchInDiscover: (query: string) => void;
};

const screenCopy = {
  en: {
    title: 'Wishlist',
    subtitle: 'Save promising recommendations, come back later, and launch straight into Discover when you are ready.',
    emptyTitle: 'No saved recommendations yet',
    emptyDescription: 'Books you save from AI recommendations will show up here.',
    readLater: 'Read Later',
    saved: 'Saved',
    confidence: 'Confidence',
    remove: 'Remove',
    searchInDiscover: 'Search in Discover',
    markReadLater: 'Mark as Read Later',
    unmarkReadLater: 'Unmark Read Later',
    requestErrorTitle: 'Wishlist error'
  },
  ru: {
    title: 'Wishlist',
    subtitle: 'Save promising recommendations, come back later, and launch straight into Discover when you are ready.',
    emptyTitle: 'No saved recommendations yet',
    emptyDescription: 'Books you save from AI recommendations will show up here.',
    readLater: 'Read Later',
    saved: 'Saved',
    confidence: 'Confidence',
    remove: 'Remove',
    searchInDiscover: 'Search in Discover',
    markReadLater: 'Mark as Read Later',
    unmarkReadLater: 'Unmark Read Later',
    requestErrorTitle: 'Wishlist error'
  }
} as const;

function formatConfidence(value: number | null | undefined, label: string) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const normalized = value > 1 ? value / 100 : value;
  return `${label}: ${Math.max(0, Math.min(100, Math.round(normalized * 100)))}%`;
}

export function WishlistScreen({ onSearchInDiscover }: Props) {
  const { language } = useLanguage();
  const copy = screenCopy[language];
  const { loading, error, items, removeItem, updateItem } = useWishlist();
  const [pendingIds, setPendingIds] = React.useState<string[]>([]);
  const { visibleItems, hasMore, showMore } = useIncrementalList(items, LIST_BATCH_SIZE.wishlist);

  const withPending = React.useCallback(async (itemId: string, action: () => Promise<void>) => {
    setPendingIds((current) => [...current, itemId]);
    try {
      await action();
    } finally {
      setPendingIds((current) => current.filter((value) => value !== itemId));
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-6 overflow-hidden pr-1">
      <Card className="shrink-0 overflow-hidden border-white/70 bg-[linear-gradient(135deg,rgba(255,248,240,0.98)_0%,rgba(255,255,255,0.99)_50%,rgba(240,249,255,0.98)_100%)] shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background/85 shadow-sm">
              <Bookmark className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        <div className="space-y-4">
          {error ? <ScreenErrorState title={copy.requestErrorTitle} description={error} /> : null}

          {loading ? (
            <div className="space-y-4">
              <ScreenLoadingState label={copy.saved} />
              <SkeletonGrid count={4} />
            </div>
          ) : items.length === 0 ? (
            <ScreenEmptyState
              title={copy.emptyTitle}
              description={copy.emptyDescription}
              icon={<Bookmark className="h-6 w-6 text-muted-foreground" />}
            />
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              {visibleItems.map((item) => {
                const isPending = pendingIds.includes(item.id);
                const query = `${item.title} ${item.author ?? ''}`.trim();
                const confidence = formatConfidence(item.confidence, copy.confidence);

                return (
                  <li key={item.id}>
                    <Card className="flex h-full flex-col border-white/60 bg-card/95 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                      <CardContent className="flex h-full flex-col gap-4 p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {copy.saved}
                          </span>
                          {item.readLater ? (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                              {copy.readLater}
                            </span>
                          ) : null}
                          {confidence ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                              {confidence}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          <h2 className="text-xl font-semibold tracking-tight">{item.title}</h2>
                          <p className="text-sm text-muted-foreground">{item.author || 'Unknown author'}</p>
                          <p className="text-sm leading-6 text-muted-foreground">{item.reason}</p>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              void withPending(item.id, async () => {
                                await updateItem(item.id, !item.readLater);
                              })
                            }
                          >
                            <Clock3 className="h-4 w-4" />
                            {item.readLater ? copy.unmarkReadLater : copy.markReadLater}
                          </Button>
                          <Button type="button" size="sm" onClick={() => onSearchInDiscover(query)}>
                            {copy.searchInDiscover}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isPending}
                            onClick={() =>
                              void withPending(item.id, async () => {
                                await removeItem(item.id);
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            {copy.remove}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
              </ul>
              {hasMore ? (
                <div className="flex justify-center pt-2">
                  <Button type="button" variant="outline" onClick={showMore}>
                    Show more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
