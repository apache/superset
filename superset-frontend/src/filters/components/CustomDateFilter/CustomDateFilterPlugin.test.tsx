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
import { render, screen } from 'spec/helpers/testing-library';
import CustomDateFilterPlugin from './CustomDateFilterPlugin';

const defaultProps = {
  data: [],
  formData: {
    groupby: ['order_date'],
    controlType: 'date',
    granularitySqla: 'order_date',
  },
  width: 200,
  height: 100,
  filterState: { value: [] },
  setDataMask: jest.fn(),
  setHoveredFilter: jest.fn(),
  unsetHoveredFilter: jest.fn(),
  setFocusedFilter: jest.fn(),
  unsetFocusedFilter: jest.fn(),
  setFilterActive: jest.fn(),
  inputRef: { current: null },
  isRefreshing: false,
  appSection: 'FILTER_BAR',
};

describe('CustomDateFilterPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders date picker by default', () => {
    render(<CustomDateFilterPlugin {...defaultProps} />, { useRedux: true });
    expect(screen.getByPlaceholderText('Select date')).toBeInTheDocument();
  });

  test('renders date picker when controlType is date', () => {
    render(
      <CustomDateFilterPlugin
        {...defaultProps}
        formData={{ ...defaultProps.formData, controlType: 'date' }}
      />,
      { useRedux: true },
    );
    expect(screen.getByPlaceholderText('Select date')).toBeInTheDocument();
  });

  test('renders datetime picker when controlType is datetime', () => {
    render(
      <CustomDateFilterPlugin
        {...defaultProps}
        formData={{ ...defaultProps.formData, controlType: 'datetime' }}
      />,
      { useRedux: true },
    );
    expect(screen.getByPlaceholderText('Select date')).toBeInTheDocument();
  });
});
