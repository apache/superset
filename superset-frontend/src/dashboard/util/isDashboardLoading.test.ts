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
import isDashboardLoading, { ChartLoadTimestamps } from './isDashboardLoading';

describe('isDashboardLoading', () => {
  it('returns false when no charts are loading', () => {
    const charts: Record<string, ChartLoadTimestamps> = {
      a: { chartUpdateStartTime: 1, chartUpdateEndTime: 2 },
      b: { chartUpdateStartTime: 5, chartUpdateEndTime: 5 },
    };
    expect(isDashboardLoading(charts)).toBe(false);
  });

  it('returns true when any chart has start > end', () => {
    const charts: Record<string, ChartLoadTimestamps> = {
      a: { chartUpdateStartTime: 10, chartUpdateEndTime: 5 },
      b: { chartUpdateStartTime: 1, chartUpdateEndTime: 2 },
    };
    expect(isDashboardLoading(charts)).toBe(true);
  });

  it('treats missing end as 0', () => {
    const charts: Record<string, ChartLoadTimestamps> = {
      a: { chartUpdateStartTime: 1 },
    };
    expect(isDashboardLoading(charts)).toBe(true);
  });

  it('handles empty charts object', () => {
    expect(isDashboardLoading({})).toBe(false);
  });
});
