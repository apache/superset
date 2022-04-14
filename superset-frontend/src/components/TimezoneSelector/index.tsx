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

import React, { useEffect, useMemo } from 'react';
import moment from 'moment-timezone';
import { t } from '@superset-ui/core';
import { Select } from 'src/components';

const DEFAULT_TIMEZONE = {
  name: 'GMT Standard Time',
  value: 'Africa/Abidjan', // timezones are deduped by the first alphabetical value
};

const MIN_SELECT_WIDTH = '400px';

const currentDate = moment();
const JANUARY = moment([2021, 1]);
const JULY = moment([2021, 7]);

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

const TIMEZONE_OPTIONS = TIMEZONES.map(zone => ({
  label: `GMT ${moment
    .tz(currentDate, zone.name)
    .format('Z')}`,
  value: zone.name,
  offsets: getOffsetKey(zone.name),
  timezoneName: zone.name,
}));

const TIMEZONE_OPTIONS_SORT_COMPARATOR = (
  a: typeof TIMEZONE_OPTIONS[number],
  b: typeof TIMEZONE_OPTIONS[number],
) =>
  moment.tz(currentDate, a.timezoneName).utcOffset() -
  moment.tz(currentDate, b.timezoneName).utcOffset();

// pre-sort timezone options by time offset
TIMEZONE_OPTIONS.sort(TIMEZONE_OPTIONS_SORT_COMPARATOR);

const matchTimezoneToOptions = (timezone: string) =>
  TIMEZONE_OPTIONS.find(option => option.offsets === getOffsetKey(timezone))
    ?.value || DEFAULT_TIMEZONE.value;

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
  const validTimezone = useMemo(
    () => matchTimezoneToOptions(timezone || moment.tz.guess()),
    [timezone],
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
      css={{ minWidth }}
      onChange={tz => onTimezoneChange(tz as string)}
      value={validTimezone}
      options={TIMEZONE_OPTIONS}
      sortComparator={TIMEZONE_OPTIONS_SORT_COMPARATOR}
    />
  );
}
