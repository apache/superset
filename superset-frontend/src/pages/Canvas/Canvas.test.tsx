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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { canvas } from 'src/core';
import { subscribeRealtime } from 'src/middleware/realtime';
import CanvasPage from '.';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ canvasId: '7' }),
}));
jest.mock('src/middleware/realtime', () => ({
  subscribeRealtime: jest.fn(() => jest.fn()),
  subscribeRealtimeOpen: jest.fn(() => jest.fn()),
}));

const metadataEndpoint = 'glob:*/api/v1/canvas/7';
const definitionEndpoint = 'glob:*/api/v1/canvas/7/definition';

const definition = (children: string[], revision = 1) => ({
  result: {
    version: 1,
    revision,
    definition: {
      version: 1,
      root: { layout: { columns: 24, gap: 16, rowUnit: 40 }, children },
      nodes: Object.fromEntries(
        children.map(nodeId => [nodeId, { widget: `w-${nodeId}`, layout: {} }]),
      ),
      interactions: { filters: {} },
    },
    filterScopes: {},
    placements: {},
    widgetTypes: {},
    gridColumns: {},
  },
});

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  fetchMock.get(metadataEndpoint, {
    result: { id: 7, title: 'Exec overview', description: 'KPIs and trend' },
  });
});

test('shows the canvas title and an empty state', async () => {
  fetchMock.get(definitionEndpoint, definition([]));

  render(<CanvasPage />, { useRedux: true });

  expect(await screen.findByText('Exec overview')).toBeInTheDocument();
  expect(screen.getByText('KPIs and trend')).toBeInTheDocument();
  expect(screen.getByText('This canvas is empty')).toBeInTheDocument();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toEqual({
      id: 7,
      title: 'Exec overview',
      revision: 1,
    }),
  );
});

test('reloads the definition when this canvas changes', async () => {
  let notify: (payload: unknown) => void = () => {};
  jest.mocked(subscribeRealtime).mockImplementation((_topic, handler) => {
    notify = handler;
    return jest.fn();
  });
  fetchMock.get(definitionEndpoint, definition([]));

  render(<CanvasPage />, { useRedux: true });
  expect(await screen.findByText('This canvas is empty')).toBeInTheDocument();

  fetchMock.removeRoute(definitionEndpoint);
  fetchMock.get(definitionEndpoint, definition(['a'], 2));
  // Another canvas changing is ignored; this one reloads.
  notify({ entity_type: 'canvas', id: 8 });
  notify({ entity_type: 'canvas', id: 7 });

  expect(
    await screen.findByText('This widget is unavailable'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(definitionEndpoint)).toHaveLength(2);
});

test('explains when the canvas cannot be opened', async () => {
  fetchMock.get(definitionEndpoint, 404);

  render(<CanvasPage />, { useRedux: true });

  expect(
    await screen.findByText(
      'This canvas does not exist, or you do not have access to it',
    ),
  ).toBeInTheDocument();
});
