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
import { ComponentType } from 'react';
import {
  AppSection,
  getExtensionsRegistry,
  NO_TIME_RANGE,
} from '@superset-ui/core';
import { act, render, screen } from 'spec/helpers/testing-library';
import { DateFilterControlProps } from 'src/explore/components/controls/DateFilterControl/types';
import TimeFilterPlugin from './TimeFilterPlugin';
import { PluginFilterTimeProps } from './types';

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
  capturedProps.length = 0;
  mockSetDataMask.mockClear();
});

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

test('the default (no calendar picker) renders the full date filter control', () => {
  render(<TimeFilterPlugin {...defaultProps} />);
  expect(capturedProps).toHaveLength(1);
  expect(screen.queryByPlaceholderText('Start date')).not.toBeInTheDocument();
});

test('the calendar picker option renders only the date range picker', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      formData={{ ...defaultProps.formData, calendarPicker: true }}
      filterState={{ value: '2024-01-01 : 2024-02-01' }}
    />,
  );
  expect(capturedProps).toHaveLength(0);
  expect(screen.getByPlaceholderText('Start date')).toHaveValue('2024-01-01');
  expect(screen.getByPlaceholderText('End date')).toHaveValue('2024-01-31');
});

test('the calendar picker option emits the fixed range through setDataMask', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      formData={{ ...defaultProps.formData, calendarPicker: true }}
      filterState={{ value: '2024-01-01 : 2024-02-01' }}
    />,
  );
  // The label is the days the user picked (end day included), for places that print the value.
  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: '2024-01-01 : 2024-02-01' },
    filterState: {
      value: '2024-01-01 : 2024-02-01',
      label: '2024-01-01 – 2024-01-31',
    },
  });
});

test('without the calendar picker the value is emitted with no label', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      filterState={{ value: '2024-01-01 : 2024-02-01' }}
    />,
  );
  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: { time_range: '2024-01-01 : 2024-02-01' },
    filterState: { value: '2024-01-01 : 2024-02-01' },
  });
});

test('the settings dialog default value always uses the full control, even with the calendar picker option on', () => {
  render(
    <TimeFilterPlugin
      {...defaultProps}
      appSection={AppSection.FilterConfigModal}
      formData={{ ...defaultProps.formData, calendarPicker: true }}
    />,
  );
  expect(capturedProps).toHaveLength(1);
  expect(screen.queryByPlaceholderText('Start date')).not.toBeInTheDocument();
});

test('the full control is told the calendar interface is enabled only when the option is on', () => {
  const { unmount } = render(
    <TimeFilterPlugin
      {...defaultProps}
      appSection={AppSection.FilterConfigModal}
      formData={{ ...defaultProps.formData, calendarPicker: true }}
    />,
  );
  expect(capturedProps[0].calendarFrame).toBe(true);
  unmount();

  capturedProps.length = 0;
  render(<TimeFilterPlugin {...defaultProps} />);
  expect(capturedProps[0].calendarFrame).toBe(false);
});

test('a registered filter.dateFilterControl override is used instead of the built-in calendar picker', () => {
  const overrideProps: Array<Record<string, unknown>> = [];
  const Override: ComponentType<DateFilterControlProps> = props => {
    overrideProps.push({ ...props });
    return <div data-test="date-filter-override" />;
  };
  const registry = getExtensionsRegistry();
  const previous = registry.get('filter.dateFilterControl');
  registry.set('filter.dateFilterControl', Override);
  try {
    render(
      <TimeFilterPlugin
        {...defaultProps}
        formData={{ ...defaultProps.formData, calendarPicker: true }}
        filterState={{ value: '2024-01-01 : 2024-02-01' }}
      />,
    );
    expect(overrideProps).toHaveLength(1);
    expect(overrideProps[0].calendarFrame).toBe(true);
    expect(screen.queryByPlaceholderText('Start date')).not.toBeInTheDocument();
  } finally {
    // TypedRegistry has no remove; restore whatever was registered before.
    registry.set('filter.dateFilterControl', previous);
  }
});
