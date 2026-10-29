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
import { useDraftHistory } from './useDraftHistory';

const undoEndpoint = 'glob:*/api/v1/canvas/draft/undo';
const redoEndpoint = 'glob:*/api/v1/canvas/draft/redo';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

function Harness({
  revision,
  fetched,
  reload,
}: {
  revision: number;
  fetched: { canUndo?: boolean; canRedo?: boolean };
  reload: () => void;
}) {
  const history = useDraftHistory('tok-123', revision, fetched, reload);
  return (
    <>
      <button type="button" onClick={history.undo} disabled={!history.canUndo}>
        Undo
      </button>
      <button type="button" onClick={history.redo} disabled={!history.canRedo}>
        Redo
      </button>
    </>
  );
}

const renderHarness = (fetched: { canUndo?: boolean; canRedo?: boolean }) => {
  const reload = jest.fn();
  const view = render(
    <Harness revision={3} fetched={fetched} reload={reload} />,
    { useRedux: true },
  );
  return { ...view, reload };
};

const undo = () => screen.getByRole('button', { name: 'Undo' });
const redo = () => screen.getByRole('button', { name: 'Redo' });

test('the draft says what can be stepped, not the browser', () => {
  // The same draft is edited by an agent through MCP, so the stack lives on
  // the server and this only reports it.
  renderHarness({ canUndo: true, canRedo: false });

  expect(undo()).toBeEnabled();
  expect(redo()).toBeDisabled();
});

test('undoing names the revision it is stepping back from', async () => {
  fetchMock.post(undoEndpoint, {
    result: { revision: 4, canUndo: false, canRedo: true },
  });
  const { reload } = renderHarness({ canUndo: true });

  fireEvent.click(undo());

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(JSON.parse(call.options.body as string)).toEqual({ revision: 3 });
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');

  // A step rebuilds the whole definition, which the layout write path does not
  // carry, so the canvas is refetched rather than patched in place.
  await waitFor(() => expect(reload).toHaveBeenCalled());
  // What came back, which is now a redo and nothing left to undo.
  await waitFor(() => expect(undo()).toBeDisabled());
  expect(redo()).toBeEnabled();
});

test('redoing steps the other way', async () => {
  fetchMock.post(redoEndpoint, {
    result: { revision: 5, canUndo: true, canRedo: false },
  });
  renderHarness({ canRedo: true });

  fireEvent.click(redo());

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(redoEndpoint)).toHaveLength(1),
  );
  await waitFor(() => expect(undo()).toBeEnabled());
});

test('a change made since the fetch can be undone without asking the server', () => {
  // A drag writes to the draft and moves its revision on. The server would
  // say `canUndo` too, but not until something fetches the definition again,
  // and undo has to be live the moment the widget lands.
  const { rerender, reload } = renderHarness({ canUndo: false });
  expect(undo()).toBeDisabled();

  rerender(
    <Harness revision={4} fetched={{ canUndo: false }} reload={reload} />,
  );

  expect(undo()).toBeEnabled();
});

test('a failed step refetches, so the draft is not shown as something it is not', async () => {
  fetchMock.post(undoEndpoint, 409);
  const { reload } = renderHarness({ canUndo: true });

  fireEvent.click(undo());

  await waitFor(() => expect(reload).toHaveBeenCalled());
});
