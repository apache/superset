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
import { getFormData } from '../../../../src/query/api/legacy';

import setupClientForTest from '../setupClientForTest';

describe('getFormData()', () => {
  beforeAll(setupClientForTest);

  afterEach(fetchMock.restore);

  const mockData = {
    datasource: '1__table',
    viz_type: 'sankey',
    slice_id: 1,
    url_params: {},
    granularity_sqla: null,
    time_grain_sqla: 'P1D',
    time_range: 'Last week',
    groupby: ['source', 'target'],
    metric: 'sum__value',
    adhoc_filters: [],
    row_limit: 1000,
  };

  it('returns formData for given slice id', () => {
    fetchMock.get(`glob:*/api/v1/form_data/?slice_id=1`, mockData);

    return expect(
      getFormData({
        sliceId: 1,
      }),
    ).resolves.toEqual(mockData);
  });

  it('overrides formData when overrideFormData is specified', () => {
    fetchMock.get(`glob:*/api/v1/form_data/?slice_id=1`, mockData);

    return expect(
      getFormData({
        sliceId: 1,
        overrideFormData: {
          metric: 'avg__value',
        },
      }),
    ).resolves.toEqual({
      ...mockData,
      metric: 'avg__value',
    });
  });
});
