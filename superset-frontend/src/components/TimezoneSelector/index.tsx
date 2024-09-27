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

import { useEffect, useMemo, useState } from 'react';
import { t } from '@superset-ui/core';
import { Select } from 'src/components';
import Loading from 'src/components/Loading';

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
  const [momentLib, setMomentLib] = useState<
    typeof import('moment-timezone') | null
  >(null);

  useEffect(() => {
    import('moment-timezone').then(momentLib =>
      setMomentLib(() => momentLib.default),
    );
  }, []);

  const { TIMEZONE_OPTIONS, TIMEZONE_OPTIONS_SORT_COMPARATOR, validTimezone } =
    useMemo(() => {
      if (!momentLib) {
        return {};
      }
      const currentDate = momentLib();
      const JANUARY = momentLib([2021, 1]);
      const JULY = momentLib([2021, 7]);

      const getOffsetKey = (name: string) =>
        JANUARY.tz(name).utcOffset().toString() +
        JULY.tz(name).utcOffset().toString();

      const getTimezoneName = (name: string) => {
        const offsets = getOffsetKey(name);
        return (
          (currentDate.tz(name).isDST()
            ? offsetsToName[offsets]?.[1]
            : offsetsToName[offsets]?.[0]) || name
        );
      };

      const ALL_ZONES = momentLib.tz
        .countries()
        .map(country => momentLib.tz.zonesForCountry(country, true))
        .flat();

      const TIMEZONES: import('moment-timezone').MomentZoneOffset[] = [];
      ALL_ZONES.forEach(zone => {
        if (
          !TIMEZONES.find(
            option => getOffsetKey(option.name) === getOffsetKey(zone.name),
          )
        ) {
          TIMEZONES.push(zone); // dedupe zones by offsets
        }
      });

      const TIMEZONE_OPTIONS = TIMEZONES.map(zone => ({
        label: `GMT ${momentLib
          .tz(currentDate, zone.name)
          .format('Z')} (${getTimezoneName(zone.name)})`,
        value: zone.name,
        offsets: getOffsetKey(zone.name),
        timezoneName: zone.name,
      }));

      const TIMEZONE_OPTIONS_SORT_COMPARATOR = (
        a: (typeof TIMEZONE_OPTIONS)[number],
        b: (typeof TIMEZONE_OPTIONS)[number],
      ) =>
        momentLib.tz(currentDate, a.timezoneName).utcOffset() -
        momentLib.tz(currentDate, b.timezoneName).utcOffset();

      // pre-sort timezone options by time offset
      TIMEZONE_OPTIONS.sort(TIMEZONE_OPTIONS_SORT_COMPARATOR);

      const matchTimezoneToOptions = (timezone: string) =>
        TIMEZONE_OPTIONS.find(
          option => option.offsets === getOffsetKey(timezone),
        )?.value || DEFAULT_TIMEZONE.value;

      const validTimezone = matchTimezoneToOptions(
        timezone || momentLib.tz.guess(),
      );

      return {
        TIMEZONE_OPTIONS,
        TIMEZONE_OPTIONS_SORT_COMPARATOR,
        validTimezone,
      };
    }, [momentLib, timezone]);

  // force trigger a timezone update if provided `timezone` is not invalid
  useEffect(() => {
    if (validTimezone && timezone !== validTimezone) {
      onTimezoneChange(validTimezone);
    }
  }, [validTimezone, onTimezoneChange, timezone]);

  if (!TIMEZONE_OPTIONS || !TIMEZONE_OPTIONS_SORT_COMPARATOR) {
    return <Loading position="inline-centered" />;
  }

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
