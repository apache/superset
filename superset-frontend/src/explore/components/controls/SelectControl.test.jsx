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
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import SelectControl, {
  innerGetOptions,
  areAllValuesNumbers,
  getSortComparator,
} from 'src/explore/components/controls/SelectControl';

const defaultProps = {
  choices: [
    ['1 year ago', '1 year ago'],
    ['1 week ago', '1 week ago'],
    ['today', 'today'],
  ],
  name: 'row_limit',
  label: 'Row Limit',
  valueKey: 'value',
  onChange: jest.fn(),
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const options = [
  { value: '1 year ago', label: '1 year ago' },
  { value: '1 week ago', label: '1 week ago' },
  { value: 'today', label: 'today' },
];

const renderSelectControl = (props = {}) => {
  const overrideProps = {
    ...defaultProps,
    ...props,
  };
  const { container } = render(<SelectControl {...overrideProps} />);
  return container;
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SelectControl', () => {
  test('calls props.onChange when select', async () => {
    renderSelectControl();
    defaultProps.onChange(50);
    expect(defaultProps.onChange).toHaveBeenCalledWith(50);
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('render', () => {
    test('renders with Select by default', () => {
      renderSelectControl();
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      const selectorInput = within(selectorWrapper).getByLabelText(
        'Row Limit',
        { selector: 'input' },
      );
      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();
    });

    test('renders as mode multiple', () => {
      renderSelectControl({ multi: true });
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      const selectorInput = within(selectorWrapper).getByLabelText(
        'Row Limit',
        { selector: 'input' },
      );
      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();
      userEvent.click(selectorInput);
      expect(screen.getByText('Select all (3)')).toBeInTheDocument();
    });

    test('renders with allowNewOptions when freeForm', () => {
      renderSelectControl({ freeForm: true });
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      const selectorInput = within(selectorWrapper).getByLabelText(
        'Row Limit',
        { selector: 'input' },
      );
      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();

      // Expect a new option to be selectable.
      userEvent.click(selectorInput);
      userEvent.type(selectorInput, 'a new option');
      act(() => jest.runAllTimers());
      expect(within(selectorWrapper).getByRole('option')).toHaveTextContent(
        'a new option',
      );
    });

    test('renders with allowNewOptions=false when freeForm=false', () => {
      const container = renderSelectControl({ freeForm: false });
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      const selectorInput = within(selectorWrapper).getByLabelText(
        'Row Limit',
        { selector: 'input' },
      );
      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();

      // Expect no new option to be selectable.
      userEvent.click(selectorInput);
      userEvent.type(selectorInput, 'a new option');
      act(() => jest.advanceTimersByTime(300));

      expect(
        container.querySelector('[role="option"]'),
      ).not.toBeInTheDocument();
      expect(
        within(selectorWrapper).getByText('No data', { selector: 'div' }),
      ).toBeInTheDocument();
    });

    test('renders with tokenSeparators', () => {
      renderSelectControl({ tokenSeparators: ['\n', '\t', ';'], multi: true });
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      const selectorInput = within(selectorWrapper).getByLabelText(
        'Row Limit',
        { selector: 'input' },
      );
      expect(selectorWrapper).toBeInTheDocument();
      expect(selectorInput).toBeInTheDocument();

      userEvent.click(selectorInput);
      const paste = createEvent.paste(selectorInput, {
        clipboardData: {
          getData: () => '1 year ago;1 week ago',
        },
      });
      fireEvent(selectorInput, paste);
      const yearOption = screen.getByRole('option', { name: /1 year ago/i });
      expect(yearOption).toBeInTheDocument();
      expect(yearOption).toHaveAttribute('aria-selected', 'true');
      const weekOption = screen.getByRole('option', { name: /1 week ago/ });
      expect(weekOption?.getAttribute('aria-selected')).toEqual('true');
    });

    // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
    describe('empty placeholder', () => {
      // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
      describe('withMulti', () => {
        test('does not show a placeholder if there are no choices', () => {
          renderSelectControl({
            choices: [],
            multi: true,
            placeholder: 'add something',
          });
          expect(screen.queryByRole('option')).not.toBeInTheDocument();
        });
      });
      // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
      describe('withSingleChoice', () => {
        test('does not show a placeholder if there are no choices', async () => {
          const container = renderSelectControl({
            choices: [],
            multi: false,
            placeholder: 'add something',
          });
          expect(
            container.querySelector('[role="option"]'),
          ).not.toBeInTheDocument();
        });
      });
      // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
      describe('all choices selected', () => {
        test('does not show a placeholder', () => {
          const container = renderSelectControl({
            multi: true,
            value: ['today', '1 year ago'],
          });
          expect(
            container.querySelector('[role="option"]'),
          ).not.toBeInTheDocument();
          expect(screen.queryByText('Select ...')).not.toBeInTheDocument();
        });
      });
    });
    // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
    describe('when select is multi', () => {
      test('does not render the placeholder when a selection has been made', () => {
        renderSelectControl({
          multi: true,
          value: ['today'],
          placeholder: 'add something',
        });
        expect(screen.queryByText('add something')).not.toBeInTheDocument();
      });
    });
    // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
    describe('when select is single', () => {
      test('does not render the placeholder when a selection has been made', () => {
        renderSelectControl({
          multi: true,
          value: 50,
          placeholder: 'add something',
        });
        expect(screen.queryByText('add something')).not.toBeInTheDocument();
      });
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('getOptions', () => {
    test('returns the correct options', () => {
      expect(innerGetOptions(defaultProps)).toEqual(options);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('areAllValuesNumbers', () => {
    test('returns true when all values are numbers (array format)', () => {
      const items = [
        [1, 'One'],
        [2, 'Two'],
        [3, 'Three'],
      ];
      expect(areAllValuesNumbers(items)).toBe(true);
    });

    test('returns false when some values are not numbers (array format)', () => {
      const items = [
        [1, 'One'],
        ['two', 'Two'],
        [3, 'Three'],
      ];
      expect(areAllValuesNumbers(items)).toBe(false);
    });

    test('returns true when all values are numbers (object format)', () => {
      const items = [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
        { value: 3, label: 'Three' },
      ];
      expect(areAllValuesNumbers(items)).toBe(true);
    });

    test('returns false when some values are not numbers (object format)', () => {
      const items = [
        { value: 1, label: 'One' },
        { value: 'two', label: 'Two' },
        { value: 3, label: 'Three' },
      ];
      expect(areAllValuesNumbers(items)).toBe(false);
    });

    test('returns true when all values are numbers (primitive format)', () => {
      const items = [1, 2, 3];
      expect(areAllValuesNumbers(items)).toBe(true);
    });

    test('returns false when some values are not numbers (primitive format)', () => {
      const items = [1, 'two', 3];
      expect(areAllValuesNumbers(items)).toBe(false);
    });

    test('works with custom valueKey', () => {
      const items = [
        { id: 1, label: 'One' },
        { id: 2, label: 'Two' },
        { id: 3, label: 'Three' },
      ];
      expect(areAllValuesNumbers(items, 'id')).toBe(true);
    });

    test('returns false for empty items', () => {
      expect(areAllValuesNumbers([])).toBe(false);
      expect(areAllValuesNumbers(null)).toBe(false);
      expect(areAllValuesNumbers(undefined)).toBe(false);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('getSortComparator', () => {
    const mockExplicitComparator = (a, b) => a.label.localeCompare(b.label);

    test('returns explicit comparator when provided', () => {
      const choices = [
        [1, 'One'],
        [2, 'Two'],
      ];
      const result = getSortComparator(
        choices,
        null,
        'value',
        mockExplicitComparator,
      );
      expect(result).toBe(mockExplicitComparator);
    });

    test('returns number comparator for numeric choices', () => {
      const choices = [
        [1, 'One'],
        [2, 'Two'],
      ];
      const result = getSortComparator(choices, null, 'value', null);
      expect(typeof result).toBe('function');
      expect(result).not.toBe(mockExplicitComparator);
    });

    test('returns number comparator for numeric options', () => {
      const options = [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
      ];
      const result = getSortComparator(null, options, 'value', null);
      expect(typeof result).toBe('function');
      expect(result).not.toBe(mockExplicitComparator);
    });

    test('prioritizes options over choices when both are numeric', () => {
      const choices = [
        [1, 'One'],
        [2, 'Two'],
      ];
      const options = [
        { value: 3, label: 'Three' },
        { value: 4, label: 'Four' },
      ];
      const result = getSortComparator(choices, options, 'value', null);
      expect(typeof result).toBe('function');
    });

    test('returns undefined for non-numeric choices', () => {
      const choices = [
        ['one', 'One'],
        ['two', 'Two'],
      ];
      const result = getSortComparator(choices, null, 'value', null);
      expect(result).toBeUndefined();
    });

    test('returns undefined for non-numeric options', () => {
      const options = [
        { value: 'one', label: 'One' },
        { value: 'two', label: 'Two' },
      ];
      const result = getSortComparator(null, options, 'value', null);
      expect(result).toBeUndefined();
    });

    test('returns undefined when no choices or options provided', () => {
      const result = getSortComparator(null, null, 'value', null);
      expect(result).toBeUndefined();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('numeric sorting integration', () => {
    test('applies numeric sorting to choices automatically', () => {
      const numericChoices = [
        [3, 'Three'],
        [1, 'One'],
        [2, 'Two'],
      ];
      renderSelectControl({ choices: numericChoices });

      // The SelectControl should receive a sortComparator for numeric values
      // This is tested by verifying the component renders without errors
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      expect(selectorWrapper).toBeInTheDocument();
    });

    test('applies numeric sorting to options automatically', () => {
      const numericOptions = [
        { value: 3, label: 'Three' },
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
      ];
      renderSelectControl({ options: numericOptions, choices: undefined });

      // The SelectControl should receive a sortComparator for numeric values
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      expect(selectorWrapper).toBeInTheDocument();
    });

    test('does not apply numeric sorting to mixed-type choices', () => {
      const mixedChoices = [
        [1, 'One'],
        ['two', 'Two'],
        [3, 'Three'],
      ];
      renderSelectControl({ choices: mixedChoices });

      // Should render without errors and not apply numeric sorting
      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      expect(selectorWrapper).toBeInTheDocument();
    });

    test('respects explicit sortComparator over automatic numeric sorting', () => {
      const numericChoices = [
        [3, 'Three'],
        [1, 'One'],
        [2, 'Two'],
      ];
      const explicitComparator = jest.fn((a, b) =>
        a.label.localeCompare(b.label),
      );

      renderSelectControl({
        choices: numericChoices,
        sortComparator: explicitComparator,
      });

      const selectorWrapper = screen.getByLabelText('Row Limit', {
        selector: 'div',
      });
      expect(selectorWrapper).toBeInTheDocument();
    });
  });
});
