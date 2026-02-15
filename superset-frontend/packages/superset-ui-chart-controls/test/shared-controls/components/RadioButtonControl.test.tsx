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
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import RadioButtonControl, {
  RadioButtonControlProps,
  RadioButtonOption,
} from '../../../src/shared-controls/components/RadioButtonControl';

const defaultProps: RadioButtonControlProps = {
  label: 'Test Radio Control',
  options: [
    ['option1', 'Option 1'],
    ['option2', 'Option 2'],
    ['option3', 'Option 3'],
  ],
  onChange: jest.fn(),
};

const setup = (props: Partial<RadioButtonControlProps> = {}) =>
  render(<RadioButtonControl {...defaultProps} {...props} />);

test('renders with array-based options (legacy format)', () => {
  const { container } = setup();

  expect(screen.getByText('Option 1')).toBeInTheDocument();
  expect(screen.getByText('Option 2')).toBeInTheDocument();
  expect(screen.getByText('Option 3')).toBeInTheDocument();
  expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
});

test('renders with object-based options (new format)', () => {
  const objectOptions: RadioButtonOption[] = [
    { value: 'opt1', label: 'Object Option 1' },
    { value: 'opt2', label: 'Object Option 2' },
    { value: 'opt3', label: 'Object Option 3' },
  ];

  setup({ options: objectOptions });

  expect(screen.getByText('Object Option 1')).toBeInTheDocument();
  expect(screen.getByText('Object Option 2')).toBeInTheDocument();
  expect(screen.getByText('Object Option 3')).toBeInTheDocument();
});

test('renders mixed array and object options', () => {
  const mixedOptions: RadioButtonOption[] = [
    ['array1', 'Array Option'],
    { value: 'obj1', label: 'Object Option' },
  ];

  setup({ options: mixedOptions });

  expect(screen.getByText('Array Option')).toBeInTheDocument();
  expect(screen.getByText('Object Option')).toBeInTheDocument();
});

test('defaults to first option when no value provided', () => {
  const { container } = setup();

  const firstButton = container.querySelector('#tab-option1');
  expect(firstButton).toBeInTheDocument();
  expect(firstButton).toHaveAttribute('aria-selected', 'true');
});

test('respects initial value prop', () => {
  const { container } = setup({ value: 'option2' });

  const secondButton = container.querySelector('#tab-option2');
  expect(secondButton).toBeInTheDocument();
  expect(secondButton).toHaveAttribute('aria-selected', 'true');
});

test('calls onChange when radio button is clicked', () => {
  const onChange = jest.fn();
  setup({ onChange });

  const secondOption = screen.getByText('Option 2');
  fireEvent.click(secondOption);

  expect(onChange).toHaveBeenCalledWith('option2');
  expect(onChange).toHaveBeenCalled();
});

test('handles multiple clicks correctly', () => {
  const onChange = jest.fn();
  setup({ onChange });

  fireEvent.click(screen.getByText('Option 2'));
  fireEvent.click(screen.getByText('Option 3'));
  fireEvent.click(screen.getByText('Option 1'));

  expect(onChange).toHaveBeenCalledWith('option2');
  expect(onChange).toHaveBeenCalledWith('option3');
  expect(onChange).toHaveBeenCalledWith('option1');
  expect(onChange.mock.calls.length).toBeGreaterThanOrEqual(3);
});

test('disables specific options when disabled flag is set', () => {
  const optionsWithDisabled: RadioButtonOption[] = [
    { value: 'opt1', label: 'Enabled Option' },
    { value: 'opt2', label: 'Disabled Option', disabled: true },
    { value: 'opt3', label: 'Another Enabled' },
  ];

  const { container } = setup({ options: optionsWithDisabled });

  const disabledButton = container.querySelector('#tab-opt2');
  const enabledButton = container.querySelector('#tab-opt1');

  expect(disabledButton).toHaveAttribute('disabled');
  expect(enabledButton).not.toHaveAttribute('disabled');
});

test('disabled options do not trigger onChange when clicked', () => {
  const onChange = jest.fn();
  const optionsWithDisabled: RadioButtonOption[] = [
    { value: 'opt1', label: 'Enabled' },
    { value: 'opt2', label: 'Disabled', disabled: true },
  ];

  const { container } = setup({ options: optionsWithDisabled, onChange });

  const disabledButton = container.querySelector('#tab-opt2');
  if (disabledButton) {
    fireEvent.click(disabledButton);
  }

  expect(onChange).not.toHaveBeenCalled();
});

