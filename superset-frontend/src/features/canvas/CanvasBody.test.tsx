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
import fetchMock from 'fetch-mock';
import { canvas } from 'src/core';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import CanvasBody from './CanvasBody';
import { emptyScopeValues } from './CanvasGrid';
import type { CanvasDefinitionResult, GridPlacement } from './types';

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
  widgetTypes: { kpi: 'test.plain', trend: 'test.plain' },
  gridColumns: {},
  layoutConstraints: {},
  canEdit: true,
} as unknown as CanvasDefinitionResult;

const registration = canvas.registerWidgetRenderer('test.plain', () => (
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
});

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

const renderWith = (draftToken?: string) =>
  render(
    <CanvasBody
      canvasId={7}
      result={result}
      reload={jest.fn()}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      refreshKeys={{}}
      draftToken={draftToken}
      onDraftClosed={jest.fn()}
      isEmpty={false}
    />,
    { useRedux: true },
  );

/** In a plan, which is where editing happens. */
const renderBody = () => renderWith('tok-123');
/** On the published canvas, with no plan open. */
const renderPublished = () => renderWith(undefined);

const publishButton = () => screen.getByRole('button', { name: /Publish/ });

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
    screen.queryByRole('button', { name: 'Resize widget' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Publish/ }),
  ).not.toBeInTheDocument();
  // The widgets themselves still render.
  expect(screen.getAllByText('widget')).toHaveLength(2);
});
