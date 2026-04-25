import * as React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type Props = {
  area: string;
  children: React.ReactNode;
};

type State = {
  error: Error | null;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`${this.props.area} crashed`, error, errorInfo);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="mx-auto flex w-full max-w-3xl items-start justify-center py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{this.props.area} hit an unexpected error</AlertTitle>
          <AlertDescription>
            <div className="space-y-3">
              <p>{this.state.error.message || 'Something went wrong while rendering this section.'}</p>
              <Button type="button" variant="outline" onClick={this.reset}>
                <RefreshCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }
}
