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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
  waitFor,
} from 'spec/helpers/testing-library';
import { CustomFrame } from '../components';

const TODAY = '2024-06-03';
jest.useFakeTimers();
jest.setSystemTime(new Date(TODAY).getTime());

const emptyValue = '';
const todayNowValue = 'today : now';
const specificValue = '2021-03-16T00:00:00 : 2021-03-17T00:00:00';
const relativeNowValue = `DATEADD(DATETIME("now"), -7, day) : DATEADD(DATETIME("now"), 7, day)`;
const relativeTodayValue = `DATEADD(DATETIME("today"), -7, day) : DATEADD(DATETIME("today"), 7, day)`;

const mockStore = configureStore([thunk]);
const store = mockStore({
  common: { locale: 'en' },
});

const emptyStore = mockStore({});

const waitForLoading = async () => {
  if (screen.queryByLabelText('Loading')) {
    await waitForElementToBeRemoved(() => screen.queryByLabelText('Loading'));
  }
};

describe('CustomFrame', () => {
  test('renders with default props', async () => {
    render(<CustomFrame onChange={jest.fn()} value={emptyValue} />, { store });
    await waitForLoading();
    expect(screen.getByText('Configure custom time range')).toBeInTheDocument();
    expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(screen.getByText('Specific Date/Time')).toBeInTheDocument();
  });

  test('renders with empty store', async () => {
    render(<CustomFrame onChange={jest.fn()} value={emptyValue} />, {
      store: emptyStore,
    });
    expect(
      await screen.findByText('Configure custom time range'),
    ).toBeInTheDocument();
    expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
  });

  test('renders since and until with specific date/time', async () => {
    render(<CustomFrame onChange={jest.fn()} value={specificValue} />, {
      store,
    });
    await waitForLoading();
    expect(screen.getAllByText('Specific Date/Time').length).toBe(2);
    expect(screen.getAllByRole('img', { name: 'calendar' }).length).toBe(2);
  });

  test('triggers onChange when the anchor changes', async () => {
    const onChange = jest.fn();
    render(<CustomFrame onChange={onChange} value={relativeNowValue} />, {
      store,
    });
    await waitForLoading();
    await userEvent.click(screen.getByRole('radio', { name: 'Date/Time' }));
    expect(onChange).toHaveBeenCalled();
  });

  test('triggers onChange when the value changes', async () => {
    const onChange = jest.fn();
    render(<CustomFrame onChange={onChange} value={emptyValue} />, { store });
    await waitForLoading();
    await userEvent.click(screen.getByRole('img', { name: 'up' }));
    expect(onChange).toHaveBeenCalled();
  });

  test('triggers onChange when the mode changes', async () => {
    const onChange = jest.fn();
    render(<CustomFrame onChange={onChange} value={todayNowValue} />, {
      store,
    });
    await waitForLoading();

    // Deterministic selection of Midnight option
    const midnightOptions = await screen.findAllByTitle('Midnight');
    expect(midnightOptions.length).toBeGreaterThan(0);
    await userEvent.click(midnightOptions[0]);

    // Switch to Relative
    const relativeOption = await screen.findByTitle('Relative Date/Time');
    await userEvent.click(relativeOption);
    await waitFor(() => {
      expect(relativeOption).toBeInTheDocument();
    });

    // Switch back via Specific Date/Time to trigger change
    // Using findAllBy to avoid "undefined tagName" error
    const specificOptions = await screen.findAllByTitle('Specific Date/Time');
    await userEvent.click(specificOptions[specificOptions.length - 1]);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('triggers onChange when the grain changes', async () => {
    const onChange = jest.fn();
    render(<CustomFrame onChange={onChange} value={relativeNowValue} />, {
      store,
    });
    await waitForLoading();

    await userEvent.click(screen.getByText('Days Before'));
    const weekOption = await screen.findByText('Weeks Before');
    await userEvent.click(weekOption);

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  test('should translate Date Picker', async () => {
    const frStore = mockStore({ common: { locale: 'fr' } });
    render(<CustomFrame onChange={jest.fn()} value={specificValue} />, {
      store: frStore,
    });
    await waitForLoading();

    const calendars = screen.getAllByRole('img', { name: 'calendar' });
    await userEvent.click(calendars[0]);

    // Check for French weekday abbreviations
    expect(screen.getByText('lu')).toBeInTheDocument();
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
    await waitForLoading();

    const calendars = screen.getAllByRole('img', { name: 'calendar' });
    await userEvent.click(calendars[0]);

    const randomDate = await screen.findByTitle('2021-03-11');
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
    await waitForLoading();

    await screen.findByText('Anchor to');
    const calendars = screen.getAllByRole('img', { name: 'calendar' });
    await userEvent.click(calendars[0]);

    const randomDate = await screen.findByTitle('2024-06-05');
    await userEvent.click(randomDate);

    const okButton = screen.getByText('OK');
    await userEvent.click(okButton);

    expect(onChange).toHaveBeenCalled();
  });
});
