/**
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

import React, { Component, ReactNode } from 'react';
import { t } from '@apache-superset/core';
import { styled } from '@apache-superset/core/ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const ErrorContainer = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 4}px;
    background-color: ${theme.colorErrorLight};
    border: 1px solid ${theme.colorError};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorTextBase};
  `}
`;

const ErrorTitle = styled.h3`
  ${({ theme }) => `
    color: ${theme.colorError};
    margin: 0 0 ${theme.sizeUnit * 2}px 0;
    font-size: ${theme.fontSizeLG}px;
  `}
`;

const ErrorMessage = styled.p`
  ${({ theme }) => `
    margin: ${theme.sizeUnit * 2}px 0;
    font-family: ${theme.fontFamilyCode};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const ErrorStack = styled.pre`
  ${({ theme }) => `
    margin: ${theme.sizeUnit * 2}px 0;
    padding: ${theme.sizeUnit * 2}px;
    background-color: ${theme.colorBgBase};
    border-radius: ${theme.borderRadius}px;
    overflow: auto;
    max-height: 300px;
    font-size: ${theme.fontSizeXS}px;
    font-family: ${theme.fontFamilyCode};
  `}
`;

/**
 * Error Boundary component to catch and display errors in the table chart
 * Prevents the entire application from crashing when an error occurs
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { onError } = this.props;

    // Log error details
    console.error('TableChart Error Boundary caught an error:', error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (onError) {
      onError(error, errorInfo);
    }
  }

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <ErrorContainer role="alert">
          <ErrorTitle>{t('Something went wrong')}</ErrorTitle>
          <ErrorMessage>
            {t('An error occurred while rendering the table. Please try refreshing the page.')}
          </ErrorMessage>
          {error && (
            <ErrorMessage>
              <strong>{t('Error:')}</strong> {error.toString()}
            </ErrorMessage>
          )}
          {errorInfo && process.env.NODE_ENV === 'development' && (
            <details>
              <summary style={{ cursor: 'pointer', marginBottom: 8 }}>
                {t('Error Details (Development Only)')}
              </summary>
              <ErrorStack>{errorInfo.componentStack}</ErrorStack>
            </details>
          )}
        </ErrorContainer>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
