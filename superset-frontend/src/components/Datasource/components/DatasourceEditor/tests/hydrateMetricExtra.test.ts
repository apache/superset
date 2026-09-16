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
import { hydrateMetricExtra } from '../DatasourceEditor';

const metric = { metric_name: 'sum__num', expression: 'SUM(num)' };

test('lifts the warning and certification out of the extra JSON string', () => {
  expect(
    hydrateMetricExtra({
      ...metric,
      extra: JSON.stringify({
        warning_markdown: 'Handle with care',
        certification: { certified_by: 'Data team', details: 'Reviewed' },
      }),
    }),
  ).toMatchObject({
    warning_markdown: 'Handle with care',
    certified_by: 'Data team',
    certification_details: 'Reviewed',
  });
});

test('keeps an already-flattened warning when the metric carries no extra (#42704)', () => {
  // Explore's bootstrap payload flattens `extra` into `warning_markdown` and
  // drops the raw string, so the flattened value is all there is to go on.
  expect(
    hydrateMetricExtra({ ...metric, warning_markdown: 'Handle with care' })
      .warning_markdown,
  ).toBe('Handle with care');
});

test('lets an empty warning in extra clear the flattened value', () => {
  expect(
    hydrateMetricExtra({
      ...metric,
      warning_markdown: 'stale',
      extra: '{}',
    }).warning_markdown,
  ).toBe('');
});

test('normalizes a missing warning to an empty string', () => {
  expect(hydrateMetricExtra(metric).warning_markdown).toBe('');
});

test('resolves certification conflicts between the metric and its extra blob', () => {
  expect(
    hydrateMetricExtra({
      ...metric,
      certified_by: 'Analytics',
      certification_details: 'Owned by Analytics',
      extra: JSON.stringify({
        certification: { certified_by: 'Data team', details: 'Reviewed' },
      }),
    }),
  ).toMatchObject({
    // extra wins for the certifier, while the metric's own details field wins
    // for the description — the certification form writes both back into extra
    // on save, so the two settle on the same source afterwards
    certified_by: 'Data team',
    certification_details: 'Owned by Analytics',
  });
});

test('does not throw on malformed extra, falling back like an absent extra', () => {
  expect(() =>
    hydrateMetricExtra({
      ...metric,
      warning_markdown: 'Handle with care',
      extra: '{not valid json',
    }),
  ).not.toThrow();
  expect(
    hydrateMetricExtra({
      ...metric,
      warning_markdown: 'Handle with care',
      extra: '{not valid json',
    }).warning_markdown,
  ).toBe('Handle with care');
});