test('renders ControlHeader with label and description', () => {
  const { container } = setup({
    label: 'My Radio Control',
    description: 'This is a helpful description',
  });

  const header = container.querySelector('.ControlHeader');
  expect(header).toBeInTheDocument();
  expect(screen.getByText('My Radio Control')).toBeInTheDocument();
});

test('aria-live region updates with current selection', () => {
  const { container } = setup({ value: 'option1' });

  const ariaLiveRegion = container.querySelector('[aria-live="polite"]');
  expect(ariaLiveRegion).toBeInTheDocument();
  expect(ariaLiveRegion?.textContent).toContain('Option 1');
});

test('aria-live region updates when selection changes', () => {
  const { container, rerender } = setup({ value: 'option1' });

  let ariaLiveRegion = container.querySelector('[aria-live="polite"]');
  expect(ariaLiveRegion?.textContent).toContain('Option 1');

  rerender(<RadioButtonControl {...defaultProps} value="option2" />);

  ariaLiveRegion = container.querySelector('[aria-live="polite"]');
  expect(ariaLiveRegion?.textContent).toContain('Option 2');
});

test('aria-live region is visually hidden but accessible', () => {
  const { container } = setup();

  const ariaLiveRegion = container.querySelector(
    '[aria-live="polite"]',
  ) as HTMLElement;

  expect(ariaLiveRegion).toBeInTheDocument();
  expect(ariaLiveRegion?.style.position).toBe('absolute');
  expect(ariaLiveRegion?.style.left).toBe('-9999px');
  expect(ariaLiveRegion?.style.height).toBe('1px');
  expect(ariaLiveRegion?.style.width).toBe('1px');
  expect(ariaLiveRegion?.style.overflow).toBe('hidden');
});

test('renders tablist with correct aria-label when label is string', () => {
  const { container } = setup({ label: 'String Label' });

  const tablist = container.querySelector('[role="tablist"]');
  expect(tablist).toHaveAttribute('aria-label', 'String Label');
});

test('tablist has no aria-label when label is not string', () => {
  const { container } = setup({ label: <div>JSX Label</div> });

  const tablist = container.querySelector('[role="tablist"]');
  expect(tablist).not.toHaveAttribute('aria-label');
});

