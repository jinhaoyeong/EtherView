"use client";

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; reset: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo });

    // Log error but don't crash the app
    console.error('Error Boundary caught an error:', error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;

      if (Fallback) {
        return <Fallback error={this.state.error} reset={this.reset} />;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="mb-4 flex justify-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500" />
            </div>

            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>

            <p className="text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred while loading this component.'}
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-red-600 mb-2">
                  Error Details (Development)
                </summary>
                <pre className="text-xs bg-red-50 p-2 rounded border border-red-200 overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={this.reset}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to use error boundaries
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const throwError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { resetError, throwError };
}

// Specific error boundary for wallet analysis
export function WalletAnalysisErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log specific wallet analysis errors
        console.error('Wallet Analysis Error:', { error: error.message, stack: error.stack, errorInfo });

        // In production, you might want to send this to an error reporting service
        if (process.env.NODE_ENV === 'production') {
          // Example: sendToErrorService(error, errorInfo);
        }
      }}
      fallback={({ error, reset }) => (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="mb-4 flex justify-center">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>

            <h2 className="text-xl font-semibold mb-2">Wallet Analysis Failed</h2>

            <p className="text-muted-foreground mb-4">
              {error?.message?.includes('aborted')
                ? 'The analysis was interrupted. This is normal during development.'
                : 'Unable to load wallet data. Please check your connection and try again.'}
            </p>

            <button
              onClick={reset}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Data
            </button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;