import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

function shimmerClassName(baseClassName: string) {
  return `${baseClassName} animate-pulse rounded-xl bg-muted/70`;
}

export function LibraryCardSkeleton() {
  return (
    <Card className="overflow-hidden bg-card/95">
      <div className="h-52 bg-muted/35 p-6">
        <div className={shimmerClassName('mx-auto h-40 w-[7.4rem] rounded-[1.35rem]')} />
      </div>
      <CardContent className="space-y-4 p-5">
        <div className={shimmerClassName('h-5 w-3/4')} />
        <div className={shimmerClassName('h-4 w-1/2')} />
        <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-3">
          <div className={shimmerClassName('h-3 w-full')} />
          <div className={shimmerClassName('mt-3 h-2 w-full')} />
          <div className={shimmerClassName('mt-2 h-3 w-2/3')} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className={shimmerClassName('h-4 w-16')} />
          <div className={shimmerClassName('h-9 w-24 rounded-xl')} />
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentCardSkeleton() {
  return (
    <Card className="bg-card/95">
      <CardContent className="space-y-4 p-5">
        <div className={shimmerClassName('h-4 w-24')} />
        <div className={shimmerClassName('h-6 w-3/4')} />
        <div className={shimmerClassName('h-4 w-full')} />
        <div className={shimmerClassName('h-4 w-5/6')} />
        <div className={shimmerClassName('h-10 w-32 rounded-xl')} />
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
