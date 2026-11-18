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
import { act } from 'react';
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
  token = 'tok-123',
}: {
  revision: number;
  fetched: { canUndo?: boolean; canRedo?: boolean };
  reload: () => void;
  token?: string;
}) {
  const history = useDraftHistory(token, revision, fetched, reload);
  return (
    <>
      <output aria-label="Settling">{String(history.settling)}</output>
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
  const { rerender, reload } = renderHarness({ canUndo: true });

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
  rerender(
    <Harness revision={4} fetched={{ canRedo: true }} reload={reload} />,
  );
  // What came back, which is now a redo and nothing left to undo.
  expect(undo()).toBeDisabled();
  expect(redo()).toBeEnabled();
});

test('redoing steps the other way', async () => {
  fetchMock.post(redoEndpoint, {
    result: { revision: 5, canUndo: true, canRedo: false },
  });
  const { rerender, reload } = renderHarness({ canRedo: true });

  fireEvent.click(redo());

  await waitFor(() => expect(reload).toHaveBeenCalled());
  rerender(
    <Harness revision={5} fetched={{ canUndo: true }} reload={reload} />,
  );
  expect(undo()).toBeEnabled();
  expect(redo()).toBeDisabled();
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

const settling = () => screen.getByRole('status', { name: 'Settling' });

/** Lets responses already released land. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

test('a step is settling until the canvas reaches the revision it produced', async () => {
  // The step answers before the refetch it triggers lands, so for a while the
  // screen still shows the revision the step started from.
  fetchMock.post(undoEndpoint, {
    result: { revision: 4, canUndo: false, canRedo: true },
  });
  const { rerender, reload } = renderHarness({ canUndo: true });
  expect(settling()).toHaveTextContent('false');

  fireEvent.click(undo());

  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect(settling()).toHaveTextContent('true');

  rerender(
    <Harness revision={4} fetched={{ canRedo: true }} reload={reload} />,
  );

  expect(settling()).toHaveTextContent('false');
});

test('a step on another draft is not waited for', async () => {
  // The step answers only after the user has moved to another draft, which
  // counts its revisions from zero and would otherwise wait for revision 9.
  let answer: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    answer = () =>
      resolve(
        new Response(
          JSON.stringify({
            result: { revision: 9, canUndo: true, canRedo: true },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
  });
  fetchMock.post(undoEndpoint, () => held);
  const { rerender, reload } = renderHarness({ canUndo: true });

  fireEvent.click(undo());
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));

  rerender(
    <Harness revision={0} fetched={{}} reload={reload} token="tok-456" />,
  );
  await act(async () => {
    answer();
    await held;
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  expect(settling()).toHaveTextContent('false');
  // Nor does what it answered about the old draft land on the new one.
  expect(undo()).toBeDisabled();
  expect(redo()).toBeDisabled();
  expect(reload).not.toHaveBeenCalled();
});

test('a settled step on one draft does not hold up the next draft', async () => {
  fetchMock.post(undoEndpoint, {
    result: { revision: 4, canUndo: false, canRedo: true },
  });
  const { rerender, reload } = renderHarness({ canUndo: true });

  fireEvent.click(undo());
  await waitFor(() => expect(settling()).toHaveTextContent('true'));
  rerender(
    <Harness revision={4} fetched={{ canRedo: true }} reload={reload} />,
  );
  expect(settling()).toHaveTextContent('false');

  // A new draft counts its revisions from zero, below the step's 4.
  rerender(
    <Harness revision={0} fetched={{}} reload={reload} token="tok-456" />,
  );

  expect(settling()).toHaveTextContent('false');
});

test('neither step is offered until the last one is on screen', async () => {
  // Until the refetch lands, the revision here is the one the step started
  // from: a second step naming it would be rejected as a conflict.
  fetchMock.post(undoEndpoint, {
    result: { revision: 4, canUndo: true, canRedo: true },
  });
  const { rerender, reload } = renderHarness({ canUndo: true });

  fireEvent.click(undo());
  await waitFor(() => expect(settling()).toHaveTextContent('true'));

  expect(undo()).toBeDisabled();
  expect(redo()).toBeDisabled();

  rerender(
    <Harness
      revision={4}
      fetched={{ canUndo: true, canRedo: true }}
      reload={reload}
    />,
  );
  expect(undo()).toBeEnabled();
  expect(redo()).toBeEnabled();

  fireEvent.click(undo());

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(2));
  const revisions = fetchMock.callHistory
    .calls()
    .map(call => JSON.parse(call.options.body as string).revision);
  expect(revisions).toEqual([3, 4]);
});

test('a step asked for while the last one settles is not sent', async () => {
  // Ctrl+Z and a button rendered before the step answered both reach
  // `undo` directly.
  fetchMock.post(undoEndpoint, {
    result: { revision: 4, canUndo: true, canRedo: true },
  });
  const reload = jest.fn();
  const fetched = { canUndo: true };
  function Unguarded() {
    const history = useDraftHistory('tok-123', 3, fetched, reload);
    return (
      <>
        <output aria-label="Settling">{String(history.settling)}</output>
        <button type="button" onClick={history.undo}>
          Undo anyway
        </button>
      </>
    );
  }
  render(<Unguarded />, { useRedux: true });
  const undoAnyway = () => screen.getByRole('button', { name: 'Undo anyway' });

  fireEvent.click(undoAnyway());
  await waitFor(() => expect(settling()).toHaveTextContent('true'));
  fireEvent.click(undoAnyway());
  await settle();

  expect(fetchMock.callHistory.calls()).toHaveLength(1);
});
