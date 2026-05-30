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
import { createRef, act } from 'react';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import CompactSelectPanel from './CompactSelectPanel';
import type { FilterHandler } from './types';

const SMALL_SELECTS = [
  { label: 'Alice', value: 1 },
  { label: 'Bob', value: 2 },
  { label: 'Charlie', value: 3 },
];

const LARGE_SELECTS = [
  { label: 'Alice', value: 1 },
  { label: 'Bob', value: 2 },
  { label: 'Charlie', value: 3 },
  { label: 'David', value: 4 },
  { label: 'Eve', value: 5 },
  { label: 'Frank', value: 6 },
  { label: 'Grace', value: 7 },
];

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders options from selects prop', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();
  expect(screen.getByText('Charlie')).toBeInTheDocument();
});

test('hides search input when selects.length is 6 or fewer', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.queryByPlaceholderText('Search')).not.toBeInTheDocument();
});

test('shows search input when selects.length exceeds 6', () => {
  render(
    <CompactSelectPanel
      selects={LARGE_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
});

test('shows search input when fetchSelects is provided', () => {
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
});

test('filters static options by search term', async () => {
  render(
    <CompactSelectPanel
      selects={LARGE_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  await userEvent.type(screen.getByPlaceholderText('Search'), 'ali');
  expect(screen.getByText('Alice')).toBeInTheDocument();
  expect(screen.queryByText('Bob')).not.toBeInTheDocument();
});

test('calls onSelect with normalized option when an option is clicked', async () => {
  const onSelect = jest.fn();
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={onSelect}
    />,
  );
  await userEvent.click(screen.getByText('Alice'));
  expect(onSelect).toHaveBeenCalledWith({ label: 'Alice', value: 1 }, false);
});

test('calls onSelect with undefined when same option is clicked twice (deselect)', async () => {
  const onSelect = jest.fn();
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={onSelect}
    />,
  );
  await userEvent.click(screen.getByText('Alice'));
  expect(onSelect).toHaveBeenCalledWith(undefined, true);
});

test('shows checkmark icon on selected option', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={jest.fn()}
    />,
  );
  const aliceOption = screen
    .getByText('Alice')
    .closest('[role="option"]') as HTMLElement;
  expect(aliceOption).toHaveAttribute('aria-selected', 'true');
});

test('unselected options have aria-selected false', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={jest.fn()}
    />,
  );
  const bobOption = screen
    .getByText('Bob')
    .closest('[role="option"]') as HTMLElement;
  expect(bobOption).toHaveAttribute('aria-selected', 'false');
});

test('calls onClose after a selection is made', async () => {
  const onClose = jest.fn();
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
      onClose={onClose}
    />,
  );
  await userEvent.click(screen.getByText('Alice'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clearFilter via ref resets selection and calls onSelect(undefined, true)', () => {
  const onSelect = jest.fn();
  const ref = createRef<FilterHandler>();
  const { rerender } = render(
    <CompactSelectPanel
      ref={ref}
      selects={SMALL_SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={onSelect}
    />,
  );
  expect(screen.getByText('Alice').closest('[role="option"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );

  act(() => {
    ref.current?.clearFilter();
  });

  expect(onSelect).toHaveBeenCalledWith(undefined, true);
  // Component is fully controlled — visual deselection follows when the
  // parent passes value={undefined} after receiving the onSelect callback.
  rerender(
    <CompactSelectPanel
      ref={ref}
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={onSelect}
    />,
  );
  expect(screen.getByText('Alice').closest('[role="option"]')).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('shows Loading text when loading prop is true', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
      loading
    />,
  );
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('shows No results when displayOptions is empty', () => {
  render(
    <CompactSelectPanel selects={[]} value={undefined} onSelect={jest.fn()} />,
  );
  expect(screen.getByText('No results')).toBeInTheDocument();
});

test('renders options list with listbox role and accessible label', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  const listbox = screen.getByRole('listbox');
  expect(listbox).toBeInTheDocument();
  expect(listbox).toHaveAttribute('aria-label', 'Filter options');
});

test('option items have option role', () => {
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(3);
});

test('fetches and displays remote options via fetchSelects on mount', async () => {
  const fetchSelects = jest.fn().mockResolvedValue({
    data: [{ label: 'Remote User', value: 99 }],
    totalCount: 1,
  });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByText('Remote User')).toBeInTheDocument();
  });
  expect(fetchSelects).toHaveBeenCalledWith('', 0, 200);
});

test('shows No results when fetchSelects returns empty data', async () => {
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  await waitFor(() => {
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});

test('shows No results when fetchSelects rejects', async () => {
  const fetchSelects = jest.fn().mockRejectedValue(new Error('network error'));
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  await waitFor(() => {
    expect(screen.getByText('No results')).toBeInTheDocument();
  });
});

test('selects option via keyboard Enter key', async () => {
  const onSelect = jest.fn();
  render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={onSelect}
    />,
  );
  const aliceOption = screen.getByText('Alice').closest('[role="option"]')!;
  await userEvent.type(aliceOption, '{Enter}');
  expect(onSelect).toHaveBeenCalledWith({ label: 'Alice', value: 1 }, false);
});

test('syncs selected state when external value prop changes', () => {
  const { rerender } = render(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByText('Alice').closest('[role="option"]')).toHaveAttribute(
    'aria-selected',
    'true',
  );

  rerender(
    <CompactSelectPanel
      selects={SMALL_SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByText('Alice').closest('[role="option"]')).toHaveAttribute(
    'aria-selected',
    'false',
  );
});
