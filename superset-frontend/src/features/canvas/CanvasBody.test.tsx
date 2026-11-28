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

/**
 * The wiring that keeps a layout edit from being lost by a publish, exercised
 * end to end rather than prop by prop: the layout hook's `saving` reaching the
 * banner's Publish button, and the banner's busy state reaching `editable`.
 * Asserting those props in isolation let either side be deleted silently.
 */
import type { ComponentProps } from 'react';
import fetchMock from 'fetch-mock';

import {
  canvas,
  chat,
  registerWidgetRenderer,
  setActiveCanvas,
} from 'src/core';
import ChatProvider from 'src/core/chat/ChatProvider';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import CanvasBody from './CanvasBody';
import { emptyScopeValues } from './CanvasGrid';
import type { CanvasDefinitionResult, GridPlacement } from './types';

const mockToasts = { addDangerToast: jest.fn(), addSuccessToast: jest.fn() };
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: unknown) => Component,
  useToasts: () => mockToasts,
}));

const draftEndpoint = 'glob:*/api/v1/canvas/draft';
const commitEndpoint = 'glob:*/api/v1/canvas/draft/commit';

const KPI: GridPlacement = { col: 1, row: 1, colSpan: 6, rowSpan: 4 };
const TREND: GridPlacement = { col: 1, row: 5, colSpan: 24, rowSpan: 8 };
const WIDTH = 1000;
const COL_PITCH = 632 / 24 + 16;

const result = {
  version: 1,
  revision: 0,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['kpi', 'trend'],
    },
    nodes: {
      kpi: {
        widgetType: 'test.plain',
        schemaVersion: 1,
        props: {},
        layout: {},
      },
      trend: {
        widgetType: 'test.plain',
        schemaVersion: 1,
        props: {},
        layout: {},
      },
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings: {
      refresh: { interval: 0, stagger: 0, exempt: [] },
      colors: { labelColors: {} },
      display: { showTimestamps: false },
      crossFilters: { enabled: true },
    },
  },
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  placements: { kpi: KPI, trend: TREND },
  layouts: { kpi: KPI, trend: TREND },
  childOrder: { root: ['kpi', 'trend'] },
  widgetTypes: { kpi: 'test.plain', trend: 'test.plain' },
  gridColumns: {},
  layoutConstraints: {},
  canEdit: true,
} as unknown as CanvasDefinitionResult;

const registration = registerWidgetRenderer('test.plain', () => (
  <div>widget</div>
));
afterAll(() => registration.dispose());

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => WIDTH,
  });
  HTMLElement.prototype.setPointerCapture = jest.fn();
  HTMLElement.prototype.releasePointerCapture = jest.fn();
});

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  jest.clearAllMocks();
});

// The page clears the active canvas when it unmounts; the body does not.
afterEach(() => setActiveCanvas(undefined));

class TestPointerEvent extends MouseEvent {
  pointerId: number;

  constructor(
    type: string,
    init: MouseEventInit & { pointerId?: number } = {},
  ) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.pointerId = init.pointerId ?? 1;
  }
}

/** A whole drag on the first move handle, from grab to release. */
const dragFirstWidget = (dx: number) => {
  const handle = screen.getAllByRole('button', { name: 'Move widget' })[0];
  [
    new TestPointerEvent('pointerdown', { button: 0, clientX: 0, clientY: 0 }),
    new TestPointerEvent('pointermove', { clientX: dx, clientY: 0 }),
    new TestPointerEvent('pointerup', { clientX: dx, clientY: 0 }),
  ].forEach(event => fireEvent(handle, event));
};

type BodyProps = Partial<ComponentProps<typeof CanvasBody>>;

const bodyWith = (draftToken?: string, props: BodyProps = {}) => (
  <CanvasBody
    canvasId={7}
    result={result}
    reload={jest.fn()}
    values={emptyScopeValues()}
    onValueChange={jest.fn()}
    refreshKeys={{}}
    draftToken={draftToken}
    onDraftOpened={jest.fn()}
    onDraftClosed={jest.fn()}
    isEmpty={false}
    {...props}
  />
);

const renderWith = (draftToken?: string, props: BodyProps = {}) =>
  render(bodyWith(draftToken, props), { useRedux: true });

/** In a plan, which is where editing happens. */
const renderBody = () => renderWith('tok-123');
/** On the published canvas, with no plan open. */
const renderPublished = () => renderWith(undefined);

