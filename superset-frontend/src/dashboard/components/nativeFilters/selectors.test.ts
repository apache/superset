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
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import { getCrossFilterIndicator } from './selectors';

describe('getCrossFilterIndicator', () => {
  const chartId = 123;
  const chartLayoutItems = [
    {
      id: 'chart-123',
      type: CHART_TYPE,
      children: [],
      parents: ['ROOT_ID'],
      meta: {
        chartId,
        sliceName: 'Test Chart',
        uuid: 'uuid-123',
        height: 10,
        width: 10,
      },
    },
  ];

  it('returns correct indicator with label from filterState.label', () => {
    const dataMask = {
      filterState: { label: 'foo', value: 'bar' },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'foo',
    });
  });

  it('returns correct indicator with label from filterState.value', () => {
    const dataMask = {
      filterState: { value: ['bar', 'baz'] },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'bar, baz',
    });
  });

  it('returns correct indicator with column and customColumnLabel', () => {
    const dataMask = {
      filterState: {
        value: 'valA',
        filters: { col: 'col' },
        customColumnLabel: 'label',
      },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'col',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valA',
      customColumnLabel: 'label',
    });
  });

  it('returns correct indicator with column from extraFormData.filters', () => {
    const filterClause = { col: 'colB', op: 'IS NOT NULL' as const };
    const dataMask = {
      filterState: { value: 'valB' },
      extraFormData: { filters: [filterClause] },
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'colB',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valB',
    });
  });

  it('returns correct indicator with column from filterState.filters', () => {
    const dataMask = {
      filterState: { value: 'valC', filters: { colC: 'something' } },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: 'colC',
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: 'valC',
    });
  });

  it('returns empty name and path if chartLayoutItem is not found', () => {
    const dataMask = {
      filterState: { value: 'valD' },
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(999, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: '',
      path: [''],
      value: 'valD',
    });
  });

  it('returns null value if no label or value in filterState', () => {
    const dataMask = {
      filterState: {},
      extraFormData: {},
    };
    const result = getCrossFilterIndicator(chartId, dataMask, chartLayoutItems);
    expect(result).toEqual({
      column: undefined,
      name: 'Test Chart',
      path: ['ROOT_ID', 'chart-123'],
      value: null,
    });
  });
});
