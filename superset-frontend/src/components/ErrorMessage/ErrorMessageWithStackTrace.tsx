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
import { ReactNode } from 'react';
import { ErrorSource, t, SupersetError } from '@superset-ui/core';
import getErrorMessageComponentRegistry from './getErrorMessageComponentRegistry';
import ErrorAlert from './ErrorAlert';

const DEFAULT_TITLE = t('Unexpected error');

type Props = {
  title?: string;
  error?: SupersetError;
  link?: string;
  subtitle?: ReactNode;
  copyText?: string;
  stackTrace?: string;
  source?: ErrorSource;
  description?: string;
  errorMitigationFunction?: () => void;
  fallback?: ReactNode;
};

export default function ErrorMessageWithStackTrace({
  title = DEFAULT_TITLE,
  error,
  subtitle,
  copyText,
  link,
  stackTrace,
  source,
  description,
  fallback,
}: Props) {
  // Check if a custom error message component was registered for this message
  if (error) {
    const ErrorMessageComponent = getErrorMessageComponentRegistry().get(
      error.error_type,
    );
    if (ErrorMessageComponent) {
      return (
        <ErrorMessageComponent
          error={error}
          source={source}
          subtitle={subtitle}
        />
      );
    }
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <ErrorAlert
      level="warning"
      title={title}
      subtitle={subtitle}
      copyText={copyText}
      description={description}
      source={source}
      body={
        link || stackTrace ? (
          <>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer">
                (Request Access)
              </a>
            )}
            <br />
            {stackTrace && <pre>{stackTrace}</pre>}
          </>
        ) : undefined
      }
    />
  );
}