const publishButton = () => screen.getByRole('button', { name: 'Save' });

test('Publish waits for queued layout writes, then commits the acknowledged revision', async () => {
  // The first draft write is held open so a second drop queues behind it.
  let releaseFirst: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    releaseFirst = () =>
      resolve(
        new Response(
          JSON.stringify({
            result: {
              revision: 1,
              ops: [],
              placements: { kpi: KPI, trend: TREND },
            },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        ),
      );
  });
  fetchMock
    .patch(draftEndpoint, () => held, { repeat: 1 })
    .patch(draftEndpoint, {
      result: { revision: 2, ops: [], placements: { kpi: KPI, trend: TREND } },
    })
    .post(commitEndpoint, { result: { revision: 1 } });

  renderBody();
  expect(publishButton()).toBeEnabled();

  dragFirstWidget(COL_PITCH * 4);
  // Queued behind the in-flight write.
  dragFirstWidget(COL_PITCH * 8);

  // Publishing now would name revision 0 and delete the draft, losing both.
  await waitFor(() => expect(publishButton()).toBeDisabled());

  releaseFirst();

  // Enabled only once the queued follow-up has been acknowledged too.
  await waitFor(() => expect(publishButton()).toBeEnabled());

  fireEvent.click(publishButton());

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(commitEndpoint)).toHaveLength(1),
  );
  const [commit] = fetchMock.callHistory.calls(commitEndpoint);
  // Revision 2: what the last acknowledged write produced, not the fetched 0.
  expect(JSON.parse(commit.options.body as string)).toEqual({ revision: 2 });
});

test('the handles go away while a commit is pending', async () => {
  let finishCommit: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    finishCommit = () =>
      resolve(
        new Response(JSON.stringify({ result: { revision: 1 } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  });
  fetchMock.post(commitEndpoint, () => held);

  renderBody();
  expect(screen.getAllByRole('button', { name: 'Move widget' })).toHaveLength(
    2,
  );

  fireEvent.click(publishButton());

  // A drop accepted after the commit read its revision would be replayed by
  // nothing, so editing stops for as long as the commit is in flight.
  await waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Move widget' }),
    ).not.toBeInTheDocument(),
  );

  finishCommit();
});

test('a failed commit gives the handles back', async () => {
  fetchMock.post(commitEndpoint, 409);

  renderBody();
  fireEvent.click(publishButton());

  // Otherwise a rejected publish would leave the canvas uneditable.
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Move widget' })).toHaveLength(
      2,
    ),
  );
});