test('each radio button has correct aria-selected state', () => {
  const { container } = setup({ value: 'option2' });

  expect(container.querySelector('#tab-option1')).toHaveAttribute(
    'aria-selected',
    'false',
  );
  expect(container.querySelector('#tab-option2')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(container.querySelector('#tab-option3')).toHaveAttribute(
    'aria-selected',
    'false',
  );
});

test('radio buttons have correct aria-label when label is string', () => {
  setup();

  const option1Button = screen.getByLabelText('Option 1');
  expect(option1Button).toBeInTheDocument();
});

test('focuses button when clicked', () => {
  const { container } = setup();

  const button = container.querySelector('#tab-option2') as HTMLElement;
  fireEvent.click(button);

  expect(document.activeElement).toBe(button);
});

test('handles numeric values in options', () => {
  const onChange = jest.fn();
  const numericOptions: RadioButtonOption[] = [
    [1, 'One'],
    [2, 'Two'],
    [3, 'Three'],
  ];

  setup({ options: numericOptions, onChange });

  fireEvent.click(screen.getByText('Two'));
  expect(onChange).toHaveBeenCalledWith(2);
});

test('handles boolean values in options', () => {
  const onChange = jest.fn();
  const booleanOptions: RadioButtonOption[] = [
    [true, 'True'],
    [false, 'False'],
  ];

  setup({ options: booleanOptions, onChange });

  fireEvent.click(screen.getByText('False'));
  expect(onChange).toHaveBeenCalledWith(false);
});

test('handles null values in options', () => {
  const onChange = jest.fn();
  const nullOptions: RadioButtonOption[] = [
    [null, 'None'],
    ['value', 'Value'],
  ];

  setup({ options: nullOptions, onChange });

  fireEvent.click(screen.getByText('None'));
  expect(onChange).toHaveBeenCalledWith(null);
});

test('generates unique IDs for options', () => {
  const { container } = setup();

  const button1 = container.querySelector('#tab-option1');
  const button2 = container.querySelector('#tab-option2');
  const button3 = container.querySelector('#tab-option3');

  expect(button1).toBeInTheDocument();
  expect(button2).toBeInTheDocument();
  expect(button3).toBeInTheDocument();
});

test('applies active class to selected button', () => {
  const { container } = setup({ value: 'option2' });

  const activeButton = container.querySelector('#tab-option2');
  expect(activeButton).toBeInTheDocument();
  expect(activeButton).toHaveAttribute('aria-selected', 'true');
});

test('does not set aria-selected to true for unselected buttons', () => {
  const { container } = setup({ value: 'option2' });

  const inactiveButton1 = container.querySelector('#tab-option1');
  const inactiveButton3 = container.querySelector('#tab-option3');

  expect(inactiveButton1).toHaveAttribute('aria-selected', 'false');
  expect(inactiveButton3).toHaveAttribute('aria-selected', 'false');
});

test('backward compatibility with legacy array format', () => {
  const onChange = jest.fn();
  const legacyOptions: RadioButtonOption[] = [
    ['val1', 'Label 1'],
    ['val2', 'Label 2'],
  ];

  setup({ options: legacyOptions, onChange });

  expect(screen.getByText('Label 1')).toBeInTheDocument();
  expect(screen.getByText('Label 2')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Label 2'));
  expect(onChange).toHaveBeenCalledWith('val2');
});

test('normalizeOption handles array format correctly', () => {
  const arrayOption: RadioButtonOption = ['value', 'Label'];
  const onChange = jest.fn();

  setup({ options: [arrayOption], onChange });

  expect(screen.getByText('Label')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Label'));
  expect(onChange).toHaveBeenCalledWith('value');
});

test('normalizeOption handles object format correctly', () => {
  const objectOption: RadioButtonOption = {
    value: 'value',
    label: 'Label',
    disabled: false,
  };
  const onChange = jest.fn();

  setup({ options: [objectOption], onChange });

  expect(screen.getByText('Label')).toBeInTheDocument();

  fireEvent.click(screen.getByText('Label'));
  expect(onChange).toHaveBeenCalledWith('value');
});

test('handles empty options array gracefully', () => {
  const { container } = setup({ options: [], value: 'default' });

  expect(container.querySelector('[role="tablist"]')).toBeInTheDocument();
});

test('renders with hovered prop', () => {
  const { container } = setup({
    label: 'Test',
    description: 'Test description',
    hovered: true,
  });

  expect(
    container.querySelector('[data-test="info-tooltip-icon"]'),
  ).toBeInTheDocument();
});

test('renders tooltips for options with tooltip property', async () => {
  const optionsWithTooltips: RadioButtonOption[] = [
    { value: 'opt1', label: 'Option 1', tooltip: 'Tooltip for option 1' },
    { value: 'opt2', label: 'Option 2' },
    { value: 'opt3', label: 'Option 3', tooltip: 'Tooltip for option 3' },
  ];

  setup({ options: optionsWithTooltips });

  expect(screen.getByText('Option 1')).toBeInTheDocument();
  expect(screen.getByText('Option 2')).toBeInTheDocument();
  expect(screen.getByText('Option 3')).toBeInTheDocument();

  const option1 = screen.getByText('Option 1');
  userEvent.hover(option1);

  await waitFor(() => {
    expect(screen.getByText('Tooltip for option 1')).toBeInTheDocument();
  });

  userEvent.unhover(option1);

  const option3 = screen.getByText('Option 3');
  userEvent.hover(option3);

  await waitFor(() => {
    expect(screen.getByText('Tooltip for option 3')).toBeInTheDocument();
  });
});

test('wraps disabled buttons with tooltip in span', () => {
  const optionsWithDisabledTooltip: RadioButtonOption[] = [
    { value: 'opt1', label: 'Enabled with tooltip', tooltip: 'Tooltip text' },
    {
      value: 'opt2',
      label: 'Disabled with tooltip',
      disabled: true,
      tooltip: 'Disabled tooltip',
    },
  ];

  const { container } = setup({ options: optionsWithDisabledTooltip });

  const disabledButton = container.querySelector('#tab-opt2');
  expect(disabledButton).toHaveAttribute('disabled');
  expect(disabledButton?.parentElement?.tagName).toBe('SPAN');
});
