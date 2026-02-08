import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Props = {
  title: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

export function PlaceholderScreen({ title, actionLabel, actionDisabled = false, onAction }: Props) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Coming soon</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This section will be available in a future update.
          </p>
          {actionLabel && onAction ? (
            <Button type="button" variant="outline" onClick={onAction} disabled={actionDisabled}>
              {actionLabel}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
