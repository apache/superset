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
import { getDatasetDefaultTimeFilter } from '../../src';

test.each([
  [
    '{"default_time_filter": "Last week", "warning_markdown": "x"}',
    'Last week',
  ],
  [{ default_time_filter: 'No filter' }, 'No filter'],
  ['{"default_time_filter": ""}', undefined],
  ['{"default_time_filter": 7}', undefined],
  ['{bad', undefined],
  ['[]', undefined],
  [undefined, undefined],
])('getDatasetDefaultTimeFilter(%p) returns %p', (extra, expected) => {
  expect(getDatasetDefaultTimeFilter({ extra })).toBe(expected);
});
