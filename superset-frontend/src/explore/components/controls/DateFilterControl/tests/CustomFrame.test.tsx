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
import { useState } from 'react';
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  waitFor,
} from 'spec/helpers/testing-library';
import { Dayjs } from 'dayjs';
import { CustomFrame } from '../components';
import { FrameLimits } from '../types';

const TODAY = '2024-06-03';
jest.useFakeTimers({ advanceTimers: true });
jest.setSystemTime(new Date(TODAY).getTime());

const emptyValue = '';
const nowValue = 'now : now';
const todayValue = 'today : today';
const todayNowValue = 'today : now';
const specificValue = '2021-03-16T00:00:00 : 2021-03-17T00:00:00';
const relativeNowValue = `DATEADD(DATETIME("now"), -7, day) : DATEADD(DATETIME("now"), 7, day)`;
const relativeTodayValue = `DATEADD(DATETIME("today"), -7, day) : DATEADD(DATETIME("today"), 7, day)`;

const mockStore = configureStore([thunk]);
const store = mockStore({
  common: { locale: 'en' },
});

// case when common.locale is not populated
const emptyStore = mockStore({});

// case when common.locale is populated with invalid locale
const invalidStore = mockStore({ common: { locale: 'invalid_locale' } });

test('renders with default props', async () => {
  render(<CustomFrame onChange={jest.fn()} value={emptyValue} />, {
    store,
  });
  expect(screen.getByLabelText('Loading')).toBeVisible();
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getByText('Configure custom time range')).toBeInTheDocument();
  expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Specific Date/Time')).toBeInTheDocument();
  expect(screen.getByLabelText('calendar')).toBeInTheDocument();
});

test('renders with empty store', () => {
  render(<CustomFrame onChange={jest.fn()} value={emptyValue} />, {
    store: emptyStore,
  });
  expect(screen.getByText('Configure custom time range')).toBeInTheDocument();
  expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Specific Date/Time')).toBeInTheDocument();
  expect(screen.getByLabelText('calendar')).toBeInTheDocument();
});

test('renders since and until with specific date/time with default locale', () => {
  render(<CustomFrame onChange={jest.fn()} value={specificValue} />, {
    store: emptyStore,
  });
  expect(screen.getAllByText('Specific Date/Time').length).toBe(2);
  expect(screen.getAllByLabelText('calendar').length).toBe(2);
});

test('renders with invalid locale', () => {
  render(<CustomFrame onChange={jest.fn()} value={emptyValue} />, {
    store: invalidStore,
  });
  expect(screen.getByText('Configure custom time range')).toBeInTheDocument();
  expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Specific Date/Time')).toBeInTheDocument();
  expect(screen.getByLabelText('calendar')).toBeInTheDocument();
});

test('renders since and until with specific date/time with invalid locale', () => {
  render(<CustomFrame onChange={jest.fn()} value={specificValue} />, {
    store: invalidStore,
  });
  expect(screen.getAllByText('Specific Date/Time').length).toBe(2);
  expect(screen.getAllByLabelText('calendar').length).toBe(2);
});

