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
import { createRef, forwardRef, useImperativeHandle, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Input, Modal, Typography } from '@superset-ui/core/components';

export const DOWNLOAD_REASON_PARAM = 'download_reason';

/** Result formats the backend gates behind REQUIRE_DOWNLOAD_REASON. */
export const DOWNLOAD_REASON_FORMATS = ['csv', 'xlsx'];

/** Mirrors DOWNLOAD_REASON_MAX_LENGTH on the backend (also bounds GET export URLs). */
export const DOWNLOAD_REASON_MAX_LENGTH = 255;

type ReasonInputHandle = { showError: (message: string) => void };

type ReasonInputProps = { onChange: (value: string) => void };

/** Text area with an inline validation message the dialog can trigger. */
const ReasonInput = forwardRef<ReasonInputHandle, ReasonInputProps>(
  ({ onChange }, ref) => {
    const [error, setError] = useState<string | null>(null);
    useImperativeHandle(ref, () => ({ showError: setError }), []);
    return (
      <>
        <Input.TextArea
          autoFocus
          rows={3}
          maxLength={DOWNLOAD_REASON_MAX_LENGTH}
          status={error ? 'error' : undefined}
          aria-label={t('Download reason')}
          placeholder={t('Why are you downloading this data?')}
          onChange={e => {
            setError(null);
            onChange(e.target.value);
          }}
        />
        {error && (
          <Typography.Text type="danger" role="alert">
            {error}
          </Typography.Text>
        )}
      </>
    );
  },
);

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
    const input = createRef<ReasonInputHandle>();
    Modal.confirm({
      title: t('Download reason'),
      content: (
        <ReasonInput
          ref={input}
          onChange={value => {
            reason = value;
          }}
        />
      ),
      okText: t('Download'),
      cancelText: t('Cancel'),
      onOk: () => {
        const trimmed = reason.trim();
        if (!trimmed) {
          // Show the problem inline; the rejected promise keeps the dialog open.
          const message = t('A download reason is required');
          input.current?.showError(message);
          return Promise.reject(new Error(message));
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
