import React from "react";
import { createLogger } from "../lib/logger";

const logger = createLogger("ErrorBoundary");

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("Uncaught error in component tree", {
      error: error.message,
      stack: error.stack ?? "no stack",
      componentStack: errorInfo.componentStack ?? "no component stack",
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-red-50 border border-red-200 rounded-2xl text-center">
          <h2 className="text-lg font-black text-red-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-red-600 mb-4 max-w-md">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
