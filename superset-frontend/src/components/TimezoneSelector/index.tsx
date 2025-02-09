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

import { useEffect, useMemo } from 'react';
import { t } from '@superset-ui/core';
import { Select } from 'src/components';
import { isDST, extendedDayjs } from 'src/utils/dates';

const DEFAULT_TIMEZONE = {
  name: 'GMT Standard Time',
  value: 'Africa/Abidjan', // timezones are deduped by the first alphabetical value
};

const MIN_SELECT_WIDTH = '400px';

const offsetsToName = {
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

export type TimezoneSelectorProps = {
  onTimezoneChange: (value: string) => void;
  timezone?: string | null;
  minWidth?: string;
};

export default function TimezoneSelector({
  onTimezoneChange,
  timezone,
  minWidth = MIN_SELECT_WIDTH, // smallest size for current values
}: TimezoneSelectorProps) {
  const { TIMEZONE_OPTIONS, TIMEZONE_OPTIONS_SORT_COMPARATOR, validTimezone } =
    useMemo(() => {
      const currentDate = extendedDayjs();
      const JANUARY = extendedDayjs.tz('2021-01-01');
      const JULY = extendedDayjs.tz('2021-07-01');

      const getOffsetKey = (name: string) =>
        JANUARY.tz(name).utcOffset().toString() +
        JULY.tz(name).utcOffset().toString();

      const getTimezoneName = (name: string) => {
        const offsets = getOffsetKey(name);
        return (
          (isDST(currentDate.tz(name), name)
            ? offsetsToName[offsets as keyof typeof offsetsToName]?.[1]
            : offsetsToName[offsets as keyof typeof offsetsToName]?.[0]) || name
        );
      };

      // TODO: remove this ts-ignore when typescript is upgraded to 5.1
      // @ts-ignore
      const ALL_ZONES: string[] = Intl.supportedValuesOf('timeZone');

      const labels = new Set<string>();
      const TIMEZONE_OPTIONS = ALL_ZONES.map(zone => {
        const label = `GMT ${extendedDayjs
          .tz(currentDate, zone)
          .format('Z')} (${getTimezoneName(zone)})`;

        if (labels.has(label)) {
          return null; // Skip duplicates
        }
        labels.add(label);
        return {
          label,
          value: zone,
          offsets: getOffsetKey(zone),
          timezoneName: zone,
        };
      }).filter(Boolean) as {
        label: string;
        value: string;
        offsets: string;
        timezoneName: string;
      }[];

      const TIMEZONE_OPTIONS_SORT_COMPARATOR = (
        a: (typeof TIMEZONE_OPTIONS)[number],
        b: (typeof TIMEZONE_OPTIONS)[number],
      ) =>
        extendedDayjs.tz(currentDate, a.timezoneName).utcOffset() -
        extendedDayjs.tz(currentDate, b.timezoneName).utcOffset();

      // pre-sort timezone options by time offset
      TIMEZONE_OPTIONS.sort(TIMEZONE_OPTIONS_SORT_COMPARATOR);

      const matchTimezoneToOptions = (timezone: string) => {
        const offsetKey = getOffsetKey(timezone);
        let fallbackValue: string | undefined;

        for (const option of TIMEZONE_OPTIONS) {
          if (
            option.offsets === offsetKey &&
            option.timezoneName === timezone
          ) {
            return option.value;
          }
          if (!fallbackValue && option.offsets === offsetKey) {
            fallbackValue = option.value;
          }
        }
        return fallbackValue || DEFAULT_TIMEZONE.value;
      };

      const validTimezone = matchTimezoneToOptions(
        timezone || extendedDayjs.tz.guess(),
      );

      return {
        TIMEZONE_OPTIONS,
        TIMEZONE_OPTIONS_SORT_COMPARATOR,
        validTimezone,
      };
    }, [timezone]);

  // force trigger a timezone update if provided `timezone` is not invalid
  useEffect(() => {
    if (validTimezone && timezone !== validTimezone) {
      onTimezoneChange(validTimezone);
    }
  }, [validTimezone, onTimezoneChange, timezone]);

  return (
    <Select
      ariaLabel={t('Timezone selector')}
      css={{ minWidth }}
      onChange={tz => onTimezoneChange(tz as string)}
      value={validTimezone}
      options={TIMEZONE_OPTIONS}
      sortComparator={TIMEZONE_OPTIONS_SORT_COMPARATOR}
    />
  );
}
