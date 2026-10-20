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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import TeamsDestinationSelect from './TeamsDestinationSelect';

const endpoint = 'glob:*/api/v1/report/teams_destinations/';
const destinations = [
  { key: 'ops', label: 'Operations', available: true },
  { key: 'finance', label: 'Finance', available: false },
];

afterEach(() => fetchMock.clearHistory().removeRoutes());

test('selects approved destinations by label and returns only the stable key', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="" onChange={onChange} />);
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByText('Operations'));
  expect(onChange).toHaveBeenCalledWith('ops', expect.anything());
});

test('explains a missing installation without clearing the saved destination', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="finance" onChange={onChange} />);
  expect(
    await screen.findByText(
      /Install the notification bot in the approved team before delivery/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Finance (Bot installation required)'),
  ).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('preserves removed destination keys with a visible unavailable state', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="removed-key" onChange={onChange} />);
  expect(
    await screen.findByText(/This saved Teams destination is unavailable/),
  ).toBeInTheDocument();
  expect(screen.getByText('removed-key (Unavailable)')).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('a loading failure keeps saved selections and displays a recoverable error', async () => {
  fetchMock.get(endpoint, 500);
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="ops" onChange={onChange} />);
  expect(
    await screen.findByText(/Unable to load Teams destinations/),
  ).toBeInTheDocument();
  expect(screen.getByRole('combobox')).toBeDisabled();
  expect(onChange).not.toHaveBeenCalled();
});

test('supports saving a configured destination before bot installation', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="" onChange={onChange} />);
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(
    await screen.findByText('Finance (Bot installation required)'),
  );
  expect(onChange).toHaveBeenCalledWith('finance', expect.anything());
});

test('keeps Teams destinations disabled for incompatible schedules', async () => {
  fetchMock.get(endpoint, { result: destinations });
  render(<TeamsDestinationSelect value="ops" onChange={jest.fn()} disabled />);
  await waitFor(() =>
    expect(screen.getByText('Operations')).toBeInTheDocument(),
  );
  expect(screen.getByRole('combobox')).toBeDisabled();
});

test('explains an empty allowlist without inventing destinations', async () => {
  fetchMock.get(endpoint, { result: [] });
  const onChange = jest.fn();
  render(<TeamsDestinationSelect value="" onChange={onChange} />);
  expect(
    await screen.findByText(/No approved Teams destinations are configured/),
  ).toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});

test('allows replacing a removed saved key with an approved destination', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  const { rerender } = render(
    <TeamsDestinationSelect value="removed" onChange={onChange} />,
  );
  expect(await screen.findByText('removed (Unavailable)')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(await screen.findByText('Operations'));
  expect(onChange).toHaveBeenCalledWith('ops', expect.anything());
  rerender(<TeamsDestinationSelect value="ops" onChange={onChange} />);
  expect(
    screen.queryByText(/This saved Teams destination is unavailable/),
  ).not.toBeInTheDocument();
  expect(screen.getAllByText('Operations').length).toBeGreaterThan(0);
});

test('an availability-only refresh preserves the stable saved destination key', async () => {
  fetchMock.get(endpoint, { result: destinations });
  const onChange = jest.fn();
  const { unmount } = render(
    <TeamsDestinationSelect value="finance" onChange={onChange} />,
  );
  expect(
    await screen.findByText('Finance (Bot installation required)'),
  ).toBeInTheDocument();
  unmount();
  fetchMock.removeRoutes();
  fetchMock.get(endpoint, {
    result: destinations.map(item => ({ ...item, available: true })),
  });
  render(<TeamsDestinationSelect value="finance" onChange={onChange} />);
  expect(await screen.findByText('Finance')).toBeInTheDocument();
  expect(
    screen.queryByText(/Install the notification bot/),
  ).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
