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
import React from 'react';
import { t } from '@superset-ui/translation';

import getErrorMessageComponentRegistry from './getErrorMessageComponentRegistry';
import { SupersetError, ErrorSource } from './types';
import ErrorAlert from './ErrorAlert';

type Props = {
  error?: SupersetError;
  link?: string;
  message?: string;
  stackTrace?: string;
  source?: ErrorSource;
};

export default function ErrorMessageWithStackTrace({
  error,
  message,
  link,
  stackTrace,
  source,
}: Props) {
  // Check if a custom error message component was registered for this message
  if (error) {
    const ErrorMessageComponent = getErrorMessageComponentRegistry().get(
      error.error_type,
    );
    if (ErrorMessageComponent) {
      return <ErrorMessageComponent error={error} source={source} />;
    }
  }

  return (
    <ErrorAlert
      level="warning"
      title={t('Unexpected Error')}
      subtitle={message}
      copyText={message}
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