test('the published canvas has no handles, even for someone who may edit', () => {
  // `canEdit` is true here: permission alone must not make the canvas
  // editable, since changes are made in a plan. With no draft token there is
  // no banner either.
  renderPublished();

  expect(
    screen.queryByRole('button', { name: 'Move widget' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /^Resize widget from/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save' }),
  ).not.toBeInTheDocument();
  // The widgets themselves still render.
  expect(screen.getAllByText('widget')).toHaveLength(2);
});

test('a draft that ended elsewhere stops editing and offers the published canvas', () => {
  const onDraftClosed = jest.fn();
  renderWith('tok-123', { draftGone: true, onDraftClosed });

  expect(
    screen.queryByRole('button', { name: 'Move widget' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Show the published canvas' }),
  );
  expect(onDraftClosed).toHaveBeenCalled();
});

test('a layout write that does not land says so where the user is looking', async () => {
  // Not in a notice above the canvas: on anything taller than the window that
  // is off-screen, and the drag just snaps back for no stated reason.
  fetchMock.patch(draftEndpoint, 422);

  renderBody();
  dragFirstWidget(COL_PITCH * 4);

  await waitFor(() => expect(mockToasts.addDangerToast).toHaveBeenCalled());
});

/** The widget's own press surface, which is what carries the selection. */
const widgetBody = (nodeId: string) =>
  document.querySelector(
    `[data-node-id="${nodeId}"] .canvas-interactive`,
  ) as HTMLElement;

test('the canvas is what holds the selection, and a publish lets it go', async () => {
  // The grid draws the selection but does not own it: it is a fact about one
  // person looking at one screen, so it is held out here beside the canvas.
  // Without this nothing notices if the two are never connected.
  let finishCommit: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    finishCommit = () =>
      resolve(
        new Response(JSON.stringify({ result: { revision: 1 } }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
  });
  fetchMock.post(commitEndpoint, () => held);

  renderBody();

  fireEvent.click(widgetBody('kpi'));

  expect(widgetBody('kpi')).toHaveAttribute('aria-pressed', 'true');

  // Publishing stops the editing, so there is nothing left to be working on.
  fireEvent.click(publishButton());

  await waitFor(() =>
    expect(
      document.querySelector('[data-test="canvas-selected"]'),
    ).not.toBeInTheDocument(),
  );

  finishCommit();
});

test('the published canvas has nothing to select', () => {
  // Permission alone does not make it selectable: changes are made in a plan,
  // and an outline on a read-only canvas would mean nothing.
  renderPublished();

  fireEvent.click(widgetBody('kpi'));

  expect(widgetBody('kpi')).not.toHaveAttribute('aria-pressed');
});

const TITLE = 'Exec overview';
const DRAFT = 'tok-123';

type Active = NonNullable<BodyProps['active']>;

/** What the page knows: the canvas' title, and whether the draft is loaded. */
const active = (
  draftLoaded: boolean,
  revision = 0,
  more: Partial<Active> = {},
): Active => ({
  title: TITLE,
  revision,
  draftLoaded,
  draftRefreshFailed: false,
  ...more,
});

/** Every value extensions are told about, in order. */
const recordActiveCanvas = () => {
  const seen: unknown[] = [];
  const subscription = canvas.onDidChangeActiveCanvas((value: unknown) =>
    seen.push(value),
  );
  return { seen, stop: () => subscription.dispose() };
};

/** No draft named, though the draft's definition may be on screen. */
const noDraft = (revision = 0) => ({ id: 7, title: TITLE, revision });

/** The draft settled, at the revision the user sees. */
const shownDraft = (revision: number, draftRevision = revision) => ({
  ...noDraft(revision),
  draft: { token: DRAFT, pending: false, revision: draftRevision },
});

/** The draft named, but changing: no revision to publish yet. */
const pendingDraft = (revision = 0) => ({
  ...noDraft(revision),
  draft: { token: DRAFT, pending: true },
});

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

test('the open draft is exposed only once its own definition is on screen', () => {
  // Until then the page still shows what it showed before the draft opened,
  // and a draft named next to that would be one the user never saw.
  const { rerender } = renderWith(DRAFT, { active: active(false) });

  expect(canvas.getActiveCanvas()).toStrictEqual(noDraft());

  rerender(bodyWith(DRAFT, { active: active(true) }));

  expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(0));
});

test('a layout write keeps the draft named but pending until the revision it reaches is known', async () => {
  // The first write is held so a second drop queues behind it: the draft is
  // on its way to revision 2, and naming 0 or 1 meanwhile would have a
  // publish rejected, or publish less than the user sees.
  let releaseFirst: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    releaseFirst = () =>
      resolve(
        jsonResponse({
          result: {
            revision: 1,
            ops: [],
            placements: { kpi: KPI, trend: TREND },
          },
        }),
      );
  });
  fetchMock
    .patch(draftEndpoint, () => held, { repeat: 1 })
    .patch(draftEndpoint, {
      result: { revision: 2, ops: [], placements: { kpi: KPI, trend: TREND } },
    });

  renderWith(DRAFT, { active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  dragFirstWidget(COL_PITCH * 4);
  dragFirstWidget(COL_PITCH * 8);

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft()),
  );

  releaseFirst();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(0, 2)),
  );
  // Nothing in between: not the revision the drag started from, nor the one
  // the first write reached while the second was still queued. The token
  // stays throughout.
  expect(seen).toStrictEqual([pendingDraft(), shownDraft(0, 2)]);
  stop();
});

test('the draft is pending while a commit is, and settled again if it fails', async () => {
  let failCommit: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    failCommit = () => resolve(jsonResponse({ message: 'Conflict' }, 409));
  });
  fetchMock.post(commitEndpoint, () => held);

  renderWith(DRAFT, { active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  fireEvent.click(publishButton());

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft()),
  );

  failCommit();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(0)),
  );
  expect(seen).toStrictEqual([pendingDraft(), shownDraft(0)]);
  stop();
});

