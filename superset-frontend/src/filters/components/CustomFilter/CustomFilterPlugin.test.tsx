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
import CustomFilterPlugin from './CustomFilterPlugin';

const defaultProps = {
  data: [
    { category: 'Electronics' },
    { category: 'Clothing' },
    { category: 'Food' },
  ],
  formData: {
    groupby: ['category'],
    controlType: 'dropdown',
    multiSelect: true,
    enableEmptyFilter: false,
    inverseSelection: false,
    defaultToFirstItem: false,
    sortAscending: true,
  },
  coltypeMap: { category: 1 },
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

describe('CustomFilterPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders dropdown by default', () => {
    render(<CustomFilterPlugin {...defaultProps} />, { useRedux: true });
    expect(screen.getByText('Select values')).toBeInTheDocument();
  });

  test('renders checkbox when controlType is checkbox', () => {
    render(
      <CustomFilterPlugin
        {...defaultProps}
        formData={{ ...defaultProps.formData, controlType: 'checkbox' }}
      />,
      { useRedux: true },
    );
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });

  test('renders radio when controlType is radio', () => {
    render(
      <CustomFilterPlugin
        {...defaultProps}
        formData={{ ...defaultProps.formData, controlType: 'radio' }}
      />,
      { useRedux: true },
    );
    expect(screen.getByText('Electronics')).toBeInTheDocument();
    expect(screen.getByText('Clothing')).toBeInTheDocument();
    expect(screen.getByText('Food')).toBeInTheDocument();
  });
});
