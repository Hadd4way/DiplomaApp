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
    <Card className="border-dashed bg-card/80">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-sm">
          {icon}
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ScreenLoadingState({ label }: LoadingStateProps) {
  return (
    <Card className="border-dashed bg-card/80">
      <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
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
