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
import { AppSection, ChartProps, NO_TIME_RANGE } from '@superset-ui/core';
import { DEFAULT_BOOTSTRAP_DATA, FilterPlugins } from 'src/constants';
import * as bootstrapData from 'src/utils/getBootstrapData';
import { quickRangeStorageKey } from 'src/components/BasicCalendar/quickRangeStorage';
import { supersetTheme } from '@apache-superset/core/theme';
import { act, render } from 'spec/helpers/testing-library';
import TimeFilterPlugin from './TimeFilterPlugin';
import { PluginFilterTimeProps } from './types';
import transformProps from './transformProps';

const capturedProps: Array<Record<string, unknown>> = [];
jest.mock(
  'src/explore/components/controls/DateFilterControl',
  () =>
    function MockDateFilterControl(props: Record<string, unknown>) {
      capturedProps.push(props);
      return null;
    },
);

const mockSetDataMask = jest.fn();
const mockSetFilterActive = jest.fn();
const mockSetHoveredFilter = jest.fn();
const mockUnsetHoveredFilter = jest.fn();
const mockSetFocusedFilter = jest.fn();
const mockUnsetFocusedFilter = jest.fn();

const defaultProps: PluginFilterTimeProps = {
  behaviors: [],
  data: [],
  formData: {
    datasource: '3__table',
    viz_type: 'filter_time',
    groupby: [],
    adhoc_filters: [],
    extra_filters: [],
    extra_form_data: {},
    granularity_sqla: 'ds',
    time_range_endpoints: ['inclusive', 'exclusive'],
    url_params: {},
    height: 300,
    width: 300,
    nativeFilterId: 'filter-1',
    inView: true,
  },
  filterState: {
    value: null,
    validateStatus: undefined,
    validateMessage: undefined,
  },
  height: 300,
  width: 300,
  setDataMask: mockSetDataMask,
  setFilterActive: mockSetFilterActive,
  setHoveredFilter: mockSetHoveredFilter,
  unsetHoveredFilter: mockUnsetHoveredFilter,
  setFocusedFilter: mockSetFocusedFilter,
  unsetFocusedFilter: mockUnsetFocusedFilter,
  inputRef: { current: null },
};

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  jest.spyOn(bootstrapData, 'default').mockReturnValue({
    ...DEFAULT_BOOTSTRAP_DATA,
    user: {
      username: 'demo',
      userId: 1,
      firstName: 'Demo',
      lastName: 'User',
      isActive: true,
      isAnonymous: false,
      permissions: {},
      roles: {},
      groups: [],
    },
  });
  capturedProps.length = 0;
  mockSetDataMask.mockClear();
});

afterEach(() => jest.restoreAllMocks());

test('passes formData.displayFormat through to the underlying date filter control', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      formData={{ ...defaultProps.formData, displayFormat: '%d-%m-%Y' }}
    />,
  );

  expect(capturedProps).toHaveLength(1);
  expect(capturedProps[0]).toMatchObject({ displayFormat: '%d-%m-%Y' });
});

test('passes an undefined displayFormat through when none is configured', () => {
  render(<TimeFilterPlugin {...defaultProps} />);

  expect(capturedProps).toHaveLength(1);
  expect(capturedProps[0].displayFormat).toBeUndefined();
});

const chooseTimeRange = (value?: string) => {
  const { onChange } = capturedProps[capturedProps.length - 1] as {
    onChange: (timeRange?: string) => void;
  };
  act(() => onChange(value));
};

test('choosing a time range emits time_range through setDataMask', () => {
  render(<TimeFilterPlugin {...defaultProps} />);
  mockSetDataMask.mockClear();

  chooseTimeRange('Last week');

  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: 'Last week' },
    filterState: { value: 'Last week' },
  });
});

test('clearing the time range emits an empty value through setDataMask', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      filterState={{ ...defaultProps.filterState, value: 'Last week' }}
    />,
  );
  mockSetDataMask.mockClear();

  chooseTimeRange(NO_TIME_RANGE);

  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: {},
    filterState: { value: undefined },
  });
});

const simpleProps: PluginFilterTimeProps = {
  ...defaultProps,
  formData: {
    ...defaultProps.formData,
    viz_type: FilterPlugins.SimpleDateRange,
    dashboardId: 7,
    defaultValue: 'Last week',
  },
  filterState: { value: 'Last week' },
};
const rememberedKey = quickRangeStorageKey(1, 7, 'filter-1', 'date')!;

test.each([
  [FilterPlugins.SimpleDateRange, 'date'],
  [FilterPlugins.SimpleDateTimeRange, 'datetime'],
])(
  'the %s plugin fixes the mode in the rendered component',
  (viz_type, calendarMode) => {
    render(
      <TimeFilterPlugin
        {...simpleProps}
        formData={{ ...simpleProps.formData, viz_type }}
      />,
    );
    expect(capturedProps[capturedProps.length - 1]).toMatchObject({
      calendarMode,
    });
  },
);

test('configuring dashboard defaults neither restores nor changes viewer preferences', () => {
  localStorage.setItem(rememberedKey, 'Last month');
  render(
    <TimeFilterPlugin
      {...simpleProps}
      appSection={AppSection.FilterConfigModal}
    />,
  );
  expect(mockSetDataMask).toHaveBeenLastCalledWith({
    extraFormData: { time_range: 'Last week' },
    filterState: { value: 'Last week' },
  });
  chooseTimeRange('Last quarter');
  expect(localStorage.getItem(rememberedKey)).toBe('Last month');
});

test('a confirmed quick range is stored as an expression, and manual dates clear it', () => {
  render(<TimeFilterPlugin {...simpleProps} />);
  chooseTimeRange('Last month');
  expect(localStorage.getItem(rememberedKey)).toBe('Last month');
  chooseTimeRange('2026-10-01 : 2026-10-08');
  expect(localStorage.getItem(rememberedKey)).toBeNull();
});

test.each([
  [FilterPlugins.SimpleDateRange, 'date'],
  [FilterPlugins.SimpleDateTimeRange, 'datetime'],
])(
  'the %s runtime ChartProps transformation preserves the author-selected mode',
  (viz_type, calendarMode) => {
    const transformed = transformProps(
      new ChartProps({
        theme: supersetTheme,
        formData: { ...simpleProps.formData, viz_type },
        queriesData: [{ data: [] }],
      }),
    );
    render(
      <TimeFilterPlugin
        {...simpleProps}
        {...transformed}
        formData={{ ...simpleProps.formData, ...transformed.formData }}
        inputRef={simpleProps.inputRef}
      />,
    );
    expect(capturedProps[capturedProps.length - 1]).toMatchObject({
      calendarMode,
    });
  },
);

test('runtime camelCase chart props persist the confirmed preset', () => {
  render(
    <TimeFilterPlugin
      {...simpleProps}
      formData={{
        ...simpleProps.formData,
        vizType: FilterPlugins.SimpleDateRange,
        viz_type: 'filter_time',
      }}
    />,
  );
  chooseTimeRange('Last month');
  expect(localStorage.getItem(rememberedKey)).toBe('Last month');
});
