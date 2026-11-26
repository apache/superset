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
import { ReactNode, useCallback } from 'react';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Button, Flex } from '@superset-ui/core/components';
import { limitAlertIcon } from 'src/components/TimeRangeLimits/limitAlertIcon';

export const TIME_RANGE_REASON_ID = 'explore-time-range-reason';
export const TIME_RANGE_FAILED_TEXT_ID = 'explore-time-range-failed-text';

/**
 * Puts the "limits could not be loaded" alert, with its Retry, above the
 * chart area's content while the limits failed.
 */
export default function useTimeRangeAlert({
  failed,
  retrying,
  onRetry,
}: {
  failed?: boolean;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  const timeRangeAlert = failed ? (
    <Alert
      type="error"
      showIcon
      icon={limitAlertIcon('error')}
      closable={false}
      message={
        <span id={TIME_RANGE_FAILED_TEXT_ID}>
          {t(
            'Time range limits could not be loaded. Queries are paused to protect the database.',
          )}
        </span>
      }
      action={
        <Button buttonSize="small" loading={retrying} onClick={onRetry}>
          {t('Retry')}
        </Button>
      }
    />
  ) : null;
  return useCallback(
    (content: ReactNode) =>
      timeRangeAlert ? (
        <Flex vertical gap="middle">
          {timeRangeAlert}
          {content}
        </Flex>
      ) : (
        content
      ),
    [timeRangeAlert],
  );
}
