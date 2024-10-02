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
  within,
} from 'spec/helpers/testing-library';
import SelectControl, {
  innerGetOptions,
} from 'src/explore/components/controls/SelectControl';
import userEvent from '@testing-library/user-event';

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

describe('SelectControl', () => {
  it('calls props.onChange when select', async () => {
    renderSelectControl();
    defaultProps.onChange(50);
    expect(defaultProps.onChange).toHaveBeenCalledWith(50);
  });

  describe('render', () => {
    it('renders with Select by default', () => {
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

    it('renders as mode multiple', () => {
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
      expect(screen.getByText('Select All (3)')).toBeInTheDocument();
    });

    it('renders with allowNewOptions when freeForm', () => {
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

    it('renders with allowNewOptions=false when freeForm=false', () => {
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
      expect(within(selectorWrapper).getByText('No Data')).toBeInTheDocument();
    });

    it('renders with tokenSeparators', () => {
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
      const yearOption = screen.getByLabelText('1 year ago');
      expect(yearOption).toBeInTheDocument();
      expect(yearOption).toHaveAttribute('aria-selected', 'true');
      const weekOption = screen.getByText(/1 week ago/, {
        selector: 'div',
      }).parentNode;
      expect(weekOption?.getAttribute('aria-selected')).toEqual('true');
    });

    describe('empty placeholder', () => {
      describe('withMulti', () => {
        it('does not show a placeholder if there are no choices', () => {
          renderSelectControl({
            choices: [],
            multi: true,
            placeholder: 'add something',
          });
          expect(screen.queryByRole('option')).not.toBeInTheDocument();
        });
      });
      describe('withSingleChoice', () => {
        it('does not show a placeholder if there are no choices', async () => {
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
      describe('all choices selected', () => {
        it('does not show a placeholder', () => {
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
    describe('when select is multi', () => {
      it('does not render the placeholder when a selection has been made', () => {
        renderSelectControl({
          multi: true,
          value: ['today'],
          placeholder: 'add something',
        });
        expect(screen.queryByText('add something')).not.toBeInTheDocument();
      });
    });
    describe('when select is single', () => {
      it('does not render the placeholder when a selection has been made', () => {
        renderSelectControl({
          multi: true,
          value: 50,
          placeholder: 'add something',
        });
        expect(screen.queryByText('add something')).not.toBeInTheDocument();
      });
    });
  });

  describe('getOptions', () => {
    it('returns the correct options', () => {
      expect(innerGetOptions(defaultProps)).toEqual(options);
    });
  });
});
