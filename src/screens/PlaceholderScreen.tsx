import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
};

export function PlaceholderScreen({
  title,
  description,
  actionLabel,
  actionDisabled = false,
  onAction
}: Props) {
  const { t } = useLanguage();
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t.placeholder.comingSoon}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{description ?? t.placeholder.description}</p>
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
