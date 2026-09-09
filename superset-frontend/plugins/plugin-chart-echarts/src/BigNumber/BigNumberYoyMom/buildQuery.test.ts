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
import { QueryFormData } from '@superset-ui/core';
import buildQuery from './buildQuery';

describe('BigNumberYoyMom buildQuery', () => {
  const baseFormData: QueryFormData = {
    datasource: '1__table',
    viz_type: 'big_number_yoy_mom',
    metric: 'value',
  };

  test('sets time_offsets from both comparison slots', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      comparison1_offset: '1 month ago',
      comparison2_offset: '1 year ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual([
      '1 month ago',
      '1 year ago',
    ]);
  });

  test('omits empty comparison offsets', () => {
    const queryContext = buildQuery({
      ...baseFormData,
      comparison1_offset: '1 month ago',
    });
    expect(queryContext.queries[0].time_offsets).toEqual(['1 month ago']);
  });

  test('returns empty time_offsets when no comparison is configured', () => {
    const queryContext = buildQuery(baseFormData);
    expect(queryContext.queries[0].time_offsets).toEqual([]);
  });
});
