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
import React, { useState } from 'react';
// @ts-ignore
import { Alert, Collapse } from 'react-bootstrap';
import getErrorMessageComponentRegistry from './getErrorMessageComponentRegistry';
import { SupersetError } from './types';

type Props = {
  error?: SupersetError;
  link?: string;
  message: string;
  stackTrace?: string;
};

export default function ErrorMessageWithStackTrace({
  error,
  message,
  link,
  stackTrace,
}: Props) {
  const [showStackTrace, setShowStackTrace] = useState(false);

  // Check if a custom error message component was registered for this message
  if (error) {
    const ErrorMessageComponent = getErrorMessageComponentRegistry().get(
      error.error_type,
    );
    if (ErrorMessageComponent) {
      return <ErrorMessageComponent error={error} />;
    }
  }

  // Fallback to the default error message renderer
  return (
    <div className={`stack-trace-container${stackTrace ? ' has-trace' : ''}`}>
      <Alert
        bsStyle="warning"
        onClick={() => setShowStackTrace(!showStackTrace)}
      >
        {message}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer">
            (Request Access)
          </a>
        )}
      </Alert>
      {stackTrace && (
        <Collapse in={showStackTrace}>
          <pre>{stackTrace}</pre>
        </Collapse>
      )}
    </div>
  );
}
