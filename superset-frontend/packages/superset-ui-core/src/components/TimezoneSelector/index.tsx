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
import { t } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { isDST, extendedDayjs } from '../../utils/dates';

export type TimezoneSelectorProps = {
  onTimezoneChange: (value: string) => void;
  timezone?: string | null;
  minWidth?: string;
  placeholder?: string;
};

type TimezoneOption = {
  label: string;
  value: string;
  offsets: string;
  timezoneName: string;
};

const DEFAULT_TIMEZONE = {
  name: 'GMT Standard Time',
  value: 'Africa/Abidjan', // timezones are deduped by the first alphabetical value
};

const MIN_SELECT_WIDTH = '400px';

const JANUARY_REF = extendedDayjs.tz('2021-01-01');
const JULY_REF = extendedDayjs.tz('2021-07-01');

const offsetsToName: Record<string, [string, string]> = {
  '-300-240': ['Eastern Standard Time', 'Eastern Daylight Time'],
  '-360-300': ['Central Standard Time', 'Central Daylight Time'],
  '-420-360': ['Mountain Standard Time', 'Mountain Daylight Time'],
  '-420-420': [
    'Mountain Standard Time - Phoenix',
    'Mountain Standard Time - Phoenix',
  ],
  '-480-420': ['Pacific Standard Time', 'Pacific Daylight Time'],
  '-540-480': ['Alaska Standard Time', 'Alaska Daylight Time'],
  '-600-600': ['Hawaii Standard Time', 'Hawaii Daylight Time'],
  '60120': ['Central European Time', 'Central European Daylight Time'],
  '00': [DEFAULT_TIMEZONE.name, DEFAULT_TIMEZONE.name],
  '060': ['GMT Standard Time - London', 'British Summer Time'],
};

let cachedTimezoneOptions: TimezoneOption[] | null = null;
let computePromise: Promise<TimezoneOption[]> | null = null;

// Export function to check if options are cached (for parent components)
export function areTimezoneOptionsCached(): boolean {
  return cachedTimezoneOptions !== null;
}

function getOffsetKey(timezoneName: string): string {
  return (
    JANUARY_REF.tz(timezoneName).utcOffset().toString() +
    JULY_REF.tz(timezoneName).utcOffset().toString()
  );
}

function getTimezoneDisplayName(
  timezoneName: string,
  currentDate: ReturnType<typeof extendedDayjs>,
): string {
  const offsetKey = getOffsetKey(timezoneName);
  const dateInZone = currentDate.tz(timezoneName);
  const isDSTActive = isDST(dateInZone, timezoneName);
  const namePair = offsetsToName[offsetKey];
  return namePair ? (isDSTActive ? namePair[1] : namePair[0]) : timezoneName;
}

function computeTimezoneOptions(): TimezoneOption[] {
  const currentDate = extendedDayjs(new Date());
  const allZones = Intl.supportedValuesOf('timeZone');
  const seenLabels = new Set<string>();
  const options: TimezoneOption[] = [];

  for (const zone of allZones) {
    const offsetKey = getOffsetKey(zone);
    const displayName = getTimezoneDisplayName(zone, currentDate);
    const offset = currentDate.tz(zone).format('Z');
    const label = `GMT ${offset} (${displayName})`;

    if (!seenLabels.has(label)) {
      seenLabels.add(label);
      options.push({
        label,
        value: zone,
        offsets: offsetKey,
        timezoneName: zone,
      });
    }
  }

  cachedTimezoneOptions = options;
  return options;
}

function getTimezoneOptionsAsync(): Promise<TimezoneOption[]> {
  if (cachedTimezoneOptions) {
    return Promise.resolve(cachedTimezoneOptions);
  }

  if (computePromise) {
    return computePromise;
  }

  // Use queueMicrotask for better performance than setTimeout(0)
  // Falls back to setTimeout for older browsers
  computePromise = new Promise<TimezoneOption[]>((resolve, reject) => {
    const run = () => {
      try {
        const result = computeTimezoneOptions();
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        computePromise = null;
      }
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(run);
    } else {
      setTimeout(run, 0);
    }
  });

  return computePromise;
}

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
  minWidth = MIN_SELECT_WIDTH,
  placeholder,
  ...rest
}: TimezoneSelectorProps) {
  const [timezoneOptions, setTimezoneOptions] = useState<
    TimezoneOption[] | null
  >(cachedTimezoneOptions);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const hasSetDefaultRef = useRef(false);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen && !timezoneOptions && !isLoadingOptions) {
        setIsLoadingOptions(true);
        getTimezoneOptionsAsync()
          .then(options => {
            // Cache options at module level for future instances
            cachedTimezoneOptions = options;
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

    getTimezoneOptionsAsync()
      .then(options => {
        // Cache options at module level for future instances
        cachedTimezoneOptions = options;
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
