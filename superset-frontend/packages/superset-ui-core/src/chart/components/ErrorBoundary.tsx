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

import { ReactNode, ComponentType, ErrorInfo } from 'react';
import {
  ErrorBoundary as ReactErrorBoundary,
  FallbackProps,
  useErrorBoundary,
  withErrorBoundary,
} from 'react-error-boundary';

/**
 * Props for ErrorBoundary component.
 * All fallback props are optional - defaults to rendering null on error.
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  FallbackComponent?: ComponentType<FallbackProps>;
  fallbackRender?: (props: FallbackProps) => ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
}

/**
 * Default fallback that renders nothing (preserves original Superset behavior).
 */
const defaultFallback = () => null;

/**
 * ErrorBoundary wrapper that makes fallback optional.
 * Uses react-error-boundary under the hood but allows usage without
 * specifying a fallback (defaults to null, matching original behavior).
 */
export function ErrorBoundary({
  children,
  FallbackComponent,
  fallbackRender,
  fallback,
  onError,
  onReset,
}: ErrorBoundaryProps) {
  if (FallbackComponent) {
    return (
      <ReactErrorBoundary
        FallbackComponent={FallbackComponent}
        onError={onError}
        onReset={onReset}
      >
        {children}
      </ReactErrorBoundary>
    );
  }

  if (fallbackRender) {
    return (
      <ReactErrorBoundary
        fallbackRender={fallbackRender}
        onError={onError}
        onReset={onReset}
      >
        {children}
      </ReactErrorBoundary>
    );
  }

  if (fallback !== undefined) {
    return (
      <ReactErrorBoundary
        fallback={fallback}
        onError={onError}
        onReset={onReset}
      >
        {children}
      </ReactErrorBoundary>
    );
  }

  // Default: render null on error
  return (
    <ReactErrorBoundary
      fallbackRender={defaultFallback}
      onError={onError}
      onReset={onReset}
    >
      {children}
    </ReactErrorBoundary>
  );
}

export { type FallbackProps, useErrorBoundary, withErrorBoundary };
