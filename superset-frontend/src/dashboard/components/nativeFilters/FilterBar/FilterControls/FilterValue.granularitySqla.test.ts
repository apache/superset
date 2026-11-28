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

import { resolveGranularitySqla } from './FilterValue';

test('resolveGranularitySqla prefers the filter own granularity_sqla', () => {
  expect(resolveGranularitySqla('order_date', true, 'main_dttm')).toEqual(
    'order_date',
  );
  expect(resolveGranularitySqla('order_date', false, 'main_dttm')).toEqual(
    'order_date',
  );
});

test('resolveGranularitySqla falls back to main_dttm_col when a time_range parent cascades', () => {
  expect(resolveGranularitySqla(undefined, true, 'main_dttm')).toEqual(
    'main_dttm',
  );
});

test('resolveGranularitySqla returns undefined without a time_range dependency', () => {
  expect(resolveGranularitySqla(undefined, false, 'main_dttm')).toBeUndefined();
});

test('resolveGranularitySqla returns undefined when the datasource has no main_dttm_col', () => {
  expect(resolveGranularitySqla(undefined, true, undefined)).toBeUndefined();
});