test('renders since and until with specific date/time', async () => {
  render(<CustomFrame onChange={jest.fn()} value={specificValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getAllByText('Specific Date/Time').length).toBe(2);
  expect(screen.getAllByLabelText('calendar').length).toBe(2);
});

test('renders since and until with relative date/time', async () => {
  render(<CustomFrame onChange={jest.fn()} value={relativeNowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getAllByText('Relative Date/Time').length).toBe(2);
  expect(screen.getAllByRole('spinbutton').length).toBe(2);
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Days After')).toBeInTheDocument();
});

test('renders since and until with Now option', async () => {
  render(<CustomFrame onChange={jest.fn()} value={nowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getAllByText('Now').length).toBe(2);
});

test('renders since and until with Midnight option', async () => {
  render(<CustomFrame onChange={jest.fn()} value={todayValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getAllByText('Midnight').length).toBe(2);
});

test('renders anchor with now option', async () => {
  render(<CustomFrame onChange={jest.fn()} value={relativeNowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getByText('Anchor to')).toBeInTheDocument();
  expect(screen.getByLabelText('Now')).toBeInTheDocument();
  expect(screen.getByLabelText('Date/Time')).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Select date')).not.toBeInTheDocument();
});

test('renders anchor with date/time option', async () => {
  render(<CustomFrame onChange={jest.fn()} value={relativeTodayValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(screen.getByText('Anchor to')).toBeInTheDocument();
  expect(screen.getByLabelText('Now')).toBeInTheDocument();
  expect(screen.getByLabelText('Date/Time')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Select date')).toBeInTheDocument();
});

test('triggers onChange when the anchor changes', async () => {
  const onChange = jest.fn();
  render(<CustomFrame onChange={onChange} value={relativeNowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  await userEvent.click(screen.getByRole('radio', { name: 'Date/Time' }));
  expect(onChange).toHaveBeenCalled();
});

test('triggers onChange when the value changes', async () => {
  const onChange = jest.fn();
  render(<CustomFrame onChange={onChange} value={emptyValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  await userEvent.click(screen.getByRole('img', { name: 'up' }));
  expect(onChange).toHaveBeenCalled();
});

test('triggers onChange when the mode changes', async () => {
  const onChange = jest.fn();
  render(<CustomFrame onChange={onChange} value={todayNowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  await userEvent.click(screen.getByLabelText('Start (inclusive)'));
  await userEvent.click(await screen.findByTitle('Relative Date/Time'));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  await userEvent.click(screen.getByLabelText('End (exclusive)'));
  const specificOptions = await screen.findAllByTitle('Specific Date/Time');
  await userEvent.click(specificOptions[specificOptions.length - 1]);
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
});

test('triggers onChange when the grain changes', async () => {
  const onChange = jest.fn();
  render(<CustomFrame onChange={onChange} value={relativeNowValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  await userEvent.click(screen.getByText('Days Before'));
  expect(await screen.findByText('Weeks Before')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Weeks Before'));
  await userEvent.click(screen.getByText('Days After'));
  expect(await screen.findByText('Weeks After')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Weeks After'));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
});

test('triggers onChange when the date changes', async () => {
  const onChange = jest.fn();
  render(<CustomFrame onChange={onChange} value={specificValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  const inputs = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(inputs[0]);
  await userEvent.click(screen.getAllByText('Now')[0]);
  await userEvent.click(inputs[1]);
  await userEvent.click(screen.getAllByText('Now')[1]);
  expect(onChange).toHaveBeenCalledTimes(2);
});

test('should translate Date Picker', async () => {
  const onChange = jest.fn();
  const store = mockStore({
    common: { locale: 'fr' },
  });
  render(<CustomFrame onChange={onChange} value={specificValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  // The calendar icon is decorative (`pointer-events: none`); the antd
  // picker opens from a click anywhere on the input, so opt out of the
  // pointer events check rather than target a different element.
  await userEvent.click(screen.getAllByLabelText('calendar')[0], {
    pointerEventsCheck: 0,
  });
  expect(screen.getByText('2021')).toBeInTheDocument();

  expect(screen.getByText('lu')).toBeInTheDocument();
  expect(screen.getByText('ma')).toBeInTheDocument();
  expect(screen.getByText('me')).toBeInTheDocument();
  expect(screen.getByText('je')).toBeInTheDocument();
  expect(screen.getByText('ve')).toBeInTheDocument();
  expect(screen.getByText('sa')).toBeInTheDocument();
  expect(screen.getByText('di')).toBeInTheDocument();
});

test('calls onChange when START Specific Date/Time is selected', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame
      onChange={onChange}
      value={specificValue}
      isOverflowingFilterBar
    />,
    { store },
  );

  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));

  const specificDateTimeOptions = screen.getAllByText('Specific Date/Time');
  expect(specificDateTimeOptions.length).toBe(2);

  const calendarIcons = screen.getAllByLabelText('calendar');
  // The calendar icon is decorative (`pointer-events: none`); the antd
  // picker opens from a click anywhere on the input, so opt out of the
  // pointer events check rather than target a different element.
  await userEvent.click(calendarIcons[0], { pointerEventsCheck: 0 });

  const randomDate = screen.getByTitle('2021-03-11');
  await userEvent.click(randomDate);

  const okButton = screen.getByText('OK');
  await userEvent.click(okButton);

  expect(onChange).toHaveBeenCalled();
});

test('calls onChange when END Specific Date/Time is selected', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame
      onChange={onChange}
      value={specificValue}
      isOverflowingFilterBar
    />,
    { store },
  );

  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));

  const specificDateTimeOptions = screen.getAllByText('Specific Date/Time');
  expect(specificDateTimeOptions.length).toBe(2);

  const calendarIcons = screen.getAllByLabelText('calendar');
  // The calendar icon is decorative (`pointer-events: none`); the antd
  // picker opens from a click anywhere on the input, so opt out of the
  // pointer events check rather than target a different element.
  await userEvent.click(calendarIcons[1], { pointerEventsCheck: 0 });

  const randomDate = screen.getByTitle('2021-03-28');
  await userEvent.click(randomDate);

  const okButton = screen.getByText('OK');
  await userEvent.click(okButton);

  expect(onChange).toHaveBeenCalled();
});

test('calls onChange when a date is picked from anchor mode date picker', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame
      onChange={onChange}
      value={relativeTodayValue}
      isOverflowingFilterBar
    />,
    { store },
  );

  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));

  const relativeDateTimeOptions = screen.getAllByText('Relative Date/Time');
  expect(relativeDateTimeOptions.length).toBe(2);

  await waitFor(() =>
    expect(screen.getByText('Anchor to')).toBeInTheDocument(),
  );

  const dateTimeRadio = screen.getByRole('radio', { name: 'Date/Time' });

  expect(dateTimeRadio).toBeChecked();

  const calendarIcon = screen.getByLabelText('calendar');
  // The calendar icon is decorative (`pointer-events: none`); the antd
  // picker opens from a click anywhere on the input, so opt out of the
  // pointer events check rather than target a different element.
  await userEvent.click(calendarIcon, { pointerEventsCheck: 0 });

  const randomDate = screen.getByTitle('2024-06-05');
  await userEvent.click(randomDate);

  const okButton = screen.getByText('OK');
  await userEvent.click(okButton);

  expect(onChange).toHaveBeenCalled();
});

test('with limits, a Start error shows under Start and describes its fields', async () => {
  render(
    <CustomFrame
      onChange={jest.fn()}
      value={specificValue}
      limits={{
        startId: 'start',
        endId: 'end',
        start: {
          id: 'start-error',
          message: "Start can't be earlier than Apr 30, 2024 (13 months ago).",
        },
      }}
    />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));

  const message = screen.getByRole('alert');
  expect(message).toHaveAttribute('id', 'start-error');
  const startMode = screen.getByRole('combobox', {
    name: /Start \(inclusive\)/,
  });
  expect(startMode).toHaveAttribute('id', 'start');
  expect(startMode).toHaveAttribute('aria-invalid', 'true');
  expect(startMode).toHaveAttribute('aria-describedby', 'start-error');
  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  expect(startDate).toHaveAttribute('aria-invalid', 'true');
  expect(startDate).toHaveAttribute('aria-describedby', 'start-error');
  expect(endDate).not.toHaveAttribute('aria-invalid', 'true');
  expect(
    screen.getByRole('combobox', { name: /End \(exclusive\)/ }),
  ).toHaveAttribute('id', 'end');
});

test('with limits, the specific date pickers grey out the days the limits rule out', async () => {
  render(
    <CustomFrame
      onChange={jest.fn()}
      value={specificValue}
      limits={{
        startId: 'start',
        endId: 'end',
        disabledStartDate: day => day.date() === 10,
        disabledEndDate: day => day.date() === 20,
      }}
    />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));

  const [startDate, endDate] = screen.getAllByPlaceholderText('Select date');
  await userEvent.click(startDate);
  const startCell = await waitFor(() => {
    const cell = document.querySelector('td[title="2021-03-10"]');
    expect(cell).toBeInTheDocument();
    return cell!;
  });
  expect(startCell).toHaveClass('ant-picker-cell-disabled');
  expect(document.querySelector('td[title="2021-03-11"]')).not.toHaveClass(
    'ant-picker-cell-disabled',
  );

  await userEvent.click(endDate);
  await waitFor(() =>
    expect(
      document.querySelectorAll(
        'td[title="2021-03-20"].ant-picker-cell-disabled',
      ),
    ).toHaveLength(1),
  );
});

const LIMITS = { startId: 'start', endId: 'end' };

test('with limits the date pickers and relative quantities are named', async () => {
  const { unmount } = render(
    <CustomFrame onChange={jest.fn()} value={specificValue} limits={LIMITS} />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(
    screen.getByRole('textbox', { name: 'Start (inclusive)' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'End (exclusive)' }),
  ).toBeInTheDocument();
  unmount();

  render(
    <CustomFrame
      onChange={jest.fn()}
      value={relativeTodayValue}
      limits={LIMITS}
    />,
    { store },
  );
  expect(
    await screen.findAllByRole('spinbutton', { name: 'Relative quantity' }),
  ).toHaveLength(2);
  expect(
    screen.getByRole('textbox', { name: 'Anchor to' }),
  ).toBeInTheDocument();
});

test('without limits the date pickers and relative quantities get no name, unchanged', async () => {
  const { unmount } = render(
    <CustomFrame onChange={jest.fn()} value={specificValue} />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  screen
    .getAllByPlaceholderText('Select date')
    .forEach(input => expect(input).not.toHaveAttribute('aria-label'));
  unmount();

  render(<CustomFrame onChange={jest.fn()} value={relativeTodayValue} />, {
    store,
  });
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  [
    ...screen.getAllByRole('spinbutton'),
    screen.getByPlaceholderText('Select date'),
  ].forEach(input => expect(input).not.toHaveAttribute('aria-label'));
});

const GREY_20 = {
  ...LIMITS,
  disabledEndDate: (day: Dayjs) => day.date() === 20,
};

async function typeEnd(text: string) {
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  const endDate = screen.getByRole('textbox', { name: 'End (exclusive)' });
  await userEvent.click(endDate);
  await userEvent.type(endDate, text, {
    skipClick: true,
    initialSelectionStart: 0,
    initialSelectionEnd: (endDate as HTMLInputElement).value.length,
  });
  return endDate;
}

test.each(['{Tab}', '{Enter}', 'a click away'])(
  'a typed End the calendar greys is committed on %s',
  async key => {
    const onChange = jest.fn();
    render(
      <CustomFrame
        onChange={onChange}
        value={specificValue}
        limits={GREY_20}
      />,
      { store },
    );
    const endDate = await typeEnd('2021-03-20 00:00:00');
    if (key === '{Tab}') {
      await userEvent.tab();
    } else if (key === 'a click away') {
      await userEvent.click(document.body);
    } else {
      await userEvent.type(endDate, key, { skipClick: true });
    }
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      '2021-03-16T00:00:00 : 2021-03-20T00:00:00',
    );
  },
);

test('a typed greyed End committed on Enter is not committed again on blur', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame onChange={onChange} value={specificValue} limits={GREY_20} />,
    { store },
  );
  const endDate = await typeEnd('2021-03-20 00:00:00');
  await userEvent.type(endDate, '{Enter}', { skipClick: true });
  await userEvent.tab();
  expect(onChange).toHaveBeenCalledTimes(1);
});

test('a typed greyed End edited into unparseable text is not committed on Enter', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame onChange={onChange} value={specificValue} limits={GREY_20} />,
    { store },
  );
  const endDate = await typeEnd('2021-03-20 00:00:00');
  await userEvent.type(endDate, '{Backspace}{Enter}', { skipClick: true });
  expect(onChange).not.toHaveBeenCalled();
});

test('a greyed End replaced by the stored date typed back is not committed on Tab', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame onChange={onChange} value={specificValue} limits={GREY_20} />,
    { store },
  );
  const endDate = await typeEnd('2021-03-20 00:00:00');
  await userEvent.type(endDate, '2021-03-17 00:00:00', {
    skipClick: true,
    initialSelectionStart: 0,
    initialSelectionEnd: (endDate as HTMLInputElement).value.length,
  });
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
  expect(endDate).toHaveValue('2021-03-17 00:00:00');
});

test('a shortcut key after typing a greyed End does not let Escape drop the date', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame onChange={onChange} value={specificValue} limits={GREY_20} />,
    { store },
  );
  await typeEnd('2021-03-20 00:00:00');
  await userEvent.keyboard('{Control>}c{/Control}{Escape}');
  await userEvent.tab();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(
    '2021-03-16T00:00:00 : 2021-03-20T00:00:00',
  );
});

function StatefulFrame({
  onChange,
  limits,
}: {
  onChange: (value: string) => void;
  limits: FrameLimits;
}) {
  const [value, setValue] = useState(specificValue);
  return (
    <CustomFrame
      value={value}
      limits={limits}
      onChange={next => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

async function typeAllowedEndInStatefulFrame(onChange: jest.Mock) {
  render(<StatefulFrame onChange={onChange} limits={GREY_20} />, {
    store,
  });
  return typeEnd('2021-03-21 00:00:00');
}

test('with limits a typed allowed End is committed once on Enter, by the picker', async () => {
  const onChange = jest.fn();
  const endDate = await typeAllowedEndInStatefulFrame(onChange);
  await userEvent.type(endDate, '{Enter}', { skipClick: true });
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(
    '2021-03-16T00:00:00 : 2021-03-21T00:00:00',
  );
});

test('with limits a typed allowed End is committed once on Tab when the value follows onChange', async () => {
  const onChange = jest.fn();
  await typeAllowedEndInStatefulFrame(onChange);
  await userEvent.tab();
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(
    '2021-03-16T00:00:00 : 2021-03-21T00:00:00',
  );
});

test('while the check is pending a greyed date is not marked invalid', async () => {
  render(
    <CustomFrame
      onChange={jest.fn()}
      value={specificValue}
      limits={{
        ...LIMITS,
        pending: true,
        disabledEndDate: day => day.date() === 17,
      }}
    />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  expect(
    screen.getByRole('textbox', { name: 'End (exclusive)' }),
  ).not.toHaveAttribute('aria-invalid', 'true');
});

test('with every day greyed and no error, no date input is marked invalid', async () => {
  render(
    <CustomFrame
      onChange={jest.fn()}
      value={specificValue}
      limits={{
        ...LIMITS,
        disabledStartDate: () => true,
        disabledEndDate: () => true,
      }}
    />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  screen
    .getAllByPlaceholderText('Select date')
    .forEach(input =>
      expect(input).not.toHaveAttribute('aria-invalid', 'true'),
    );
});

test('a range error marks the Start and End modes and date inputs invalid', async () => {
  render(
    <CustomFrame
      onChange={jest.fn()}
      value={specificValue}
      limits={{ ...LIMITS, rowErrorId: 'row-error', rowInvalid: true }}
    />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  [
    screen.getByRole('combobox', { name: /Start \(inclusive\)/ }),
    screen.getByRole('combobox', { name: /End \(exclusive\)/ }),
    ...screen.getAllByPlaceholderText('Select date'),
  ].forEach(element => {
    expect(element).toHaveAttribute('aria-invalid', 'true');
    expect(element).toHaveAttribute('aria-describedby', 'row-error');
  });
});

test('a click on a greyed day commits nothing', async () => {
  const onChange = jest.fn();
  render(
    <CustomFrame onChange={onChange} value={specificValue} limits={GREY_20} />,
    { store },
  );
  await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  await userEvent.click(
    screen.getByRole('textbox', { name: 'End (exclusive)' }),
  );
  const cell = await waitFor(() => {
    const element = document.querySelector('td[title="2021-03-20"]');
    expect(element).toHaveClass('ant-picker-cell-disabled');
    return element!;
  });
  await userEvent.click(cell);
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
});

test.each(['{Tab}', '{Enter}'])(
  'without limits a typed date is committed on %s',
  async key => {
    const onChange = jest.fn();
    render(<CustomFrame onChange={onChange} value={specificValue} />, {
      store,
    });
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
    const [, endDate] = screen.getAllByPlaceholderText('Select date');
    await userEvent.click(endDate);
    await userEvent.type(endDate, '2021-03-20 00:00:00', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: (endDate as HTMLInputElement).value.length,
    });
    if (key === '{Tab}') {
      await userEvent.tab();
    } else {
      await userEvent.type(endDate, key, { skipClick: true });
    }
    expect(onChange).toHaveBeenCalledWith(
      '2021-03-16T00:00:00 : 2021-03-20T00:00:00',
    );
  },
);

test.each([
  ['{Tab}', 'off', undefined],
  ['{Enter}', 'off', undefined],
  ['{Tab}', 'on', GREY_20],
  ['{Enter}', 'on', GREY_20],
])(
  'unparseable text is not committed on %s, limits %s',
  async (key, _, limits) => {
    const onChange = jest.fn();
    render(
      <CustomFrame onChange={onChange} value={specificValue} limits={limits} />,
      { store },
    );
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
    const [, endDate] = screen.getAllByPlaceholderText('Select date');
    await userEvent.click(endDate);
    await userEvent.type(endDate, '2021-13-45 99:00:00', {
      skipClick: true,
      initialSelectionStart: 0,
      initialSelectionEnd: (endDate as HTMLInputElement).value.length,
    });
    if (key === '{Tab}') {
      await userEvent.tab();
    } else {
      await userEvent.type(endDate, key, { skipClick: true });
    }
    expect(onChange).not.toHaveBeenCalled();
  },
);

test('a date typed before an outside change is not committed by a later focus and blur', async () => {
  const onChange = jest.fn();
  const { rerender } = render(
    <CustomFrame onChange={onChange} value={specificValue} limits={LIMITS} />,
    { store },
  );
  const endDate = await typeEnd('2021-03-20 00:00:00');
  await userEvent.click(document.body);
  rerender(
    <CustomFrame
      onChange={onChange}
      value="2021-03-16T00:00:00 : 2021-03-18T00:00:00"
      limits={GREY_20}
    />,
  );
  onChange.mockClear();
  await userEvent.click(endDate);
  await userEvent.tab();
  expect(onChange).not.toHaveBeenCalled();
});
