import * as React from 'react';
import { AlertCircle, Inbox, LoaderCircle, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
};

type ErrorStateProps = {
  title: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
};

type LoadingStateProps = {
  label: string;
};

export function ScreenEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon = <Inbox className="h-6 w-6 text-muted-foreground" />
}: EmptyStateProps) {
  return (
    <Card className="border-dashed bg-card/88">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-5 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-border/70 bg-background/95 shadow-[var(--shadow-sm)]">
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-[1.35rem] font-semibold tracking-tight">{title}</h2>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" size="lg" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ScreenLoadingState({ label }: LoadingStateProps) {
  return (
    <Card className="border-dashed bg-card/88">
      <CardContent className="flex min-h-72 flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-border/70 bg-background/95 shadow-[var(--shadow-sm)]">
          <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

export function ScreenErrorState({ title, description, retryLabel = 'Retry', onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div className="space-y-3">
          <p>{description}</p>
          {onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              <RefreshCcw className="h-4 w-4" />
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
