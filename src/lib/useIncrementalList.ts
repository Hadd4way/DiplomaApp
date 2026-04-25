import * as React from 'react';

export function useIncrementalList<T>(items: T[], initialCount: number) {
  const [visibleCount, setVisibleCount] = React.useState(initialCount);

  React.useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, items]);

  const visibleItems = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  const showMore = React.useCallback(() => {
    setVisibleCount((current) => Math.min(items.length, current + initialCount));
  }, [initialCount, items.length]);

  return {
    visibleItems,
    visibleCount,
    hasMore,
    showMore
  };
}
