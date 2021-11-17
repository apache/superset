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
import { fetchExploreJson } from '@superset-ui/core/src/query/api/legacy';
import setupClientForTest from '../setupClientForTest';

describe('fetchExploreJson()', () => {
  beforeAll(setupClientForTest);

  afterEach(fetchMock.restore);

  it('returns a promise of LegacyChartDataResponse', () => {
    fetchMock.post('glob:*/superset/explore_json/', {
      field1: 'abc',
      field2: 'def',
    });

    return expect(
      fetchExploreJson({
        formData: {
          granularity: 'minute',
          viz_type: 'word_cloud',
          datasource: '1__table',
        },
      }),
    ).resolves.toEqual({
      field1: 'abc',
      field2: 'def',
    });
  });
  it('uses GET when specified', async () => {
    expect.assertions(4);
    const mockUrl = 'glob:*/superset/explore_json/*';

    fetchMock.get(mockUrl, {
      field1: 'abc',
      field2: 'def',
    });

    const result = await fetchExploreJson({
      method: 'GET',
      formData: {
        granularity: 'minute',
        viz_type: 'word_cloud',
        datasource: '1__table',
      },
    });

    expect(result).toEqual({
      field1: 'abc',
      field2: 'def',
    });
    const mockCalls = fetchMock.calls(mockUrl);
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0][0]).toEqual(
      'http://localhost/superset/explore_json/?form_data=%7B%22granularity%22%3A%22minute%22%2C%22viz_type%22%3A%22word_cloud%22%2C%22datasource%22%3A%221__table%22%7D',
    );
    expect(mockCalls[0][1]).toEqual(
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
  });
});
