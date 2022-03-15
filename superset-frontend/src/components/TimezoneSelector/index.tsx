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

import React, { useCallback, useEffect, useMemo } from 'react';
import moment from 'moment-timezone';
import { t } from '@superset-ui/core';
import { Select } from 'src/components';

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

const JANUARY = moment([2021, 1]);
const JULY = moment([2021, 7]);

// january and july are assumed to be reliable differentiators to determine DST.
// There is definitely no way this assumption could come back to bite us :grin:
const getOffsetKey = (name: string) =>
  JANUARY.tz(name).utcOffset().toString() +
  JULY.tz(name).utcOffset().toString();

const ALL_ZONES = moment.tz
  .countries()
  .map(country => moment.tz.zonesForCountry(country, true))
  .flat();

const TIMEZONES: moment.MomentZoneOffset[] = [];
ALL_ZONES.forEach(zone => {
  if (
    !TIMEZONES.find(
      option => getOffsetKey(option.name) === getOffsetKey(zone.name),
    )
  ) {
    TIMEZONES.push(zone); // dedupe zones by offsets
  }
});

export interface TimezoneProps {
  onTimezoneChange: (value: string) => void;
  timezone?: string | null;
}

interface TimezoneOption {
  label: string;
  value: string;
  offsets: string;
  timezoneName: string;
}

const TimezoneSelector = ({ onTimezoneChange, timezone }: TimezoneProps) => {
  const currentDate = useMemo(moment, []);

  const getTimezoneName = useCallback(
    (name: string) => {
      const offsets = getOffsetKey(name);
      return (
        (currentDate.tz(name).isDST()
          ? offsetsToName[offsets]?.[1]
          : offsetsToName[offsets]?.[0]) || name
      );
    },
    [currentDate],
  );

  const sortComparator = useCallback(
    (a: TimezoneOption, b: TimezoneOption) =>
      moment.tz(currentDate, a.timezoneName).utcOffset() -
      moment.tz(currentDate, b.timezoneName).utcOffset(),
    [currentDate],
  );

  const timezoneOptions = useMemo(() => {
    const options = TIMEZONES.map(zone => ({
      label: `GMT ${moment
        .tz(currentDate, zone.name)
        .format('Z')} (${getTimezoneName(zone.name)})`,
      value: zone.name,
      offsets: getOffsetKey(zone.name),
      timezoneName: zone.name,
    }));
    // pre-sort timezone options by time offset
    options.sort(sortComparator);
    return options;
  }, [currentDate, sortComparator]);

  const validTimezone = useMemo(
    () =>
      timezoneOptions.find(
        option =>
          option.offsets === getOffsetKey(timezone || moment.tz.guess()),
      )?.value || DEFAULT_TIMEZONE.value,
    [timezoneOptions, timezone],
  );

  // force trigger a timezone update if provided `timezone` is not invalid
  useEffect(() => {
    if (timezone !== validTimezone) {
      onTimezoneChange(validTimezone);
    }
  }, [validTimezone, onTimezoneChange, timezone]);

  return (
    <Select
      ariaLabel={t('Timezone selector')}
      css={{ minWidth: MIN_SELECT_WIDTH }} // smallest size for current values
      onChange={tz => onTimezoneChange(tz as string)}
      value={validTimezone}
      options={timezoneOptions}
      sortComparator={sortComparator}
    />
  );
};

export default TimezoneSelector;
