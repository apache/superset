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

import { isDST, extendedDayjs } from '../../utils/dates';
import type { TimezoneOption, OffsetsToName, GetOffsetKeyFn } from './types';

// Import dayjs plugin types for TypeScript support
import 'dayjs/plugin/timezone';

function getTimezoneDisplayName(
  timezoneName: string,
  currentDate: ReturnType<typeof extendedDayjs>,
  getOffsetKey: GetOffsetKeyFn,
  offsetsToName: OffsetsToName,
): string {
  const offsetKey = getOffsetKey(timezoneName);
  const dateInZone = currentDate.tz(timezoneName);
  const isDSTActive = isDST(dateInZone, timezoneName);
  const namePair = offsetsToName[offsetKey];
  return namePair ? (isDSTActive ? namePair[1] : namePair[0]) : timezoneName;
}

export class TimezoneOptionsCache {
  private cachedOptions: TimezoneOption[] | null = null;

  private computePromise: Promise<TimezoneOption[]> | null = null;

  constructor(
    private getOffsetKey: GetOffsetKeyFn,
    private offsetsToName: OffsetsToName,
  ) {}

  public isCached(): boolean {
    return this.cachedOptions !== null;
  }

  public getOptions(): TimezoneOption[] | null {
    return this.cachedOptions;
  }

  private computeOptions(): TimezoneOption[] {
    const currentDate = extendedDayjs(new Date());
    const allZones = Intl.supportedValuesOf('timeZone');
    const seenLabels = new Set<string>();
    const options: TimezoneOption[] = [];

    for (const zone of allZones) {
      const offsetKey = this.getOffsetKey(zone);
      const displayName = getTimezoneDisplayName(
        zone,
        currentDate,
        this.getOffsetKey,
        this.offsetsToName,
      );
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

    this.cachedOptions = options;
    return options;
  }

  public getOptionsAsync(): Promise<TimezoneOption[]> {
    if (this.cachedOptions) {
      return Promise.resolve(this.cachedOptions);
    }

    if (this.computePromise) {
      return this.computePromise;
    }

    // Use queueMicrotask for better performance than setTimeout(0)
    // Falls back to setTimeout for older browsers
    this.computePromise = new Promise<TimezoneOption[]>((resolve, reject) => {
      const run = () => {
        try {
          const result = this.computeOptions();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.computePromise = null;
        }
      };
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(run);
      } else {
        setTimeout(run, 0);
      }
    });

    return this.computePromise;
  }
}