test('a refetch that moves the draft on tells extensions once', () => {
  const { rerender } = renderWith(DRAFT, { active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  rerender(
    bodyWith(DRAFT, {
      result: { ...result, revision: 3 },
      active: active(true, 3),
    }),
  );

  expect(seen).toStrictEqual([shownDraft(3)]);
  stop();
});

test('an undo keeps the draft pending until the canvas has caught up with it', async () => {
  // The step moves the draft on at the server, then the canvas is refetched:
  // until that lands, the screen still shows the revision before the step.
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', {
    result: { revision: 1, canUndo: false, canRedo: true },
  });
  const reload = jest.fn();
  const undoable = { ...result, canUndo: true };
  const { rerender } = renderWith(DRAFT, {
    result: undoable,
    reload,
    active: active(true),
  });
  const { seen, stop } = recordActiveCanvas();

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

  await waitFor(() => expect(reload).toHaveBeenCalled());
  // The step has answered and offers a redo, but none is offered until the
  // refetch lands: it would name the revision the undo started from.
  expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
  expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft());

  rerender(
    bodyWith(DRAFT, {
      result: { ...undoable, revision: 1, canUndo: false, canRedo: true },
      reload,
      active: active(true, 1),
    }),
  );

  expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(1));
  expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled();
  expect(seen).toStrictEqual([pendingDraft(), shownDraft(1)]);
  stop();
});

test('a step not yet on screen holds Save and the next step, but not Discard', async () => {
  // Until the refetch lands, the revision on screen is the one the undo
  // started from, and a publish naming it would be rejected.
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', {
    result: { revision: 1, canUndo: true, canRedo: true },
  });
  fetchMock.post(commitEndpoint, { result: { revision: 1 } });
  const reload = jest.fn();
  const undoable = { ...result, canUndo: true };
  const { rerender } = renderWith(DRAFT, {
    result: undoable,
    reload,
    active: active(true),
  });
  const undoButton = () => screen.getByRole('button', { name: 'Undo' });
  expect(publishButton()).toBeEnabled();

  fireEvent.click(undoButton());
  await waitFor(() => expect(reload).toHaveBeenCalled());

  expect(publishButton()).toBeDisabled();
  expect(undoButton()).toBeDisabled();
  // Discarding names no revision, so it stays a way out of the draft even
  // if the refetch never lands.
  expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled();
  fireEvent.click(publishButton());
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft()),
  );
  expect(fetchMock.callHistory.calls(commitEndpoint)).toHaveLength(0);

  rerender(
    bodyWith(DRAFT, {
      result: { ...undoable, revision: 1, canRedo: true },
      reload,
      active: active(true, 1),
    }),
  );

  expect(publishButton()).toBeEnabled();
  expect(undoButton()).toBeEnabled();
  expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(1));
});

test('an undo whose refetch never lands can still be discarded', async () => {
  // Nothing retries the refetch until the window regains focus, so the step
  // may never reach the screen.
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', {
    result: { revision: 1, canUndo: true, canRedo: true },
  });
  fetchMock.delete(draftEndpoint, { result: {} });
  const reload = jest.fn();
  const onDraftClosed = jest.fn();
  renderWith(DRAFT, {
    result: { ...result, canUndo: true },
    reload,
    onDraftClosed,
    active: active(true),
  });

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(reload).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  await waitFor(() => expect(onDraftClosed).toHaveBeenCalled());
  expect(
    fetchMock.callHistory
      .calls(draftEndpoint)
      .filter(({ options }) => options.method?.toUpperCase() === 'DELETE'),
  ).toHaveLength(1);
});

test('a version preview is exposed, and no draft beside it', () => {
  renderWith(DRAFT, {
    versionUuid: 'v-1',
    active: active(true, 0, { previewedVersion: { uuid: 'v-1', number: 1 } }),
  });

  expect(canvas.getActiveCanvas()).toStrictEqual({
    ...noDraft(),
    previewedVersion: { uuid: 'v-1', number: 1 },
  });
});

test('a version on screen names no draft, even with the version unnamed', () => {
  // The body knows a version is rendered from its key alone; the draft's
  // definition is not what the user is looking at.
  renderWith(DRAFT, { versionUuid: 'v-1', active: active(true) });

  expect(canvas.getActiveCanvas()).toStrictEqual(noDraft());
});

