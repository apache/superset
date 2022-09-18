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
import React from 'react';
import thunk from 'redux-thunk';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { CustomFrame } from '.';

jest.useFakeTimers();

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

test('renders with default props', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={emptyValue} />
    </Provider>,
  );
  expect(screen.getByText('Configure custom time range')).toBeInTheDocument();
  expect(screen.getByText('Relative Date/Time')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Specific Date/Time')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'calendar' })).toBeInTheDocument();
});

test('renders since and until with specific date/time', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={specificValue} />
    </Provider>,
  );
  expect(screen.getAllByText('Specific Date/Time').length).toBe(2);
  expect(screen.getAllByRole('img', { name: 'calendar' }).length).toBe(2);
});

test('renders since and until with relative date/time', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={relativeNowValue} />
    </Provider>,
  );
  expect(screen.getAllByText('Relative Date/Time').length).toBe(2);
  expect(screen.getAllByRole('spinbutton').length).toBe(2);
  expect(screen.getByText('Days Before')).toBeInTheDocument();
  expect(screen.getByText('Days After')).toBeInTheDocument();
});

test('renders since and until with Now option', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={nowValue} />
    </Provider>,
  );
  expect(screen.getAllByText('Now').length).toBe(2);
});

test('renders since and until with Midnight option', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={todayValue} />
    </Provider>,
  );
  expect(screen.getAllByText('Midnight').length).toBe(2);
});

test('renders anchor with now option', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={relativeNowValue} />
    </Provider>,
  );
  expect(screen.getByText('Anchor to')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'NOW' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Date/Time' })).toBeInTheDocument();
  expect(screen.queryByPlaceholderText('Select date')).not.toBeInTheDocument();
});

test('renders anchor with date/time option', () => {
  render(
    <Provider store={store}>
      <CustomFrame onChange={jest.fn()} value={relativeTodayValue} />
    </Provider>,
  );
  expect(screen.getByText('Anchor to')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'NOW' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Date/Time' })).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Select date')).toBeInTheDocument();
});

test('triggers onChange when the anchor changes', () => {
  const onChange = jest.fn();
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={relativeNowValue} />
    </Provider>,
  );
  userEvent.click(screen.getByRole('radio', { name: 'Date/Time' }));
  expect(onChange).toHaveBeenCalled();
});

test('triggers onChange when the value changes', () => {
  const onChange = jest.fn();
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={emptyValue} />
    </Provider>,
  );
  userEvent.click(screen.getByRole('img', { name: 'up' }));
  expect(onChange).toHaveBeenCalled();
});

test('triggers onChange when the mode changes', async () => {
  const onChange = jest.fn();
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={todayNowValue} />
    </Provider>,
  );
  userEvent.click(screen.getByTitle('Midnight'));
  expect(await screen.findByTitle('Relative Date/Time')).toBeInTheDocument();
  userEvent.click(screen.getByTitle('Relative Date/Time'));
  userEvent.click(screen.getAllByTitle('Now')[1]);
  expect(
    await screen.findByText('Configure custom time range'),
  ).toBeInTheDocument();
  userEvent.click(screen.getAllByTitle('Specific Date/Time')[1]);
  expect(onChange).toHaveBeenCalledTimes(2);
});

test('triggers onChange when the grain changes', async () => {
  const onChange = jest.fn();
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={relativeNowValue} />
    </Provider>,
  );
  userEvent.click(screen.getByText('Days Before'));
  expect(await screen.findByText('Weeks Before')).toBeInTheDocument();
  userEvent.click(screen.getByText('Weeks Before'));
  userEvent.click(screen.getByText('Days After'));
  expect(await screen.findByText('Weeks After')).toBeInTheDocument();
  userEvent.click(screen.getByText('Weeks After'));
  expect(onChange).toHaveBeenCalledTimes(2);
});

test('triggers onChange when the date changes', async () => {
  const onChange = jest.fn();
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={specificValue} />
    </Provider>,
  );
  const inputs = screen.getAllByPlaceholderText('Select date');
  userEvent.click(inputs[0]);
  userEvent.click(screen.getAllByText('Now')[0]);
  userEvent.click(inputs[1]);
  userEvent.click(screen.getAllByText('Now')[1]);
  expect(onChange).toHaveBeenCalledTimes(2);
});

test('should translate Date Picker', () => {
  const onChange = jest.fn();
  const store = mockStore({
    common: { locale: 'fr' },
  });
  render(
    <Provider store={store}>
      <CustomFrame onChange={onChange} value={specificValue} />
    </Provider>,
  );
  userEvent.click(screen.getAllByRole('img', { name: 'calendar' })[0]);
  expect(screen.getByText('2021')).toBeInTheDocument();
  expect(screen.getByText('lu')).toBeInTheDocument();
  expect(screen.getByText('ma')).toBeInTheDocument();
  expect(screen.getByText('me')).toBeInTheDocument();
  expect(screen.getByText('je')).toBeInTheDocument();
  expect(screen.getByText('ve')).toBeInTheDocument();
  expect(screen.getByText('sa')).toBeInTheDocument();
  expect(screen.getByText('di')).toBeInTheDocument();
});
