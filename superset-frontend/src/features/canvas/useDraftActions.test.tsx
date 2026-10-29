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
import { useDraftActions } from './useDraftActions';

const commitEndpoint = 'glob:*/api/v1/canvas/draft/commit';
const draftEndpoint = 'glob:*/api/v1/canvas/draft';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

function Harness({
  onClosed,
  onBusyChange,
}: {
  onClosed: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const actions = useDraftActions('tok-123', 4, onClosed, onBusyChange);
  return (
    <>
      <button type="button" onClick={actions.publish}>
        Publish
      </button>
      <button type="button" onClick={actions.discard}>
        Discard
      </button>
      <span>{actions.busy ? 'busy' : 'free'}</span>
    </>
  );
}

const renderHarness = (onBusyChange?: (busy: boolean) => void) => {
  const onClosed = jest.fn();
  render(<Harness onClosed={onClosed} onBusyChange={onBusyChange} />, {
    useRedux: true,
  });
  return onClosed;
};

const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

test('publishing commits the draft at the revision it was given', async () => {
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  const onClosed = renderHarness();

  click('Publish');

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(JSON.parse(call.options.body as string)).toEqual({ revision: 4 });
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');
  await waitFor(() => expect(onClosed).toHaveBeenCalled());
});

test('discarding deletes the draft', async () => {
  fetchMock.delete(draftEndpoint, { result: 'deleted' });
  const onClosed = renderHarness();

  click('Discard');

  // The request itself, not just the close: the draft closes after any
  // resolved action, so asserting only `onClosed` passes even when nothing is
  // sent and the draft survives.
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(call.options.method?.toUpperCase()).toBe('DELETE');
  expect(call.url).toContain('/api/v1/canvas/draft');
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');
  await waitFor(() => expect(onClosed).toHaveBeenCalled());
});

test('busy is reported for the whole commit, so edits can be stopped', async () => {
  // Guards the race: a commit reads a revision then deletes the draft, so a
  // change accepted in between is replayed by nothing and silently lost.
  let finishCommit: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    finishCommit = () =>
      resolve(
        new Response(JSON.stringify({ result: { revision: 5 } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  });
  fetchMock.post(commitEndpoint, () => held);
  const onBusyChange = jest.fn();
  renderHarness(onBusyChange);

  click('Publish');

  // Busy before the request settles, which is the window the race lives in.
  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true));
  expect(onBusyChange).not.toHaveBeenCalledWith(false);
  expect(screen.getByText('busy')).toBeInTheDocument();

  finishCommit();

  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false));
});

test('busy is reported false again when a commit fails', async () => {
  fetchMock.post(commitEndpoint, 409);
  const onBusyChange = jest.fn();
  const onClosed = renderHarness(onBusyChange);

  click('Publish');

  // Otherwise a rejected publish would leave the canvas uneditable.
  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false));
  // And the draft stays open: its changes are still only in the draft.
  expect(onClosed).not.toHaveBeenCalled();
});