test('without what the page knows, the body tells extensions nothing', () => {
  renderWith(DRAFT);

  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('a rejected layout write settles the draft again at the revision it had', async () => {
  // A 409 means the draft moved on elsewhere: the canvas is refetched, and
  // until that lands the revision on screen is still the last one fetched.
  fetchMock.patch(draftEndpoint, 409);
  // Reports when it is done, as the definition hook's reload does: the
  // reverted gesture is then retried, conflicts again, and is given up.
  const reload = jest.fn(() => Promise.resolve());
  renderWith(DRAFT, { reload, active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  dragFirstWidget(COL_PITCH * 4);

  await waitFor(() => expect(reload).toHaveBeenCalled());
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(0)),
  );
  expect(seen).toStrictEqual([pendingDraft(), shownDraft(0)]);
  stop();
});

test('the draft is pending while an undo is in flight', async () => {
  let answer: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    answer = () =>
      resolve(
        jsonResponse({
          result: { revision: 1, canUndo: false, canRedo: true },
        }),
      );
  });
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', () => held);
  const reload = jest.fn();
  renderWith(DRAFT, {
    result: { ...result, canUndo: true },
    reload,
    active: active(true),
  });

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft()),
  );
  expect(reload).not.toHaveBeenCalled();

  answer();
  await waitFor(() => expect(reload).toHaveBeenCalled());
});

test('the draft is pending while a discard is, and settled again if it fails', async () => {
  let failDiscard: () => void = () => {};
  const held = new Promise<Response>(resolve => {
    failDiscard = () => resolve(jsonResponse({ message: 'Gone wrong' }, 500));
  });
  fetchMock.delete(draftEndpoint, () => held);

  renderWith(DRAFT, { active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft()),
  );

  failDiscard();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(shownDraft(0)),
  );
  expect(seen).toStrictEqual([pendingDraft(), shownDraft(0)]);
  stop();
});

test('a failed refresh keeps the draft pending until one succeeds', () => {
  // The definition on screen may no longer be the draft's latest.
  const { rerender } = renderWith(DRAFT, { active: active(true) });
  const { seen, stop } = recordActiveCanvas();

  rerender(
    bodyWith(DRAFT, { active: active(true, 0, { draftRefreshFailed: true }) }),
  );
  expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft());

  rerender(bodyWith(DRAFT, { active: active(true) }));

  expect(seen).toStrictEqual([pendingDraft(), shownDraft(0)]);
  stop();
});

test('what extensions are told is frozen, the draft and version included', () => {
  const { rerender } = renderWith(DRAFT, { active: active(true) });
  const withDraft = canvas.getActiveCanvas();

  expect(withDraft).toStrictEqual(shownDraft(0));
  expect(Object.isFrozen(withDraft)).toBe(true);
  expect(Object.isFrozen(withDraft?.draft)).toBe(true);

  rerender(
    bodyWith(DRAFT, { active: active(true, 0, { draftRefreshFailed: true }) }),
  );
  expect(canvas.getActiveCanvas()).toStrictEqual(pendingDraft());
  expect(Object.isFrozen(canvas.getActiveCanvas()?.draft)).toBe(true);

  rerender(
    bodyWith(DRAFT, {
      versionUuid: 'v-1',
      active: active(true, 0, { previewedVersion: { uuid: 'v-1', number: 1 } }),
    }),
  );
  const previewing = canvas.getActiveCanvas();
  expect(previewing?.previewedVersion).toStrictEqual({
    uuid: 'v-1',
    number: 1,
  });
  expect(Object.isFrozen(previewing)).toBe(true);
  expect(Object.isFrozen(previewing?.previewedVersion)).toBe(true);
});

test('an empty canvas says what to do, without a button when there is no chat', () => {
  renderWith(undefined, { isEmpty: true });

  expect(screen.getByText('Your canvas is empty')).toBeInTheDocument();
  expect(
    screen.getByText('Tell the AI assistant what you want to see.'),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Open AI assistant' }),
  ).not.toBeInTheDocument();
});

test('an empty canvas opens the registered chat from its button', () => {
  ChatProvider.getInstance().reset();
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => null,
    () => null,
  );
  renderWith(undefined, { isEmpty: true });

  fireEvent.click(screen.getByRole('button', { name: 'Open AI assistant' }));

  expect(chat.isOpen()).toBe(true);
  ChatProvider.getInstance().reset();
});
