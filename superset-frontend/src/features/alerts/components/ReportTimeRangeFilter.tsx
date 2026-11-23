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
import { ComponentType, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { NO_TIME_RANGE } from '@superset-ui/core';
import { Flex, FormItem, Loading } from '@superset-ui/core/components';
import type { DateFilterControlProps } from 'src/explore/components/controls/DateFilterControl/types';
import { limitCheckMessage } from 'src/dashboard/components/nativeFilters/FilterBar/utils';
import { LimitsUnavailableAlert } from 'src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/TimeRangeLimitsAlerts';
import { StatusMessage } from 'src/filters/components/common';
import { checkTimeRange } from 'src/utils/timeRangeLimits';
import type { ReportFilterLimits } from '../hooks/useDashboardFilterLimits';

type ReportTimeRangeFilterProps = {
  DateFilterComponent: ComponentType<DateFilterControlProps>;
  filterId: string;
  value?: string;
  limits: ReportFilterLimits;
  onRetry: () => void;
  onChange: (timeRange: string) => void;
};

/**
 * A report's Time Range filter value. With time range limits on, it checks
 * the value as the dashboard's filter bar does and shows the reason under
 * the picker; limits that can't be loaded show the dashboard's unavailable
 * alert with a retry instead of the picker.
 */
export default function ReportTimeRangeFilter({
  DateFilterComponent,
  filterId,
  value,
  limits,
  onRetry,
  onChange,
}: ReportTimeRangeFilterProps) {
  const [message, setMessage] = useState<string>();
  const timeRange = value || NO_TIME_RANGE;
  const levels = limits.status === 'on' ? limits.limits.levels : null;
  const levelsKey = JSON.stringify(levels);

  useEffect(() => {
    setMessage(undefined);
    if (!levels) {
      return undefined;
    }
    let active = true;
    checkTimeRange(timeRange, levels).then(check => {
      if (active) {
        setMessage(limitCheckMessage(check));
      }
    });
    return () => {
      active = false;
    };
  }, [timeRange, levelsKey]);

  if (limits.status === 'loading') {
    return (
      <Flex align="center" aria-busy>
        <Loading position="inline" size="s" muted />
        {t('Loading filter values')}
      </Flex>
    );
  }
  if (limits.status === 'unavailable') {
    return <LimitsUnavailableAlert onRetry={onRetry} />;
  }
  const messageId = `${filterId}-limit-error`;
  const picker = (
    <DateFilterComponent
      name={filterId}
      onChange={onChange}
      value={value}
      timeRangeLimits={
        limits.status === 'on'
          ? { ...limits.limits, ...(message && { describedBy: messageId }) }
          : undefined
      }
    />
  );
  if (limits.status === 'off') {
    return picker;
  }
  return (
    <FormItem
      validateStatus={message ? 'error' : undefined}
      extra={
        message ? (
          <StatusMessage id={messageId} role="alert" status="error">
            {message}
          </StatusMessage>
        ) : undefined
      }
    >
      {picker}
    </FormItem>
  );
}
