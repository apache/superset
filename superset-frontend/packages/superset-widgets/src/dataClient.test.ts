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
import { sessionDataClient, widgetRef } from './dataClient';

const mockFetchQueryData = jest.fn();

jest.mock('./chartData', () => ({
  describeFetchError: async (error: unknown) => String(error),
  fetchQueryData: (binding: unknown) => mockFetchQueryData(binding),
}));

beforeEach(() => {
  mockFetchQueryData.mockReset();
  mockFetchQueryData.mockResolvedValue({ columns: [], rows: [] });
});

test('the session client queries ad hoc, active filters after the authored ones', async () => {
  const dataBinding = {
    datasetId: 1,
    metrics: ['count'],
    filters: [{ expressionType: 'SQL', clause: 'WHERE', sqlExpression: '1=1' }],
  };

  await sessionDataClient.fetchData({
    instanceId: 'node_1',
    widget: widgetRef('echarts', { dataBinding }),
    filters: [{ column: 'region', operator: 'IN', value: ['a', 'b'] }],
  });

  expect(mockFetchQueryData).toHaveBeenCalledWith({
    ...dataBinding,
    filters: [
      dataBinding.filters[0],
      {
        expressionType: 'SIMPLE',
        subject: 'region',
        clause: 'WHERE',
        operator: 'IN',
        comparator: ['a', 'b'],
      },
    ],
  });
});

test('a widget without a data binding is rejected before querying', async () => {
  await expect(
    sessionDataClient.fetchData({
      instanceId: 'node_1',
      widget: widgetRef('echarts', {}),
      filters: [],
    }),
  ).rejects.toThrow('no dataBinding');
  expect(mockFetchQueryData).not.toHaveBeenCalled();
});

test('widgetRef carries the saved id only when there is one', () => {
  expect(widgetRef('markdown', { content: 'x' })).toEqual({
    type: 'markdown',
    props: { content: 'x' },
  });
  expect(widgetRef('markdown', {}, 'uuid')).toEqual({
    id: 'uuid',
    type: 'markdown',
    props: {},
  });
});
