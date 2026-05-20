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
import { render, screen } from 'spec/helpers/testing-library';
import CompactSelectPanel from './CompactSelectPanel';
import type { FilterHandler } from './types';

const SELECTS = [
  { label: 'Alice', value: 1 },
  { label: 'Bob', value: 2 },
  { label: 'Charlie', value: 3 },
];

jest.mock('@superset-ui/core/components', () => ({
  Select: jest.fn(({ onChange, onOpenChange, value, open, ariaLabel }: any) => (
    <div
      data-test="mock-select"
      data-open={String(open)}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        data-test="select-option-alice"
        onClick={() => onChange({ label: 'Alice', value: 1 })}
      >
        Alice
      </button>
      <button
        type="button"
        data-test="select-option-bob"
        onClick={() => onChange({ label: 'Bob', value: 2 })}
      >
        Bob
      </button>
      <button
        type="button"
        data-test="trigger-close"
        onClick={() => onOpenChange?.(false)}
      >
        close
      </button>
      {value && <span data-test="selected-value">{String(value.value)}</span>}
    </div>
  )),
  AsyncSelect: jest.fn(({ onChange, onOpenChange, open, ariaLabel }: any) => (
    <div
      data-test="mock-async-select"
      data-open={String(open)}
      aria-label={ariaLabel}
    >
      <button
        type="button"
        data-test="async-option-remote"
        onClick={() => onChange({ label: 'Remote User', value: 99 })}
      >
        Remote User
      </button>
      <button
        type="button"
        data-test="async-trigger-close"
        onClick={() => onOpenChange?.(false)}
      >
        close
      </button>
    </div>
  )),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders Select when selects prop is provided', () => {
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByTestId('mock-select')).toBeInTheDocument();
});

test('renders AsyncSelect when fetchSelects prop is provided', () => {
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByTestId('mock-async-select')).toBeInTheDocument();
});

test('passes isOpen as open prop to Select', () => {
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={jest.fn()}
      isOpen
    />,
  );
  expect(screen.getByTestId('mock-select')).toHaveAttribute(
    'data-open',
    'true',
  );
});

test('calls onSelect with normalized option when onChange fires', () => {
  const onSelect = jest.fn();
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={onSelect}
    />,
  );
  screen.getByTestId('select-option-alice').click();
  expect(onSelect).toHaveBeenCalledWith({ label: 'Alice', value: 1 }, false);
});

test('calls onSelect(undefined, true) when onChange fires with undefined', () => {
  const onSelect = jest.fn();
  const { Select: MockSelect } = jest.requireMock(
    '@superset-ui/core/components',
  ) as any;
  MockSelect.mockImplementationOnce(({ onChange }: any) => (
    <button
      type="button"
      data-test="trigger-clear"
      onClick={() => onChange(undefined)}
    >
      clear
    </button>
  ));
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={onSelect}
    />,
  );
  screen.getByTestId('trigger-clear').click();
  expect(onSelect).toHaveBeenCalledWith(undefined, true);
});

test('calls onClose after onChange fires', () => {
  const onClose = jest.fn();
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={jest.fn()}
      onClose={onClose}
    />,
  );
  screen.getByTestId('select-option-alice').click();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('calls onClose when onOpenChange fires false', () => {
  const onClose = jest.fn();
  render(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={jest.fn()}
      onClose={onClose}
    />,
  );
  screen.getByTestId('trigger-close').click();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('clearFilter via ref resets selection and calls onSelect(undefined, true)', () => {
  const onSelect = jest.fn();
  const ref = createRef<FilterHandler>();
  render(
    <CompactSelectPanel
      ref={ref}
      selects={SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={onSelect}
    />,
  );
  act(() => {
    ref.current?.clearFilter();
  });
  expect(onSelect).toHaveBeenCalledWith(undefined, true);
});

test('syncs selected state when external value prop changes', () => {
  const { rerender } = render(
    <CompactSelectPanel
      selects={SELECTS}
      value={{ label: 'Alice', value: 1 }}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.getByTestId('selected-value')).toHaveTextContent('1');

  rerender(
    <CompactSelectPanel
      selects={SELECTS}
      value={undefined}
      onSelect={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('selected-value')).not.toBeInTheDocument();
});

test('passes isOpen as open prop to AsyncSelect', () => {
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
      isOpen
    />,
  );
  expect(screen.getByTestId('mock-async-select')).toHaveAttribute(
    'data-open',
    'true',
  );
});

test('calls onClose when AsyncSelect onOpenChange fires false', () => {
  const onClose = jest.fn();
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={jest.fn()}
      onClose={onClose}
    />,
  );
  screen.getByTestId('async-trigger-close').click();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('calls onSelect on AsyncSelect onChange', () => {
  const onSelect = jest.fn();
  const fetchSelects = jest.fn().mockResolvedValue({ data: [], totalCount: 0 });
  render(
    <CompactSelectPanel
      fetchSelects={fetchSelects}
      value={undefined}
      onSelect={onSelect}
    />,
  );
  screen.getByTestId('async-option-remote').click();
  expect(onSelect).toHaveBeenCalledWith(
    { label: 'Remote User', value: 99 },
    false,
  );
});
