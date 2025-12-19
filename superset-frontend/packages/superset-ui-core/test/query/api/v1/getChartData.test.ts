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
import fetchMock from 'fetch-mock';
import { buildQueryContext, ApiV1, VizType } from '@superset-ui/core';
import setupClientForTest from '../setupClientForTest';

describe('API v1 > getChartData()', () => {
  beforeAll(() => setupClientForTest());
  afterEach(() => fetchMock.restore());

  it('returns a promise of ChartDataResponse', async () => {
    const response = {
      result: [
        {
          field1: 'abc',
          field2: 'def',
        },
      ],
    };

    fetchMock.post('glob:*/api/v1/chart/data', response);

    const result = await ApiV1.getChartData(
      buildQueryContext({
        granularity: 'minute',
        viz_type: VizType.WordCloud,
        datasource: '1__table',
      }),
    );
    return expect(result).toEqual(response);
  });
});
