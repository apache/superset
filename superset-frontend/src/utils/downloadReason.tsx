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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Input, Modal } from '@superset-ui/core/components';

export const DOWNLOAD_REASON_PARAM = 'download_reason';

/** Whether REQUIRE_DOWNLOAD_REASON is enabled for this deployment. */
export function isDownloadReasonRequired(): boolean {
  return isFeatureEnabled(FeatureFlag.RequireDownloadReason);
}

/**
 * Ask the user why they are downloading data (REQUIRE_DOWNLOAD_REASON).
 *
 * Resolves with the trimmed reason; with '' when the feature flag is off
 * (nothing is asked); or with null when the user cancels the dialog.
 *
 * Callers on hot paths should guard with `isDownloadReasonRequired()` so the
 * flag-off behaviour stays fully synchronous (no extra microtask).
 */
export function requestDownloadReason(): Promise<string | null> {
  if (!isDownloadReasonRequired()) {
    return Promise.resolve('');
  }
  return new Promise(resolve => {
    let reason = '';
    Modal.confirm({
      title: t('Download reason'),
      content: (
        <Input.TextArea
          autoFocus
          rows={3}
          placeholder={t('Why are you downloading this data?')}
          onChange={e => {
            reason = e.target.value;
          }}
        />
      ),
      okText: t('Download'),
      cancelText: t('Cancel'),
      onOk: () => {
        const trimmed = reason.trim();
        if (!trimmed) {
          // A rejected promise keeps the dialog open until a reason is given.
          return Promise.reject(new Error('A download reason is required'));
        }
        resolve(trimmed);
        return Promise.resolve();
      },
      onCancel: () => resolve(null),
    });
  });
}

/** Append the download reason (when present) to an export URL. */
export function withDownloadReason(url: string, reason: string): string {
  if (!reason) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${DOWNLOAD_REASON_PARAM}=${encodeURIComponent(reason)}`;
}
