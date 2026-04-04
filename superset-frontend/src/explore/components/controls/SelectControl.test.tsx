/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { waitFor } from 'spec/helpers/testing-library';
import {
  createEvent,
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';

import SelectControl, {
  innerGetOptions,
  areAllValuesNumbers,
  getSortComparator,
} from 'src/explore/components/controls/SelectControl';

const choices: [string, string][] = [
  ['1 year ago', '1 year ago'],
  ['1 week ago', '1 week ago'],
  ['today', 'today'],
];

const defaultProps = {
  choices,
  name: 'row_limit',
  label: 'Row Limit',
  valueKey: 'value',
  onChange: jest.fn(),
};

const expectedOptions = [
  { value: '1 year ago', label: '1 year ago' },
  { value: '1 week ago', label: '1 week ago' },
  { value: 'today', label: 'today' },
];

const renderSelectControl = (props = {}) => {
  const overrideProps = { ...defaultProps, ...props };
  return render(<SelectControl {...overrideProps} />);
};

describe('SelectControl', () => {
  test('calls props.onChange when select', async () => {
    const onChange = jest.fn();
    renderSelectControl({ onChange });

    // Open the dropdown
    const input = screen.getByRole('combobox', { name: /row limit/i });
    await userEvent.click(input);

    // Find and click the actual option in the portal
    const option = await screen.findByText('1 year ago', {
      selector: '.ant-select-item-option-content',
    });
    await userEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('1 year ago', expect.anything());
  });

  describe('render', () => {
    test('renders with Select by default', async () => {
      renderSelectControl();

      const selectorWrapper = await screen.findByLabelText('Row Limit', {
        selector: 'div',
      });

      const selectorInput = await screen.findByLabelText('Row Limit', {
        selector: 'input',
      });

      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();
    });

    test('renders as mode multiple', async () => {
      renderSelectControl({ multi: true });
      const input = screen.getByRole('combobox', { name: /row limit/i });
      await userEvent.click(input);
      expect(await screen.findByText('Select all (3)')).toBeInTheDocument();
    });

    test('renders with allowNewOptions when freeForm', async () => {
      renderSelectControl({ freeForm: true });
      const input = screen.getByRole('combobox', { name: /row limit/i });
      await userEvent.click(input);
      await userEvent.type(input, 'a new option{enter}');
      await waitFor(() => {
        expect(screen.getByText('a new option')).toBeInTheDocument();
      });
    });

    test('renders with tokenSeparators', async () => {
      renderSelectControl({ tokenSeparators: [';'], multi: true });
      const input = screen.getByRole('combobox', { name: /row limit/i });
      await userEvent.click(input);

      const paste = createEvent.paste(input, {
        clipboardData: {
          getData: () => '1 year ago;1 week ago',
        },
      });
      fireEvent(input, paste);

      expect(
        await screen.findByText('1 year ago', {
          selector: '.ant-select-selection-item-content',
        }),
      ).toBeInTheDocument();
      expect(
        await screen.findByText('1 week ago', {
          selector: '.ant-select-selection-item-content',
        }),
      ).toBeInTheDocument();
    });

    describe('empty placeholder', () => {
      test('multi: no choices -> no options', async () => {
        renderSelectControl({ choices: [], multi: true });
        const input = screen.getByRole('combobox', { name: /row limit/i });
        await userEvent.click(input);
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
      });

      test('single: no choices -> no options', async () => {
        renderSelectControl({ choices: [], multi: false });
        const input = screen.getByRole('combobox', { name: /row limit/i });
        await userEvent.click(input);
        expect(screen.queryByRole('option')).not.toBeInTheDocument();
      });
    });
  });

  describe('Utility Functions', () => {
    test('innerGetOptions converts choices to options correctly', () => {
      expect(innerGetOptions(defaultProps)).toEqual(expectedOptions);
    });

    test('areAllValuesNumbers validates numeric arrays and edge cases', () => {
      expect(areAllValuesNumbers([1, 2, 3])).toBe(true);
      expect(areAllValuesNumbers([1, 'two', 3])).toBe(false);
      expect(areAllValuesNumbers([])).toBe(true);
      expect(areAllValuesNumbers([{ v: 1 }, { v: 2 }], 'v')).toBe(true);
    });

    test('getSortComparator handles mixed inputs and explicit comparators', () => {
      const numericOptions = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
      ];
      const result = (getSortComparator as any)(
        numericOptions,
        undefined,
        'value',
      );
      expect(typeof result).toBe('function');

      const stringOptions = [{ value: 'a', label: 'a' }];
      const stringResult = (getSortComparator as any)(
        stringOptions,
        undefined,
        'value',
      );
      expect(stringResult).toBeUndefined();

      const mockCmp = jest.fn();
      const explicitResult = (getSortComparator as any)(
        numericOptions,
        undefined,
        'value',
        mockCmp,
      );
      expect(explicitResult).toBe(mockCmp);
    });
  });
});
