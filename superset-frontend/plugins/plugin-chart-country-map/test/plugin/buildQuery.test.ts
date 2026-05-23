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
import buildQuery from '../../src/plugin/buildQuery';
import { CountryMapFormData } from '../../src/types';

const baseFormData: CountryMapFormData = {
  datasource: '3__table',
  viz_type: 'country_map',
  metric: 'sum__num',
  entity: 'iso_code',
  adhoc_filters: [],
};

test('buildQuery returns a chart/data context with one query', () => {
  const ctx = buildQuery(baseFormData);
  expect(ctx).toBeDefined();
  expect(Array.isArray(ctx.queries)).toBe(true);
  expect(ctx.queries.length).toBe(1);
});

test('buildQuery preserves form data on the context', () => {
  const ctx = buildQuery(baseFormData);
  expect(ctx.form_data).toMatchObject({
    viz_type: 'country_map',
    metric: 'sum__num',
    entity: 'iso_code',
  });
});

test('buildQuery normalizes orderby on the query object', () => {
  const ctx = buildQuery({ ...baseFormData, order_desc: true });
  // orderby should be present as an array (possibly empty if no metric ordering)
  expect(Array.isArray(ctx.queries[0].orderby)).toBe(true);
});
