/*
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

import NumberFormatter from '../NumberFormatter';
import { getIntlDurationFormatter } from '../utils/getIntlDurationFormatter';
import { parseMilliseconds } from '../utils/parseMilliseconds';

export default function createDurationFormatter(
  config: {
    description?: string;
    id?: string;
    label?: string;
    multiplier?: number;
    locale?: string;
    formatSubMilliseconds?: boolean;
  } & Intl.DurationFormatOptions = {},
) {
  const {
    description,
    id,
    label,
    multiplier = 1,
    locale,
    formatSubMilliseconds = false,
    ...intlOptions
  } = config;
  const durationFormatter = getIntlDurationFormatter(locale, {
    secondsDisplay: 'auto',
    style: 'narrow',
    ...intlOptions,
  });
  const zeroDurationFormatter = getIntlDurationFormatter(locale, {
    secondsDisplay: 'always',
    style: 'narrow',
    ...intlOptions,
  });
  return new NumberFormatter({
    description,
    formatFunc: value => {
      const durObject = parseMilliseconds(value * multiplier);

      if (!formatSubMilliseconds) {
        durObject.milliseconds = 0;
        durObject.microseconds = 0;
        durObject.nanoseconds = 0;
      }

      const isAllUnitsZero = Object.values(durObject).every(
        value => value === 0,
      );

      return (
        isAllUnitsZero ? zeroDurationFormatter : durationFormatter
      ).format(durObject);
    },
    id: id ?? 'duration_format',
    label: label ?? `Duration formatter`,
  });
}
