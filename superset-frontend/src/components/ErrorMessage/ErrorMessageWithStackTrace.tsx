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
import { Typography } from '@superset-ui/core/components';
import { getErrorMessageComponentRegistry } from './getErrorMessageComponentRegistry';
import { ErrorAlert } from './ErrorAlert';

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
  descriptionDetails?: ReactNode;
  errorMitigationFunction?: () => void;
  fallback?: ReactNode;
  compact?: boolean;
};

export function ErrorMessageWithStackTrace({
  title = DEFAULT_TITLE,
  error,
  subtitle,
  link,
  stackTrace,
  source,
  description,
  descriptionDetails,
  fallback,
  compact,
}: Props) {
  // Check if a custom error message component was registered for this message
  if (error) {
    const ErrorMessageComponent = getErrorMessageComponentRegistry().get(
      // @ts-ignore: plan to modify this part so that all errors in Superset 6.0 are standardized as Superset API error types
      error.errorType ?? error.error_type,
    );
    if (ErrorMessageComponent) {
      return (
        <ErrorMessageComponent
          compact={compact}
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
  const computedDescriptionDetails =
    descriptionDetails ||
    (link || stackTrace ? (
      <>
        {link && (
          <Typography.Link
            href={link}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('Request Access')}
          </Typography.Link>
        )}
        <br />
        {stackTrace && <pre>{stackTrace}</pre>}
      </>
    ) : undefined);

  return (
    <ErrorAlert
      type="error"
      errorType={title}
      message={subtitle}
      description={description}
      descriptionDetails={computedDescriptionDetails}
      compact={compact}
    />
  );
}
