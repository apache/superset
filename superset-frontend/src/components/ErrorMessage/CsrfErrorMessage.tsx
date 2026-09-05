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
import { t } from '@apache-superset/core/translation';

import type { ErrorMessageComponentProps } from './types';
import { ErrorAlert } from './ErrorAlert';

/**
 * Shown when a request was rejected because its CSRF token was not accepted.
 *
 * SupersetClient already refreshes the token and replays the request once, so
 * reaching this component means the replay was rejected too — the token could
 * not be renewed, most often because the session itself is gone.
 */
export function CsrfErrorMessage({
  error,
  compact,
  closable,
  subtitle,
}: ErrorMessageComponentProps) {
  const { level, message } = error;
  return (
    <ErrorAlert
      compact={compact}
      closable={closable}
      errorType={t('Security token error')}
      message={t('Reload the page and try again to continue.')}
      description={subtitle}
      descriptionDetails={message}
      type={level}
    />
  );
}

export default CsrfErrorMessage;
