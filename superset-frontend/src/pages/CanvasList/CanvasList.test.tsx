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
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import CanvasList from '.';

const mockPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({ push: mockPush }),
}));
jest.mock('src/middleware/realtime', () => ({
  subscribeRealtime: jest.fn(() => jest.fn()),
  subscribeRealtimeOpen: jest.fn(() => jest.fn()),
}));

const canvases = [0, 1].map(id => ({
  id,
  title: `canvas ${id}`,
  url: `/canvas/${id}/`,
  editors: [],
  changed_on_delta_humanized: '1 day ago',
  changed_by: { first_name: 'user', last_name: `${id}` },
}));

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  mockPush.mockReset();
  fetchMock.get('glob:*/api/v1/canvas/_info*', {
    permissions: ['can_write'],
  });
  fetchMock.get('glob:*/api/v1/canvas/related/*', { count: 0, result: [] });
  fetchMock.get('glob:*/api/v1/canvas/?*', { result: canvases, count: 2 });
});

const renderList = () =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <CanvasList user={{ userId: 1, firstName: 'a', lastName: 'b' }} />
      </QueryParamProvider>
    </MemoryRouter>,
    { useRedux: true },
  );

test('lists canvases linking to their pages', async () => {
  renderList();

  const link = await screen.findByRole('link', { name: 'canvas 1' });
  expect(link).toHaveAttribute('href', '/canvas/1/');
  expect(screen.getByText('canvas 0')).toBeInTheDocument();
});

test('creates a canvas and opens it', async () => {
  fetchMock.post('glob:*/api/v1/canvas/', { id: 42, result: {} });
  renderList();

  fireEvent.click(await screen.findByText('Canvas'));

  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/canvas/42/'));
  const [call] = fetchMock.callHistory.calls('glob:*/api/v1/canvas/', {
    method: 'POST',
  });
  expect(JSON.parse(call.options.body as string)).toEqual({
    title: 'Untitled canvas',
  });
});

test('deletes a canvas after confirmation', async () => {
  fetchMock.delete('glob:*/api/v1/canvas/0', { message: 'OK' });
  renderList();

  const [deleteButton] = await screen.findAllByTestId('delete-action');
  fireEvent.click(deleteButton);
  expect(await screen.findByRole('dialog')).toHaveTextContent(
    'This deletes the canvas for everyone',
  );
  fireEvent.change(await screen.findByTestId('delete-modal-input'), {
    target: { value: 'DELETE' },
  });
  fireEvent.click(await screen.findByTestId('modal-confirm-button'));

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/canvas/0', {
        method: 'DELETE',
      }),
    ).toHaveLength(1),
  );
});
