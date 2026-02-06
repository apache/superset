/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Component, ComponentType, ErrorInfo, ReactNode } from 'react';

export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<FallbackProps>;
  fallbackRender?: (props: FallbackProps) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * ErrorBoundary component for catching and handling errors in child components.
 * Provides FallbackComponent support similar to react-error-boundary.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
  }

  resetErrorBoundary = (): void => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    const { children, FallbackComponent, fallbackRender } = this.props;

    if (error) {
      const fallbackProps: FallbackProps = {
        error,
        resetErrorBoundary: this.resetErrorBoundary,
      };

      if (fallbackRender) {
        return fallbackRender(fallbackProps);
      }

      if (FallbackComponent) {
        return <FallbackComponent {...fallbackProps} />;
      }

      // Default fallback if no FallbackComponent provided
      return null;
    }

    return children;
  }
}

export default ErrorBoundary;
