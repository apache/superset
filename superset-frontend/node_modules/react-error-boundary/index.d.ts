import * as React from 'react';

export interface FallbackProps {
  error?: Error;
  componentStack?: string;
}

export interface ErrorBoundaryProps {
  onError?: (error: Error, componentStack: string) => void;
  FallbackComponent?: React.ComponentType<FallbackProps>;
}

export function withErrorBoundary<P>(
  ComponentToDecorate: React.ComponentType<P>,
  CustomFallbackComponent?: React.ComponentType<FallbackProps>,
  onErrorHandler?: (error: Error, componentStack: string) => void,
): React.ComponentType<P>;

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps>{}
