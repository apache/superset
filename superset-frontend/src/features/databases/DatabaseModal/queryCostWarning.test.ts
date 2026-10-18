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
import {
  disableQueryCostWarning,
  getQueryCostWarning,
} from './queryCostWarning';
import { ExtraJson } from '../types';

test.each([undefined, false, true, 'true', 1])(
  'legacy opt-in must be exactly true (%s)',
  enabled => {
    const extra = {
      cost_estimate_warning_enabled: enabled,
      cost_estimate_warning_threshold_bytes: 100,
    } as ExtraJson;
    expect(getQueryCostWarning(extra, 'bigquery')).toEqual({
      enabled: enabled === true,
      metric: 'bytes_processed',
      threshold: 100,
    });
  },
);

test.each([-1, 0, 1.5, '100', true, null, 2 ** 53])(
  'invalid legacy threshold stays off without a default (%s)',
  threshold => {
    expect(
      getQueryCostWarning(
        {
          cost_estimate_warning_enabled: true,
          cost_estimate_warning_threshold_bytes: threshold,
        } as ExtraJson,
        'bigquery',
      ),
    ).toEqual({ enabled: false });
  },
);

test('legacy bytes do not become a PostgreSQL planner threshold', () => {
  expect(
    getQueryCostWarning(
      {
        cost_estimate_warning_enabled: true,
        cost_estimate_warning_threshold_bytes: 100,
      },
      'postgresql',
    ),
  ).toEqual({ enabled: false });
});

test.each([null, { enabled: false }, { enabled: true, threshold: 'invalid' }])(
  'an explicit new rule prevents legacy fallback (%j)',
  rule => {
    expect(
      getQueryCostWarning(
        {
          query_cost_warning: rule,
          cost_estimate_warning_enabled: true,
          cost_estimate_warning_threshold_bytes: 100,
        } as ExtraJson,
        'bigquery',
      ),
    ).toEqual(rule || {});
  },
);

test.each([NaN, Infinity, 0, -1, '100', true, 0.5])(
  'disabling drops invalid byte thresholds (%s)',
  threshold => {
    expect(
      disableQueryCostWarning({
        enabled: true,
        metric: 'bytes_processed',
        threshold,
      }),
    ).toEqual({ enabled: false, metric: 'bytes_processed' });
  },
);
