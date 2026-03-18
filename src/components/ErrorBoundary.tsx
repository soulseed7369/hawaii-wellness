import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; resetKey?: string; }
interface State { hasError: boolean; errorMessage: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Unknown error' };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("Uncaught error:", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    // Reset the error boundary when the route changes (resetKey changes)
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Something went wrong</h1>
          <p className="text-muted-foreground max-w-sm">
            An unexpected error occurred. Please try navigating back or refreshing the page.
          </p>
          {import.meta.env.DEV && this.state.errorMessage && (
            <pre className="mt-2 max-w-lg overflow-auto rounded bg-muted p-3 text-left text-xs text-muted-foreground">
              {this.state.errorMessage}
            </pre>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => this.setState({ hasError: false, errorMessage: '' })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Refresh page</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
