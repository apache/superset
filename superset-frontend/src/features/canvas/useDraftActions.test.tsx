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
import type { canvas as canvasApi } from '@apache-superset/core';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { canvas } from 'src/core';
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

const WIDGETS: canvasApi.CanvasDraftWidget[] = [
  { nodeId: 'notes', widgetId: 'w-1', widgetType: 'acme.notes' },
];

/** A draft of canvas 7, whose participants may publish something with it. */
function PlacedHarness({ onClosed }: { onClosed: () => void }) {
  const actions = useDraftActions(
    'tok-123',
    4,
    onClosed,
    undefined,
    7,
    WIDGETS,
  );
  return (
    <>
      <button type="button" onClick={actions.publish}>
        Publish
      </button>
      <button type="button" onClick={actions.discard}>
        Discard
      </button>
      <span>{actions.busy ? 'busy' : 'free'}</span>
      {actions.review?.parts.map(part => (
        <p key={part.title}>{part.title}</p>
      ))}
      {actions.review && (
        <>
          <button type="button" onClick={actions.review.confirm}>
            Confirm
          </button>
          <button type="button" onClick={actions.review.cancel}>
            Cancel
          </button>
        </>
      )}
    </>
  );
}

test.each([
  [
    'Publish',
    'committed',
    () => fetchMock.post(commitEndpoint, { result: {} }),
  ],
  [
    'Discard',
    'discarded',
    () => fetchMock.delete(draftEndpoint, { result: {} }),
  ],
])(
  'what the page did to its draft is told to its listeners: %s',
  async (button, kind, respond) => {
    respond();
    const events = jest.fn();
    const listening = canvas.onDidChangeDraft(events);
    const onClosed = jest.fn();
    render(<PlacedHarness onClosed={onClosed} />, { useRedux: true });

    click(button);

    await waitFor(() => expect(onClosed).toHaveBeenCalled());
    expect(events).toHaveBeenCalledWith({
      kind,
      canvasId: 7,
      token: 'tok-123',
      steppedWidgetIds: [],
    });
    listening.dispose();
  },
);

test('a draft that stays open tells its listeners nothing', async () => {
  fetchMock.post(commitEndpoint, 409);
  const events = jest.fn();
  const listening = canvas.onDidChangeDraft(events);
  render(<PlacedHarness onClosed={jest.fn()} />, { useRedux: true });

  click('Publish');

  await waitFor(() => expect(fetchMock.callHistory.calls()).toHaveLength(1));
  expect(events).not.toHaveBeenCalled();
  listening.dispose();
});

/** Registers a participant that publishes `publish` with any draft placing w-1. */
const participate = (publish: () => Promise<void>) => {
  const prepare = jest.fn(async ({ widgets }: canvasApi.CanvasDraftPublish) =>
    widgets.some(widget => widget.widgetId === 'w-1')
      ? [{ title: 'Notes', lines: ['Notes go public'], publish }]
      : [],
  );
  return {
    prepare,
    registration: canvas.registerPublishParticipant({ prepare }),
  };
};

const renderPlaced = () => {
  const onClosed = jest.fn();
  render(<PlacedHarness onClosed={onClosed} />, { useRedux: true });
  return onClosed;
};

const commits = () => fetchMock.callHistory.calls(commitEndpoint);

test('a draft that nothing is published with commits at once, as before', async () => {
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  const { prepare, registration } = participate(jest.fn());
  const onClosed = renderPlaced();

  // A draft that no longer places what the participant publishes.
  prepare.mockResolvedValueOnce([]);
  click('Publish');

  await waitFor(() => expect(onClosed).toHaveBeenCalled());
  expect(prepare).toHaveBeenCalledWith({
    canvasId: 7,
    token: 'tok-123',
    widgets: WIDGETS,
  });
  expect(fetchMock.callHistory.calls()).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  registration.dispose();
});

test('what is published with the draft goes first, once the person confirms', async () => {
  const order: string[] = [];
  fetchMock.get(draftEndpoint, {
    result: { revision: 4, canvasChanged: false },
  });
  fetchMock.post(commitEndpoint, () => {
    order.push('canvas');
    return { result: { revision: 5 } };
  });
  const publish = jest.fn(async () => {
    order.push('notes');
  });
  const { registration } = participate(publish);
  const events = jest.fn();
  const listening = canvas.onDidChangeDraft(events);
  const onClosed = renderPlaced();

  click('Publish');

  // Listed, and nothing published until the person confirms.
  expect(await screen.findByText('Notes')).toBeInTheDocument();
  expect(publish).not.toHaveBeenCalled();
  expect(commits()).toHaveLength(0);

  click('Confirm');

  await waitFor(() => expect(onClosed).toHaveBeenCalled());
  expect(order).toEqual(['notes', 'canvas']);
  expect(JSON.parse(commits()[0].options.body as string)).toEqual({
    revision: 4,
  });
  expect(events).toHaveBeenCalledWith({
    kind: 'committed',
    canvasId: 7,
    token: 'tok-123',
    steppedWidgetIds: [],
  });
  listening.dispose();
  registration.dispose();
});

test('a part that fails stops the publish, and the canvas stays a draft', async () => {
  fetchMock.get(draftEndpoint, {
    result: { revision: 4, canvasChanged: false },
  });
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  const { registration } = participate(() =>
    Promise.reject(new Error('The notes failed their check')),
  );
  const onClosed = renderPlaced();

  click('Publish');
  await screen.findByRole('button', { name: 'Confirm' });
  click('Confirm');

  await waitFor(() => expect(screen.queryByText('Notes')).toBeNull());
  expect(commits()).toHaveLength(0);
  expect(onClosed).not.toHaveBeenCalled();
  registration.dispose();
});

test.each([
  [
    { revision: 5, canvasChanged: false },
    'a draft that moved since its review',
  ],
  [
    { revision: 4, canvasChanged: true },
    'a canvas published since the draft began',
  ],
])('nothing is published for %j: %s', async current => {
  fetchMock.get(draftEndpoint, { result: current });
  fetchMock.post(commitEndpoint, { result: { revision: 5 } });
  const publish = jest.fn(() => Promise.resolve());
  const { registration } = participate(publish);
  const onClosed = renderPlaced();

  click('Publish');
  await screen.findByRole('button', { name: 'Confirm' });
  click('Confirm');

  await waitFor(() => expect(screen.queryByText('Notes')).toBeNull());
  expect(publish).not.toHaveBeenCalled();
  expect(commits()).toHaveLength(0);
  expect(onClosed).not.toHaveBeenCalled();
  registration.dispose();
});

test('cancelling the review publishes nothing', async () => {
  const publish = jest.fn(() => Promise.resolve());
  const { registration } = participate(publish);
  const onClosed = renderPlaced();

  click('Publish');
  await screen.findByRole('button', { name: 'Cancel' });
  click('Cancel');

  await waitFor(() => expect(screen.queryByText('Notes')).toBeNull());
  expect(publish).not.toHaveBeenCalled();
  expect(fetchMock.callHistory.calls()).toHaveLength(0);
  expect(onClosed).not.toHaveBeenCalled();
  registration.dispose();
});

test('a participant that fails stops the publish before anything is published', async () => {
  const prepare = jest.fn(() =>
    Promise.reject(new Error('Notes are unreachable')),
  );
  const registration = canvas.registerPublishParticipant({ prepare });
  const onClosed = renderPlaced();

  click('Publish');

  await waitFor(() => expect(prepare).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText('free')).toBeInTheDocument());
  expect(fetchMock.callHistory.calls()).toHaveLength(0);
  expect(onClosed).not.toHaveBeenCalled();
  registration.dispose();
});
