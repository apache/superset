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
import { allEventHandlers, clickEventHandler } from './eventHandlers';
import { BaseTransformedProps, CrossFilterTransformedProps } from '../types';

type TransformedProps = BaseTransformedProps<QueryFormData> &
  CrossFilterTransformedProps;

const baseTransformedProps: TransformedProps = {
  echartOptions: {},
  formData: {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
  } as QueryFormData,
  height: 400,
  width: 600,
  refs: { echartRef: { current: null } },
  groupby: ['country'],
  labelMap: {
    USA: ['USA'],
    Canada: ['Canada'],
  },
  setDataMask: jest.fn(),
  selectedValues: {},
  emitCrossFilters: true,
  onContextMenu: jest.fn(),
  coltypeMapping: { country: 1 },
};

test('allEventHandlers returns drill-down click handler when onDrillDown is present', () => {
  const onDrillDown = jest.fn();
  const props = {
    ...baseTransformedProps,
    onDrillDown,
  };

  const handlers = allEventHandlers(props);

  expect(handlers.click).toBeDefined();
  expect(handlers.contextmenu).toBeDefined();

  // Invoke the click handler
  handlers.click({ name: 'USA' });

  // Should call onDrillDown with filters and label
  expect(onDrillDown).toHaveBeenCalledTimes(1);
  expect(onDrillDown).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ col: 'country', op: '==', val: 'USA' }),
    ]),
    'USA',
  );
});

test('drill-down click handler skips leading metric tokens in labelMap entries', () => {
  const onDrillDown = jest.fn();
  // Multi-metric charts (e.g. timeseries) produce labelMap entries that are
  // prefixed with metric/series tokens ahead of the groupby values.
  const props: TransformedProps = {
    ...baseTransformedProps,
    groupby: ['country'],
    labelMap: {
      'SUM(sales), USA': ['SUM(sales)', 'USA'],
    },
    onDrillDown,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'SUM(sales), USA' });

  // The groupby column must bind to the trailing groupby value ('USA'),
  // not the leading metric token ('SUM(sales)').
  expect(onDrillDown).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ col: 'country', op: '==', val: 'USA' }),
    ]),
    expect.any(String),
  );
});

test('drill-down click handler reports the click via onDrillDown only', () => {
  const onDrillDown = jest.fn();
  const setDataMask = jest.fn();
  const props: TransformedProps = {
    ...baseTransformedProps,
    onDrillDown,
    setDataMask,
    emitCrossFilters: true,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'USA' });

  // onDrillDown should be called with the clicked filters
  expect(onDrillDown).toHaveBeenCalledTimes(1);
  expect(onDrillDown).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ col: 'country', op: '==', val: 'USA' }),
    ]),
    expect.any(String),
  );
  // The cross-filter is emitted by the DrillDownHost with the full drill
  // path, so the plugin's drill handler must NOT emit one itself.
  expect(setDataMask).not.toHaveBeenCalled();
});

test('without onDrillDown, regular click handler is used (cross-filter only)', () => {
  const setDataMask = jest.fn();
  const props: TransformedProps = {
    ...baseTransformedProps,
    setDataMask,
    emitCrossFilters: true,
    onDrillDown: undefined,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'USA' });

  // setDataMask should be called for cross-filter
  expect(setDataMask).toHaveBeenCalledTimes(1);
});

test('drill-down click handler does not call setDataMask when emitCrossFilters is false', () => {
  const onDrillDown = jest.fn();
  const setDataMask = jest.fn();
  const props: TransformedProps = {
    ...baseTransformedProps,
    onDrillDown,
    setDataMask,
    emitCrossFilters: false,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'USA' });

  // onDrillDown should still be called
  expect(onDrillDown).toHaveBeenCalledTimes(1);
  // The drill handler never emits a cross-filter (the DrillDownHost does),
  // and with emitCrossFilters false none is emitted at all.
  expect(setDataMask).not.toHaveBeenCalled();
});

test('drill-down click handler does nothing when labelMap has no matching entry', () => {
  const onDrillDown = jest.fn();
  const setDataMask = jest.fn();
  const props: TransformedProps = {
    ...baseTransformedProps,
    onDrillDown,
    setDataMask,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'NonExistent' });

  // Should not call onDrillDown because values is undefined
  expect(onDrillDown).not.toHaveBeenCalled();
  expect(setDataMask).not.toHaveBeenCalled();
});

test('without onDrillDown and emitCrossFilters false, click handler is a no-op', () => {
  const setDataMask = jest.fn();
  const props: TransformedProps = {
    ...baseTransformedProps,
    setDataMask,
    emitCrossFilters: false,
    onDrillDown: undefined,
  };

  const handlers = allEventHandlers(props);
  handlers.click({ name: 'USA' });

  // setDataMask should NOT be called
  expect(setDataMask).not.toHaveBeenCalled();
});

test('clickEventHandler does nothing when emitCrossFilters is false', () => {
  const setDataMask = jest.fn();
  const getCrossFilterMask = jest.fn(() => ({
    dataMask: { extraFormData: { filters: [] }, filterState: { value: null } },
    isCurrentValueSelected: false,
  }));

  const handler = clickEventHandler(getCrossFilterMask, setDataMask, false);
  handler({ name: 'USA' });

  expect(getCrossFilterMask).not.toHaveBeenCalled();
  expect(setDataMask).not.toHaveBeenCalled();
});

test('clickEventHandler calls setDataMask when emitCrossFilters is true', () => {
  const setDataMask = jest.fn();
  const mockDataMask = {
    extraFormData: {
      filters: [{ col: 'country', op: 'IN' as const, val: ['USA'] }],
    },
    filterState: { value: [['USA']], selectedValues: ['USA'] },
  };
  const getCrossFilterMask = jest.fn(() => ({
    dataMask: mockDataMask,
    isCurrentValueSelected: false,
  }));

  const handler = clickEventHandler(getCrossFilterMask, setDataMask, true);
  handler({ name: 'USA' });

  expect(getCrossFilterMask).toHaveBeenCalledWith('USA');
  expect(setDataMask).toHaveBeenCalledWith(mockDataMask);
});
