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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { DateFilterTestKey } from '../utils';
import { CommonFrame } from '../components';
import { FrameLimits } from '../types';

test('renders the title and one radio per common range', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last month" />);

  expect(screen.getByTestId(DateFilterTestKey.CommonFrame)).toHaveTextContent(
    'Configure Time Range: Last...',
  );
  const radios = screen.getAllByRole('radio');
  const expectedNames = [
    'Last day',
    'Last week',
    'Last month',
    'Last quarter',
    'Last year',
  ];
  expect(radios).toHaveLength(expectedNames.length);
  expectedNames.forEach((name, index) => {
    expect(radios[index]).toHaveAccessibleName(name);
  });
});

test('checks the radio matching the value', () => {
  render(<CommonFrame onChange={jest.fn()} value="Last quarter" />);

  expect(screen.getByLabelText('Last quarter')).toBeChecked();
  expect(screen.getByLabelText('Last week')).not.toBeChecked();
});

test('does not call onChange when the value is a common range', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last year" />);

  expect(onChange).not.toHaveBeenCalled();
});

test('falls back to Last week when the value is not a common range', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="previous calendar week" />);

  expect(onChange).toHaveBeenCalledWith('Last week');
  expect(screen.getByLabelText('Last week')).toBeChecked();
});

test('calls onChange with the selected range', async () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Last week" />);

  await userEvent.click(screen.getByLabelText('Last day'));

  expect(onChange).toHaveBeenCalledWith('Last day');
});

const limits = (presets?: FrameLimits['presets']): FrameLimits => ({
  startId: 'start',
  endId: 'end',
  presets,
});

const LAST_YEAR_REASON = 'Longer than this dashboard allows (3 months)';

test('without limits every option is enabled and the default is "Last week"', () => {
  const onChange = jest.fn();
  render(<CommonFrame onChange={onChange} value="Invalid" />);

  expect(onChange).toHaveBeenCalledWith('Last week');
  screen.getAllByRole('radio').forEach(radio => expect(radio).toBeEnabled());
});

test('an option that breaks the limits is disabled with its reason on hover', async () => {
  const onChange = jest.fn();
  render(
    <CommonFrame
      onChange={onChange}
      value="Last week"
      limits={limits({ 'Last year': LAST_YEAR_REASON })}
    />,
  );

  expect(screen.getByRole('radio', { name: 'Last year' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Last quarter' })).toBeEnabled();

  await userEvent.hover(screen.getByText('Last year'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    LAST_YEAR_REASON,
  );

  await userEvent.click(screen.getByText('Last year'));
  expect(onChange).not.toHaveBeenCalled();
});

test('the reason tooltip opens to the right of the option', async () => {
  render(
    <CommonFrame
      onChange={jest.fn()}
      value="Last week"
      limits={limits({ 'Last year': LAST_YEAR_REASON })}
    />,
  );

  await userEvent.hover(screen.getByText('Last year'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.closest('.ant-tooltip')).toHaveClass(
    'ant-tooltip-placement-right',
  );
});

test('the checked option stays enabled even when it breaks the limits', () => {
  render(
    <CommonFrame
      onChange={jest.fn()}
      value="Last year"
      limits={limits({ 'Last year': LAST_YEAR_REASON })}
    />,
  );

  const lastYear = screen.getByRole('radio', { name: 'Last year' });
  expect(lastYear).toBeChecked();
  expect(lastYear).toBeEnabled();
});

test('the default is the first allowed option when "Last week" breaks the limits', () => {
  const onChange = jest.fn();
  render(
    <CommonFrame
      onChange={onChange}
      value="Invalid"
      limits={limits({
        'Last day': 'too early',
        'Last week': 'too early',
      })}
    />,
  );

  expect(onChange).toHaveBeenCalledWith('Last month');
});

test('the default stays "Last week" when it fits, even if an earlier option fits too', () => {
  const onChange = jest.fn();
  render(
    <CommonFrame
      onChange={onChange}
      value="Invalid"
      limits={limits({ 'Last year': LAST_YEAR_REASON })}
    />,
  );

  expect(onChange).toHaveBeenCalledWith('Last week');
  expect(screen.getByRole('radio', { name: 'Last week' })).toBeChecked();
});

test('the default stays "Last week" when no option fits or the list is unknown', () => {
  const onChange = jest.fn();
  const all = {
    'Last day': 'x',
    'Last week': 'x',
    'Last month': 'x',
    'Last quarter': 'x',
    'Last year': 'x',
  };
  const { unmount } = render(
    <CommonFrame onChange={onChange} value="Invalid" limits={limits(all)} />,
  );
  expect(onChange).toHaveBeenLastCalledWith('Last week');
  unmount();

  render(<CommonFrame onChange={onChange} value="Invalid" limits={limits()} />);
  expect(onChange).toHaveBeenLastCalledWith('Last week');
});

test('the "disabled" note is a block under the radio group, with its id', () => {
  render(
    <CommonFrame
      onChange={jest.fn()}
      value="Last week"
      limits={{
        ...limits({ 'Last year': LAST_YEAR_REASON }),
        disabledPresetsId: 'disabled-presets',
      }}
    />,
  );

  const note = screen.getByText(
    'Options outside the time range limit are disabled.',
  );
  expect(note.tagName).not.toBe('SPAN');
  expect(note).toHaveAttribute('id', 'disabled-presets');
  expect(
    screen
      .getByRole('radiogroup')
      // eslint-disable-next-line no-bitwise
      .compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
