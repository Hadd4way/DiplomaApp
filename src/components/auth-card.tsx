import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type AuthMode = 'signIn' | 'signUp';

type Props = {
  mode: AuthMode;
  email: string;
  displayName: string;
  password: string;
  loading: boolean;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function AuthCard({
  mode,
  email,
  displayName,
  password,
  loading,
  error,
  onModeChange,
  onEmailChange,
  onDisplayNameChange,
  onPasswordChange,
  onSubmit
}: Props) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
        <CardDescription>Sign in to continue or create a new account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(value) => onModeChange(value as AuthMode)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signIn">Sign in</TabsTrigger>
            <TabsTrigger value="signUp">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signIn">
            <AuthForm
              mode="signIn"
              email={email}
              displayName={displayName}
              password={password}
              loading={loading}
              onEmailChange={onEmailChange}
              onDisplayNameChange={onDisplayNameChange}
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmit}
            />
          </TabsContent>

          <TabsContent value="signUp">
            <AuthForm
              mode="signUp"
              email={email}
              displayName={displayName}
              password={password}
              loading={loading}
              onEmailChange={onEmailChange}
              onDisplayNameChange={onDisplayNameChange}
              onPasswordChange={onPasswordChange}
              onSubmit={onSubmit}
            />
          </TabsContent>
        </Tabs>

        {error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Authentication error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AuthForm({
  mode,
  email,
  displayName,
  password,
  loading,
  onEmailChange,
  onDisplayNameChange,
  onPasswordChange,
  onSubmit
}: {
  mode: AuthMode;
  email: string;
  displayName: string;
  password: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input
          id={`${mode}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
        />
      </div>

      {mode === 'signUp' ? (
        <div className="space-y-2">
          <Label htmlFor={`${mode}-display-name`}>Display name</Label>
          <Input
            id={`${mode}-display-name`}
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => onDisplayNameChange(event.target.value)}
            required
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          minLength={8}
          required
        />
      </div>

      <Button className="w-full" type="submit" disabled={loading}>
        {loading ? 'Please wait...' : mode === 'signUp' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  );
}
