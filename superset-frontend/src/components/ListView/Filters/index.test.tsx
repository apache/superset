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
import { ListViewFilterOperator } from '../types';
import UIFilters from './index';

const mockUpdateFilterValue = jest.fn();

beforeEach(() => {
  mockUpdateFilterValue.mockClear();
});

test('search filter uses id as input name when inputName is not provided', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.name).toBe('name');
});

test('search filter uses inputName when provided instead of id', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      inputName: 'custom_search_name',
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.name).toBe('custom_search_name');
});

test('search filter passes autoComplete prop correctly', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      autoComplete: 'new-password',
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const input = screen.getByTestId('filters-search') as HTMLInputElement;
  expect(input.autocomplete).toBe('new-password');
});

test('renders multiple search filters with different inputName values', () => {
  const filters = [
    {
      Header: 'Name',
      key: 'name',
      id: 'name',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      inputName: 'filter_name_search',
    },
    {
      Header: 'Description',
      key: 'description',
      id: 'description',
      input: 'search' as const,
      operator: ListViewFilterOperator.Contains,
      // No inputName - should use id
    },
  ];

  render(
    <UIFilters
      filters={filters}
      internalFilters={[]}
      updateFilterValue={mockUpdateFilterValue}
    />,
  );

  const inputs = screen.getAllByTestId('filters-search') as HTMLInputElement[];
  expect(inputs).toHaveLength(2);
  expect(inputs[0].name).toBe('filter_name_search');
  expect(inputs[1].name).toBe('description');
});
