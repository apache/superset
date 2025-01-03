/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information.
 * The ASF licenses this file to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and limitations
 * under the License.
 */

import { Component, ReactNode, ErrorInfo, useState } from 'react';
import { t } from '@superset-ui/core';
import ErrorAlert from 'src/components/ErrorMessage/ErrorAlert';

interface ErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
  showMessage?: boolean;
}

/**
 * A class component for handling React error boundaries.
 */
class ErrorBoundaryFallback extends Component<ErrorBoundaryProps> {
  componentDidCatch(error: Error, info: ErrorInfo) {
    const { onError } = this.props;
    if (onError) {
      onError(error, info);
    }
  }

  render() {
    return this.props.children;
  }
}

/**
 * ErrorBoundary component to handle unexpected errors and display an error message if needed.
 */
const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({
  children,
  onError,
  showMessage = true,
}) => {
  const [error, setError] = useState<Error | null>(null);
  const [info, setInfo] = useState<ErrorInfo | null>(null);

  const handleError = (caughtError: Error, caughtInfo: ErrorInfo) => {
    setError(caughtError);
    setInfo(caughtInfo);
    if (onError) {
      onError(caughtError, caughtInfo);
    }
  };

  if (error) {
    const errorMessage = error.toString();
    if (showMessage) {
      return (
        <ErrorAlert
          errorType={t('Unexpected error')}
          message={errorMessage}
          descriptionDetails={info?.componentStack || errorMessage}
        />
      );
    }
    return null;
  }

  return (
    <ErrorBoundaryFallback handleError={handleError}>
      {children}
    </ErrorBoundaryFallback>
  );
};

export default ErrorBoundary;
