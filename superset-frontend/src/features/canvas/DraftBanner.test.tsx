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
import DraftBanner from './DraftBanner';

const commitEndpoint = 'glob:*/api/v1/canvas/draft/commit';
const draftEndpoint = 'glob:*/api/v1/canvas/draft';

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

const renderBanner = (saving = false, onClose = jest.fn()) => {
  render(
    <DraftBanner
      token="tok-123"
      revision={4}
      onClose={onClose}
      saving={saving}
    />,
    { useRedux: true },
  );
  return onClose;
};

const publishButton = () => screen.getByRole('button', { name: /Publish/ });

test('publishing commits the draft at the revision it was given', async () => {
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  const onClose = renderBanner();

  fireEvent.click(publishButton());

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(JSON.parse(call.options.body as string)).toEqual({ revision: 4 });
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('publishing is held while a layout change is still saving', () => {
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  renderBanner(true);

  expect(publishButton()).toBeDisabled();

  fireEvent.click(publishButton());

  // Committing now would publish the revision before that change landed and
  // then delete the draft, losing it.
  expect(fetchMock.callHistory.calls()).toHaveLength(0);
});

test('discarding deletes the draft', async () => {
  fetchMock.delete(draftEndpoint, { result: 'deleted' });
  const onClose = renderBanner();

  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  // The request itself, not just the close: the banner closes after any
  // resolved action, so asserting only `onClose` passes even when nothing is
  // sent and the draft survives.
  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  const [call] = fetchMock.callHistory.calls();
  expect(call.options.method?.toUpperCase()).toBe('DELETE');
  expect(call.url).toContain('/api/v1/canvas/draft');
  expect(
    (call.options.headers as Record<string, string>)['x-canvas-draft'],
  ).toBe('tok-123');
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

test('the banner reports busy for the whole commit, so edits can be stopped', async () => {
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
  render(
    <DraftBanner
      token="tok-123"
      revision={4}
      onClose={jest.fn()}
      onBusyChange={onBusyChange}
    />,
    { useRedux: true },
  );

  fireEvent.click(publishButton());

  // Busy before the request settles, which is the window the race lives in.
  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true));
  expect(onBusyChange).not.toHaveBeenCalledWith(false);

  finishCommit();

  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false));
});

test('busy is reported false again when a commit fails', async () => {
  fetchMock.post(commitEndpoint, 409);
  const onBusyChange = jest.fn();
  render(
    <DraftBanner
      token="tok-123"
      revision={4}
      onClose={jest.fn()}
      onBusyChange={onBusyChange}
    />,
    { useRedux: true },
  );

  fireEvent.click(publishButton());

  // Otherwise a rejected publish would leave the canvas uneditable.
  await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(false));
});

test('discarding is held while a layout change is still saving', () => {
  // A discard landing between a save's read and its write-back would delete
  // the draft and then have it recreated by that save, so the token still
  // opens changes the user was told were discarded.
  fetchMock.delete(draftEndpoint, { result: 'deleted' });
  renderBanner(true);

  const discard = screen.getByRole('button', { name: 'Discard' });
  expect(discard).toBeDisabled();

  fireEvent.click(discard);

  expect(fetchMock.callHistory.calls()).toHaveLength(0);
});
