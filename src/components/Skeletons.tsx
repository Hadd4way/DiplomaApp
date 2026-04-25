import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

function shimmerClassName(baseClassName: string) {
  return `${baseClassName} animate-pulse rounded bg-muted/70`;
}

export function LibraryCardSkeleton() {
  return (
    <Card className="overflow-hidden border-white/40 bg-card/95 shadow-sm">
      <div className="h-44 bg-muted/40 p-6">
        <div className={shimmerClassName('mx-auto h-36 w-28 rounded-2xl')} />
      </div>
      <CardContent className="space-y-3 p-4">
        <div className={shimmerClassName('h-5 w-3/4')} />
        <div className={shimmerClassName('h-4 w-1/2')} />
        <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-3">
          <div className={shimmerClassName('h-3 w-full')} />
          <div className={shimmerClassName('mt-3 h-2 w-full')} />
          <div className={shimmerClassName('mt-2 h-3 w-2/3')} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className={shimmerClassName('h-4 w-16')} />
          <div className={shimmerClassName('h-8 w-20 rounded-md')} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentCardSkeleton() {
  return (
    <Card className="border-white/60 bg-card/95 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className={shimmerClassName('h-4 w-24')} />
        <div className={shimmerClassName('h-6 w-3/4')} />
        <div className={shimmerClassName('h-4 w-full')} />
        <div className={shimmerClassName('h-4 w-5/6')} />
        <div className={shimmerClassName('h-9 w-32 rounded-md')} />
      </CardContent>
    </Card>
  );
}

export function SkeletonGrid({ count, variant = 'content' }: { count: number; variant?: 'content' | 'library' }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          {variant === 'library' ? <LibraryCardSkeleton /> : <ContentCardSkeleton />}
        </div>
      ))}
    </div>
  );
}
