import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  title: string;
};

export function PlaceholderScreen({ title }: Props) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Coming soon</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This section will be available in a future update.</p>
      </CardContent>
    </Card>
  );
}

