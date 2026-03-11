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
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'spec/helpers/testing-library';
import PluginFilterTimegrain from './TimeGrainFilterPlugin';
import { PluginFilterTimeGrainProps } from './types';

const mockSetDataMask = jest.fn();
const mockSetFilterActive = jest.fn();
const mockSetHoveredFilter = jest.fn();
const mockUnsetHoveredFilter = jest.fn();
const mockSetFocusedFilter = jest.fn();
const mockUnsetFocusedFilter = jest.fn();

const defaultProps: PluginFilterTimeGrainProps = {
  data: [
    { duration: 'P1D', name: 'Day' },
    { duration: 'P1W', name: 'Week' },
    { duration: 'P1M', name: 'Month' },
    { duration: 'P1Y', name: 'Year' },
  ],
  formData: {
    datasource: '3__table',
    viz_type: 'filter_timegrain',
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
    defaultValue: null,
    inputRef: { current: null },
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

test('renders all options when time_grains is not set', async () => {
  render(<PluginFilterTimegrain {...defaultProps} />);

  // Verify the select component is rendered
  const select = screen.getByRole('combobox');
  expect(select).toBeInTheDocument();

  // Open the dropdown and verify all options are available
  await userEvent.click(select);
  const options = screen.getAllByRole('option');
  expect(options.length).toBe(4);
  expect(options[0]).toHaveTextContent('Day');
  expect(options[1]).toHaveTextContent('Week');
  expect(options[2]).toHaveTextContent('Month');
  expect(options[3]).toHaveTextContent('Year');
});

test('filters options based on time_grains allowlist', async () => {
  const propsWithAllowlist = {
    ...defaultProps,
    formData: {
      ...defaultProps.formData,
      time_grains: ['P1D', 'P1W'],
    },
  };

  render(<PluginFilterTimegrain {...propsWithAllowlist} />);

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  // Only Day and Week should be available
  const options = screen.getAllByRole('option');
  expect(options.length).toBe(2);
  expect(options[0]).toHaveTextContent('Day');
  expect(options[1]).toHaveTextContent('Week');
});

test('shows all options when time_grains is empty array', async () => {
  const propsWithEmptyAllowlist = {
    ...defaultProps,
    formData: {
      ...defaultProps.formData,
      time_grains: [],
    },
  };

  render(<PluginFilterTimegrain {...propsWithEmptyAllowlist} />);

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  // All 4 options should be available
  const options = screen.getAllByRole('option');
  expect(options.length).toBe(4);
});

test('shows all options when time_grains is undefined', async () => {
  const propsWithUndefined = {
    ...defaultProps,
    formData: {
      ...defaultProps.formData,
      time_grains: undefined,
    },
  };

  render(<PluginFilterTimegrain {...propsWithUndefined} />);

  const select = screen.getByRole('combobox');
  await userEvent.click(select);

  // All 4 options should be available
  const options = screen.getAllByRole('option');
  expect(options.length).toBe(4);
});
