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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core';
import { Select } from '@superset-ui/core/components';
import { extendedDayjs } from '../../utils/dates';
import {
  timezoneOptionsCache,
  getOffsetKey,
  DEFAULT_TIMEZONE,
} from './TimezoneOptionsCache';
import type { TimezoneOption } from './types';

// Import dayjs plugin types for TypeScript support
import 'dayjs/plugin/timezone';

export type TimezoneSelectorProps = {
  onTimezoneChange: (value: string) => void;
  timezone?: string | null;
  minWidth?: string;
  placeholder?: string;
};

const MIN_SELECT_WIDTH = '400px';

function findMatchingTimezone(
  timezone: string | null | undefined,
  options: TimezoneOption[],
): string {
  const targetTimezone = timezone || extendedDayjs.tz.guess();
  const targetOffsetKey = getOffsetKey(targetTimezone);
  let fallbackValue: string | undefined;

  for (const option of options) {
    if (
      option.offsets === targetOffsetKey &&
      option.timezoneName === targetTimezone
    ) {
      return option.value;
    }
    if (!fallbackValue && option.offsets === targetOffsetKey) {
      fallbackValue = option.value;
    }
  }

  return fallbackValue || DEFAULT_TIMEZONE.value;
}

export default function TimezoneSelector({
  onTimezoneChange,
  timezone,
  minWidth: _minWidth = MIN_SELECT_WIDTH,
  placeholder,
  ...rest
}: TimezoneSelectorProps) {
  const [timezoneOptions, setTimezoneOptions] = useState<
    TimezoneOption[] | null
  >(timezoneOptionsCache.getOptions());
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const hasSetDefaultRef = useRef(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !timezoneOptions && !isLoadingOptions) {
        setIsLoadingOptions(true);
        timezoneOptionsCache
          .getOptionsAsync()
          .then(options => {
            setTimezoneOptions(options);
          })
          .finally(() => setIsLoadingOptions(false));
      }
    },
    [timezoneOptions, isLoadingOptions],
  );

  const sortComparator = useMemo(() => {
    if (!timezoneOptions) return undefined;
    const currentDate = extendedDayjs();
    const comparator = (a: TimezoneOption, b: TimezoneOption) =>
      currentDate.tz(a.timezoneName).utcOffset() -
      currentDate.tz(b.timezoneName).utcOffset();
    return comparator;
  }, [timezoneOptions]);

  const validTimezone = useMemo(() => {
    let result: string | undefined;
    if (!timezoneOptions) {
      // Don't call tz.guess() synchronously to avoid blocking render
      // Return timezone if provided, otherwise undefined (will be set after options load)
      result = timezone || undefined;
    } else {
      result = findMatchingTimezone(timezone, timezoneOptions);
    }
    return result;
  }, [timezone, timezoneOptions]);

  // Load timezone options asynchronously when component mounts
  // Parent component (AlertReportModal) already delays mounting until panel opens
  useEffect(() => {
    if (timezoneOptions || isLoadingOptions) return;

    setIsLoadingOptions(true);

    timezoneOptionsCache
      .getOptionsAsync()
      .then(options => {
        setTimezoneOptions(options);

        // Set default value if no timezone is provided and we haven't set it yet
        if (!timezone && !hasSetDefaultRef.current) {
          const defaultTz = findMatchingTimezone(null, options);
          onTimezoneChange(defaultTz);
          hasSetDefaultRef.current = true;
        }
      })
      .finally(() => {
        setIsLoadingOptions(false);
      });
  }, [timezoneOptions, isLoadingOptions, timezone, onTimezoneChange]);

  // Set default value when cached options are available on mount
  useEffect(() => {
    if (!timezoneOptions || timezone || hasSetDefaultRef.current) return;

    const defaultTz = findMatchingTimezone(null, timezoneOptions);
    onTimezoneChange(defaultTz);
    hasSetDefaultRef.current = true;
  }, [timezoneOptions, timezone, onTimezoneChange]);

  const selectValue = timezoneOptions ? validTimezone : undefined;

  return (
    <Select
      ariaLabel={t('Timezone selector')}
      onChange={tz => {
        onTimezoneChange(tz as string);
      }}
      onOpenChange={handleOpenChange}
      value={selectValue}
      options={timezoneOptions || []}
      sortComparator={sortComparator}
      loading={isLoadingOptions}
      placeholder={isLoadingOptions ? t('Loading timezones...') : placeholder}
      {...{ placement: 'topLeft', ...rest }}
    />
  );
}
