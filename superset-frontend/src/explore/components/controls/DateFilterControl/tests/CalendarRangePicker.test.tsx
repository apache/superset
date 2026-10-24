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
import { NO_TIME_RANGE, SupersetClient } from '@superset-ui/core';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { CalendarRangePicker } from '../components/CalendarRangePicker';

const mockGet = jest.spyOn(SupersetClient, 'get');

const resolveTo = (since: string, until: string) =>
  mockGet.mockResolvedValue({
    json: { result: [{ since, until }] },
  } as unknown as Awaited<ReturnType<typeof SupersetClient.get>>);

const inputs = () => [
  screen.getByPlaceholderText('Start date') as HTMLInputElement,
  screen.getByPlaceholderText('End date') as HTMLInputElement,
];

beforeEach(() => {
  mockGet.mockReset();
});

test('shows a fixed range with the end date included and does not call the backend', () => {
  render(
    <CalendarRangePicker
      value="2024-01-01 : 2024-02-01"
      onChange={jest.fn()}
    />,
  );
  const [start, end] = inputs();
  expect(start).toHaveValue('2024-01-01');
  expect(end).toHaveValue('2024-01-31');
  expect(mockGet).not.toHaveBeenCalled();
});

test('shows no dates when there is no time range', () => {
  render(<CalendarRangePicker value={NO_TIME_RANGE} onChange={jest.fn()} />);
  const [start, end] = inputs();
  expect(start).toHaveValue('');
  expect(end).toHaveValue('');
  expect(mockGet).not.toHaveBeenCalled();
});

test('shows the dates an expression such as "Last week" resolves to', async () => {
  resolveTo('2024-01-01T00:00:00', '2024-01-08T00:00:00');
  render(<CalendarRangePicker value="Last week" onChange={jest.fn()} />);
  await waitFor(() => expect(inputs()[0]).toHaveValue('2024-01-01'));
  expect(inputs()[1]).toHaveValue('2024-01-07');
});

test('warns when a resolved range includes a time of day', async () => {
  resolveTo('2024-01-01T09:30:00', '2024-01-08T09:30:00');
  const { container } = render(
    <CalendarRangePicker value="Last 7 days" onChange={jest.fn()} />,
  );
  await waitFor(() => expect(inputs()[0]).toHaveValue('2024-01-01'));
  expect(container.querySelector('.ant-picker-status-warning')).toBeTruthy();
});

test('picking dates reports a fixed range that includes the chosen end date', async () => {
  const onChange = jest.fn();
  render(<CalendarRangePicker value={NO_TIME_RANGE} onChange={onChange} />);
  const [start, end] = inputs();
  await userEvent.type(start, '2024-03-05{enter}');
  await userEvent.type(end, '2024-03-20{enter}');
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith('2024-03-05 : 2024-03-21'),
  );
});

test('clearing the dates reports no time range', async () => {
  const onChange = jest.fn();
  const { container } = render(
    <CalendarRangePicker value="2024-01-01 : 2024-02-01" onChange={onChange} />,
  );
  const clear = container.querySelector('.ant-picker-clear') as HTMLElement;
  fireEvent.click(clear);
  expect(onChange).toHaveBeenCalledWith(NO_TIME_RANGE);
});
