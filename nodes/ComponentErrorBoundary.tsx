'use client';

import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches render errors in playground-rendered components.
 * Shows a friendly fallback with the error message and a retry button.
 */
export default class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[Playground] Component render error${this.props.componentName ? ` in ${this.props.componentName}` : ''}:`,
      error,
      info.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center min-h-[100px]">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <div>
            <p className="text-sm font-medium text-red-600">
              {this.props.componentName ? `${this.props.componentName} crashed` : 'Component crashed'}
            </p>
            <p className="text-xs text-gray-500 mt-1 max-w-[300px] break-words">
              {this.state.error?.message || 'An unexpected error occurred during rendering.'}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
