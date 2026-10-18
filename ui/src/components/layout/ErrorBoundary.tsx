import { Component } from "react";
import type { ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: (retry: () => void) => ReactNode;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  retry = () => {
    this.props.onReset?.();
    this.setState({ hasError: false });
  };

  override render() {
    return this.state.hasError ? this.props.fallback(this.retry) : this.props.children;
  }
}

export default ErrorBoundary;
