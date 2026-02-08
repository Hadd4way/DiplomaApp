import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PingResponse, User } from '../../shared/ipc';

type Props = {
  user: User;
  loading: boolean;
  error: string | null;
  pingResult: PingResponse | null;
  onPing: () => void;
  onSignOut: () => void;
};

export function HomeCard({ user, loading, error, pingResult, onPing, onSignOut }: Props) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Home</CardTitle>
        <CardDescription>Logged in as {user.displayName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="font-medium">{user.displayName}</p>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={onPing} disabled={loading}>
            {loading ? 'Please wait...' : 'Ping main process'}
          </Button>
          <Button type="button" onClick={onSignOut} disabled={loading}>
            Log out
          </Button>
        </div>

        {pingResult ? (
          <pre className="overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
            {JSON.stringify(pingResult, null, 2)}
          </pre>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Request error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
