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
import { GenericDataType } from '@apache-superset/core/common';
import { render } from 'spec/helpers/testing-library';
import TimeColumnFilterPlugin from './TimeColumnFilterPlugin';
import { PluginFilterTimeColumnProps } from './types';

const mockSetDataMask = jest.fn();
const mockSetFilterActive = jest.fn();
const mockSetHoveredFilter = jest.fn();
const mockUnsetHoveredFilter = jest.fn();
const mockSetFocusedFilter = jest.fn();
const mockUnsetFocusedFilter = jest.fn();

const defaultProps: PluginFilterTimeColumnProps = {
  behaviors: [],
  data: [
    { column_name: 'ds', verbose_name: null, dtype: GenericDataType.Temporal },
    { column_name: 'ts', verbose_name: null, dtype: GenericDataType.Temporal },
  ],
  formData: {
    datasource: '3__table',
    viz_type: 'filter_timecolumn',
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
    defaultValue: null,
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
  mockSetDataMask.mockClear();
});

test('syncing a selected time column from filterState emits granularity_sqla through setDataMask', () => {
  const { rerender } = render(<TimeColumnFilterPlugin {...defaultProps} />);
  mockSetDataMask.mockClear();

  rerender(
    <TimeColumnFilterPlugin
      {...defaultProps}
      filterState={{ ...defaultProps.filterState, value: ['ts'] }}
    />,
  );

  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: { granularity_sqla: 'ts' },
    filterState: { value: ['ts'] },
  });
});

test('syncing a cleared time column from filterState emits a null value through setDataMask', () => {
  const { rerender } = render(
    <TimeColumnFilterPlugin
      {...defaultProps}
      filterState={{ ...defaultProps.filterState, value: ['ds'] }}
    />,
  );
  mockSetDataMask.mockClear();

  rerender(
    <TimeColumnFilterPlugin
      {...defaultProps}
      filterState={{ ...defaultProps.filterState, value: null }}
    />,
  );

  expect(mockSetDataMask).toHaveBeenCalledWith({
    extraFormData: {},
    filterState: { value: null },
  });
});
