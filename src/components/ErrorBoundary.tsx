import React from 'react';

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-neutral-900 border border-neutral-800 rounded p-6 text-center space-y-4">
          <div className="text-red-500 font-semibold text-sm">GPU / Rendering Error</div>
          <div className="text-xs text-neutral-400 max-w-md">
            WebGL context might have been lost or a shader crash occurred. Attempting to recover context...
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs transition-colors cursor-pointer border border-neutral-700 font-bold"
          >
            Retry / Recover
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
