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
import { Alert } from '@apache-superset/core/components';
import { Button } from '@superset-ui/core/components';
import { limitAlertIcon } from 'src/components/TimeRangeLimits/limitAlertIcon';
import {
  bindingSpan,
  describeLimit,
  describeLimits,
  type LimitCheck,
} from 'src/utils/timeRangeLimits';
import { limitsUnavailableMessage } from 'src/dashboard/components/nativeFilters/utils';

const limitsAlertMessage = ({
  limits,
  today,
}: Extract<LimitCheck, { status: 'checked' }>) => {
  const span = bindingSpan(today, limits.maxSpan);
  return span
    ? t('This dashboard limits time ranges to %(limit)s.', {
        limit: describeLimit(span.limit),
      })
    : describeLimits(limits, null, today, undefined, true).line;
};

/** The limits a time range filter's default must keep to. */
export function DefaultLimitsAlert({
  check,
}: {
  check: Extract<LimitCheck, { status: 'checked' }>;
}) {
  return (
    <Alert
      type="info"
      icon={limitAlertIcon('info')}
      closable={false}
      showIcon
      message={limitsAlertMessage(check)}
    />
  );
}

export function LimitsUnavailableAlert({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert
      type="error"
      icon={limitAlertIcon('error')}
      closable={false}
      message={limitsUnavailableMessage()}
      action={
        <Button buttonSize="small" onClick={onRetry}>
          {t('Retry')}
        </Button>
      }
    />
  );
}

export function PreviewAfterSaveAlert() {
  return (
    <Alert
      type="info"
      icon={limitAlertIcon('info')}
      closable={false}
      message={t('Values load after you save')}
      description={t(
        'Time range limits are on. Save the filter to load its values here, or set a pre-filter time range.',
      )}
    />
  );
}
