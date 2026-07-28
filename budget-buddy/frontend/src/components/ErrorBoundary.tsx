import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mb-6 shadow-sm">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h1 className="text-xl font-bold text-primary mb-2">Something went wrong</h1>
          <p className="text-sm text-on-surface-variant/80 max-w-sm mb-6">
            An unexpected error occurred. Please refresh the page or try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary h-12 px-6 shadow-none"
          >
            Reload Page
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-8 p-4 bg-surface-container-low border border-outline-variant/30 text-left text-xs text-error font-mono overflow-auto max-w-lg rounded-xl">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
