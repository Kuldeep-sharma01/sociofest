import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Log to console for immediate debugging
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // TODO: Send to logging service (Sentry)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-2xl border border-red-200 dark:border-red-800">
          <div className="w-24 h-24 mb-6 p-6 bg-red-100 dark:bg-red-900/50 rounded-2xl flex items-center justify-center">
            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Something went wrong
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 max-w-md">
            We're sorry, but something unexpected happened. Please try again.
          </p>
          {this.state.error && (
            <details className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg max-w-2xl">
              <summary className="font-semibold cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                Click for technical details
              </summary>
              <pre className="mt-2 text-xs text-gray-900 dark:text-gray-100 overflow-auto max-h-40 p-2 bg-white dark:bg-gray-900 rounded">
                {this.state.error?.toString()}
                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2 text-gray-600 dark:text-gray-400">
                    {this.state.errorInfo.componentStack}
                  </div>
                )}
              </pre>
            </details>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-gray-500/50"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

