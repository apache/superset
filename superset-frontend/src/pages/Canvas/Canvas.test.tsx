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
import { act, useContext, useEffect } from 'react';
import fetchMock from 'fetch-mock';
import type { canvas as canvasApi } from '@apache-superset/core';
import { FeatureFlag, SupersetClient } from '@superset-ui/core';
import type { CanvasDefinitionResult } from 'src/features/canvas/types';
import {
  CanvasVersionContext,
  useWidgetRows,
} from 'src/features/canvas/useWidgetRows';
import * as versionHistory from 'src/features/canvas/versionHistory/useCanvasVersionHistory';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import { canvas } from 'src/core';
import { subscribeRealtime } from 'src/middleware/realtime';
import CanvasPage from '.';

let mockIdOrSlug = '7';
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ idOrSlug: mockIdOrSlug }),
}));
jest.mock('src/middleware/realtime', () => ({
  connectRealtime: jest.fn(),
  subscribeRealtime: jest.fn(() => jest.fn()),
  subscribeRealtimeOpen: jest.fn(() => jest.fn()),
  subscribeRealtimeState: jest.fn(() => jest.fn()),
}));

const metadataEndpoint = 'glob:*/api/v1/canvas/7';
const definitionEndpoint = 'glob:*/api/v1/canvas/7/definition';

const definition = (children: string[], revision = 1, canEdit = false) => ({
  result: {
    version: 1,
    revision,
    canEdit,
    definition: {
      version: 1,
      root: { layout: { columns: 24, gap: 16, rowUnit: 40 }, children },
      nodes: Object.fromEntries(
        children.map(nodeId => [
          nodeId,
          { widgetId: `w-${nodeId}`, layout: {} },
        ]),
      ),
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
    eventScopes: {},
    placements: {},
    layouts: {},
    childOrder: { root: children },
    widgetTypes: {},
    gridColumns: {},
    layoutConstraints: {},
  },
});

beforeEach(() => {
  window.history.replaceState({}, '', window.location.pathname);
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  fetchMock.get(metadataEndpoint, {
    result: { id: 7, title: 'Exec overview', description: 'KPIs and trend' },
  });
});

test('shows the canvas title and an empty state', async () => {
  fetchMock.get(definitionEndpoint, definition([]));

  render(<CanvasPage />, { useRedux: true, useRouter: true });

  expect(await screen.findByText('Exec overview')).toBeInTheDocument();
  expect(screen.getByText('KPIs and trend')).toBeInTheDocument();
  expect(screen.getByText('This canvas is empty')).toBeInTheDocument();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual({
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
  // fetch-mock removes routes by name, not by matcher.
  fetchMock.get(definitionEndpoint, definition([]), {
    name: definitionEndpoint,
  });

  render(<CanvasPage />, { useRedux: true, useRouter: true });
  expect(await screen.findByText('This canvas is empty')).toBeInTheDocument();

  fetchMock.removeRoute(definitionEndpoint);
  fetchMock.get(definitionEndpoint, definition(['a'], 2), {
    name: definitionEndpoint,
  });
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

  render(<CanvasPage />, { useRedux: true, useRouter: true });

  expect(
    await screen.findByText(
      'This canvas does not exist, or you do not have access to it',
    ),
  ).toBeInTheDocument();
});

test('the edit button opens the draft on this canvas', async () => {
  // The page is what connects the button to the draft: without
  // `onDraftOpened` wired to `draft.open`, it would create a draft the page
  // never shows, and nothing else here would notice.
  fetchMock.get(definitionEndpoint, definition([], 1, true));
  fetchMock.post('glob:*/api/v1/canvas/7/draft', {
    result: { token: 'tok-123', revision: 0 },
  });
  // Opening a draft refetches the definition from the draft's own route.
  fetchMock.get('glob:*/api/v1/canvas/draft', definition([], 0, true));

  render(<CanvasPage />, { useRedux: true, useRouter: true });

  const edit = await screen.findByRole('button', { name: 'Edit canvas' });
  // On the title row: the body owns the toolbar, but the page says where it
  // goes, and a toolbar on a row of its own was not the design.
  expect(screen.getByRole('banner')).toContainElement(edit);

  fireEvent.click(edit);

  // The draft banner only renders once the page is showing a draft.
  expect(
    await screen.findByText('Draft. Only you can see these changes.'),
  ).toBeInTheDocument();

  const [draftCall] = fetchMock.callHistory
    .calls()
    .filter(call => call.url.includes('/draft'));
  expect(draftCall.options.method?.toUpperCase()).toBe('POST');
  // And the draft the page opened is the one the request returned.
  await waitFor(() => expect(window.location.hash).toBe('#draft=tok-123'));
});

function filteredDefinition(): CanvasDefinitionResult {
  return {
    ...definition(['filter', 'chart']).result,
    definition: {
      ...definition(['filter', 'chart']).result.definition,
      nodes: {
        filter: {
          widgetType: 'filter.select',
          schemaVersion: 1,
          props: {
            datasetId: 13,
            column: 'region',
            options: ['north'],
            defaultSelection: ['north'],
          },
          layout: {},
        },
        chart: {
          widgetType: 'test.version-chart',
          schemaVersion: 1,
          props: { dataBinding: { datasetId: 13, metrics: ['count'] } },
          layout: {},
        },
      },
    },
    filterScopes: { filter: ['chart'] },
    placements: {
      filter: { col: 1, row: 1, colSpan: 24, rowSpan: 2 },
      chart: { col: 1, row: 3, colSpan: 24, rowSpan: 2 },
    },
    layouts: { filter: {}, chart: {} },
    widgetTypes: { filter: 'filter.select', chart: 'test.version-chart' },
  };
}

test('scopes filter values to the actual version-keyed CanvasBody remount', async () => {
  // Only the history fetch is controlled. The page, body, grid, select filter,
  // and widget query hook all follow their production mount path.
  const current = filteredDefinition();
  const preview: CanvasDefinitionResult = {
    ...current,
    definition: {
      ...current.definition,
      nodes: {
        ...current.definition.nodes,
        filter: {
          widgetType: 'filter.select',
          schemaVersion: 1,
          props: { datasetId: 13, column: 'region', options: ['north'] },
          layout: {},
        },
      },
    },
  };
  const history: versionHistory.CanvasVersionHistory = {
    reload: jest.fn(),
    showVersion: jest.fn(),
    showCurrent: jest.fn(),
    restore: jest.fn(),
  };
  const historySpy = jest
    .spyOn(versionHistory, 'useCanvasVersionHistory')
    .mockImplementation(() => history);
  const mounts: (string | undefined)[] = [];
  const dispose = canvas.registerWidgetRenderer(
    'test.version-chart',
    function Chart(widget: canvasApi.CanvasWidgetProps) {
      const version = useContext(CanvasVersionContext);
      useEffect(() => {
        mounts.push(version);
      }, []);
      const rows = useWidgetRows(widget, widget.filters, widget.refreshKey);
      return (
        <output data-test="version-chart">
          {JSON.stringify({ filters: widget.filters, loading: rows.loading })}
        </output>
      );
    },
  );
  const post = jest.spyOn(SupersetClient, 'post');
  fetchMock.get(definitionEndpoint, { result: current });
  fetchMock.post('glob:*/api/v1/canvas/7/placement/chart/data', {
    result: { datasets: [{ inline_data: [] }] },
  });
  const { rerender, unmount } = render(<CanvasPage />, {
    useRedux: true,
    useRouter: true,
  });
  await waitFor(() =>
    expect(screen.getByTestId('version-chart')).toHaveTextContent('north'),
  );
  await waitFor(() =>
    expect(screen.getByTestId('version-chart')).toHaveTextContent(
      '"loading":false',
    ),
  );
  post.mockClear();
  history.preview = {
    title: 'Earlier version',
    rendered: preview,
    _version: {
      version_uuid: 'saved-version',
      version_number: 1,
      transaction_id: 1,
      operation_type: 'update',
      issued_at: '2026-01-01T00:00:00Z',
      changed_by: null,
      changes: [],
    },
  };
  rerender(<CanvasPage />);
  await waitFor(() => expect(post).toHaveBeenCalled());
  expect(screen.getByTestId('version-chart')).not.toHaveTextContent('north');
  // This includes the first request, before filter mount effects can repair
  // parent state. No invisible current-version selection reaches the query.
  post.mock.calls.forEach(([request]) => {
    expect(request.jsonPayload).toEqual({ runtime_filters: [] });
  });
  await waitFor(() =>
    expect(screen.getByTestId('version-chart')).toHaveTextContent(
      '"loading":false',
    ),
  );
  expect(screen.getByText('All')).toBeInTheDocument();
  history.preview = undefined;
  post.mockClear();
  rerender(<CanvasPage />);
  await waitFor(() =>
    expect(screen.getByTestId('version-chart')).toHaveTextContent('north'),
  );
  expect(mounts).toEqual([undefined, 'saved-version', undefined]);
  expect(post.mock.calls[0][0].jsonPayload).toEqual({ runtime_filters: [] });
  unmount();
  dispose.dispose();
  historySpy.mockRestore();
  post.mockRestore();
});

test.each(['Save', 'Discard'])(
  'keeps filter selections through Edit and %s on the page',
  async action => {
    const current = { ...filteredDefinition(), canEdit: true };
    let mounts = 0;
    const dispose = canvas.registerWidgetRenderer(
      'test.version-chart',
      function Chart(widget: canvasApi.CanvasWidgetProps) {
        useEffect(() => {
          mounts += 1;
        }, []);
        const rows = useWidgetRows(widget, widget.filters, widget.refreshKey);
        return (
          <output data-test="draft-chart">
            {JSON.stringify({ filters: widget.filters, loading: rows.loading })}
          </output>
        );
      },
    );
    fetchMock.get(definitionEndpoint, { result: current });
    fetchMock.post('glob:*/api/v1/canvas/7/draft', {
      result: { token: 'same-binding-draft', revision: 0 },
    });
    fetchMock.get('glob:*/api/v1/canvas/draft', {
      result: { ...current, revision: 2, canUndo: true },
    });
    fetchMock.post('glob:*/api/v1/canvas/draft/commit', { result: {} });
    fetchMock.delete('glob:*/api/v1/canvas/draft', { result: {} });
    fetchMock.post('glob:*/api/v1/canvas/7/placement/chart/data', {
      result: { datasets: [{ inline_data: [] }] },
    });
    const post = jest.spyOn(SupersetClient, 'post');
    const { unmount } = render(<CanvasPage />, {
      useRedux: true,
      useRouter: true,
    });
    await waitFor(() =>
      expect(screen.getByTestId('draft-chart')).toHaveTextContent('north'),
    );
    post.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Edit canvas' }));
    expect(
      await screen.findByText('Draft. Only you can see these changes.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('draft-chart')).toHaveTextContent('north');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: action })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() =>
      expect(
        screen.queryByText('Draft. Only you can see these changes.'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('draft-chart')).toHaveTextContent('north');
    expect(mounts).toBe(1);
    const queries = post.mock.calls.filter(([request]) =>
      request.endpoint?.endsWith('/placement/chart/data'),
    );
    expect(queries.length).toBeGreaterThan(0);
    queries.forEach(([request]) => {
      expect(request.jsonPayload).toEqual({
        runtime_filters: [
          { datasetId: 13, column: 'region', values: ['north'] },
        ],
      });
    });
    unmount();
    dispose.dispose();
    post.mockRestore();
  },
);

/**
 * What extensions are told about the draft and a version preview, end to end
 * through the page. The draft named must be the one on screen: an extension
 * uses it to publish what the user reviewed, so a token or revision the screen
 * hasn't caught up with is worse than none.
 *
 * How each part is worked out is tested where it is worked out: request order
 * and refresh failures in useCanvasDefinition.test.ts, preview requests in
 * useCanvasVersionHistory.test.ts, steps in useDraftHistory.test.tsx, what the
 * body says while a change is in flight in CanvasBody.test.tsx, and the value
 * itself in useActiveCanvas.test.ts. These cover what only the page does: the
 * gate on which canvas and draft are loaded, and clearing the value.
 */

const draftEndpoint = 'glob:*/api/v1/canvas/draft';
const TITLE = 'Exec overview';

/** A draft of canvas 7, as the draft route returns it. */
const draftDefinition = (revision: number, canvasId = 7) => {
  const body = definition([], revision, true);
  return { result: { ...body.result, canvasId } };
};

const held = <T,>() => {
  let release: (value: T) => void = () => {};
  const promise = new Promise<T>(resolve => {
    release = resolve;
  });
  return { promise, release };
};

/**
 * Serves the draft route by token, a reply per request in turn; the last
 * reply keeps answering. A reply may be a promise, to hold the response.
 */
const serveDrafts = (replies: Record<string, unknown[]>) => {
  fetchMock.get(draftEndpoint, ({ options }) => {
    const token = (options.headers as Record<string, string> | undefined)?.[
      'x-canvas-draft'
    ];
    const queue = token ? replies[token] : undefined;
    if (!queue?.length) return 404;
    return queue.length > 1 ? queue.shift() : queue[0];
  });
};

const published = (revision: number) => ({ id: 7, title: TITLE, revision });

/**
 * A draft's definition on screen with no draft named: leaving it, or the
 * draft gone. The revision is the draft's own.
 */
const draftUnnamed = published;

/** The draft settled at `revision`, which is what the user sees. */
const inDraft = (token: string, revision: number) => ({
  ...published(revision),
  draft: { token, pending: false, revision },
});

/** The draft open, but not settled: no revision to publish. */
const pendingIn = (token: string, revision: number) => ({
  ...published(revision),
  draft: { token, pending: true },
});

/** A saved version on screen, over the live canvas at `revision`. */
const previewing = (revision: number, uuid = 'v-1', number = 1) => ({
  ...published(revision),
  previewedVersion: { uuid, number },
});

const recordActiveCanvas = () => {
  const seen: unknown[] = [];
  const subscription = canvas.onDidChangeActiveCanvas((value: unknown) =>
    seen.push(value),
  );
  return { seen, stop: () => subscription.dispose() };
};

const renderPage = () =>
  render(<CanvasPage />, { useRedux: true, useRouter: true });

/** Lets responses already released land. */
const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

const originalFlags = window.featureFlags;

afterEach(() => {
  window.location.hash = '';
  window.featureFlags = originalFlags;
  mockIdOrSlug = '7';
});

test('a draft opened from the page is named once loaded, and no longer once left', async () => {
  fetchMock.get(definitionEndpoint, definition([], 1, true));
  fetchMock.post('glob:*/api/v1/canvas/7/draft', {
    result: { token: 'tok-a', revision: 0 },
  });
  const draftReply = held<unknown>();
  serveDrafts({ 'tok-a': [draftReply.promise] });

  const { unmount } = renderPage();
  const edit = await screen.findByRole('button', { name: 'Edit canvas' });
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(1)),
  );
  const { seen, stop } = recordActiveCanvas();
  fireEvent.click(edit);
  await waitFor(() => expect(window.location.hash).toBe('#draft=tok-a'));
  await settle();

  // The published canvas is still what is on screen.
  expect(canvas.getActiveCanvas()).toStrictEqual(published(1));

  draftReply.release(draftDefinition(0));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 0)),
  );

  // Leaving: the draft's definition is still on screen, but it is no longer
  // open, so it is not named while the published canvas loads.
  const publishedReply = held<unknown>();
  fetchMock.removeRoutes();
  fetchMock.get(metadataEndpoint, {
    result: { id: 7, title: TITLE, description: 'KPIs and trend' },
  });
  fetchMock.get(definitionEndpoint, () => publishedReply.promise);
  window.location.hash = '';
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(0)),
  );
  publishedReply.release(definition([], 2));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(2)),
  );
  expect(seen).toStrictEqual([
    inDraft('tok-a', 0),
    draftUnnamed(0),
    published(2),
  ]);
  stop();

  // Leaving the page says no canvas is open.
  unmount();

  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test.each([
  [500, 'pending', pendingIn('tok-a', 2)],
  [404, 'no longer named', draftUnnamed(2)],
])(
  'a draft whose refresh answers %i is %s, its definition still shown',
  async (status, _, expected) => {
    // A failure may mean what is on screen is no longer the draft's latest; a
    // 404 or 403 means the draft was published, discarded or expired, or is
    // out of the user's reach.
    window.location.hash = '#draft=tok-a';
    serveDrafts({ 'tok-a': [draftDefinition(2), status, draftDefinition(3)] });

    renderPage();
    await waitFor(() =>
      expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
    );
    const { seen, stop } = recordActiveCanvas();

    fireEvent.focus(window);

    await waitFor(() =>
      expect(canvas.getActiveCanvas()).toStrictEqual(expected),
    );
    expect(
      screen.getByText('Draft. Only you can see these changes.'),
    ).toBeInTheDocument();
    expect(seen).toStrictEqual([expected]);
    stop();
  },
);

test('a draft that fails to open is never named', async () => {
  window.location.hash = '#draft=tok-a';
  serveDrafts({});

  renderPage();

  expect(
    await screen.findByText('This draft is no longer available'),
  ).toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('a canvas that fails after a draft was named says nothing', async () => {
  // Leaving the draft for a published canvas that cannot be read: the body
  // that named the draft is gone, so the page has to clear what it said.
  window.location.hash = '#draft=tok-a';
  serveDrafts({ 'tok-a': [draftDefinition(2)] });
  fetchMock.get(definitionEndpoint, 404);

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );

  window.location.hash = '';

  expect(
    await screen.findByText(
      'This canvas does not exist, or you do not have access to it',
    ),
  ).toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('a draft of another canvas says nothing', async () => {
  // Its revision is not this canvas's, so naming even that would mislead.
  window.location.hash = '#draft=tok-a';
  serveDrafts({ 'tok-a': [draftDefinition(0, 8)] });

  renderPage();

  expect(
    await screen.findByText('Draft. Only you can see these changes.'),
  ).toBeInTheDocument();
  await settle();
  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('moving to another canvas says nothing of it until it has loaded', async () => {
  fetchMock.get(definitionEndpoint, definition([], 3));
  const otherMetadata = held<unknown>();
  const otherDefinition = held<unknown>();
  fetchMock.get('glob:*/api/v1/canvas/8', () => otherMetadata.promise);
  fetchMock.get(
    'glob:*/api/v1/canvas/8/definition',
    () => otherDefinition.promise,
  );

  const { rerender } = renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );
  const { seen, stop } = recordActiveCanvas();

  mockIdOrSlug = '8';
  rerender(<CanvasPage />);
  await settle();

  expect(canvas.getActiveCanvas()).toBeUndefined();

  otherMetadata.release({ result: { id: 8, title: 'Sales' } });
  otherDefinition.release(definition([], 1));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual({
      id: 8,
      title: 'Sales',
      revision: 1,
    }),
  );
  expect(seen).toStrictEqual([
    undefined,
    { id: 8, title: 'Sales', revision: 1 },
  ]);
  stop();
});

const versionsEndpoint = 'glob:*/api/v1/canvas/c-uuid/versions/';

const versionMeta = (uuid: string, number: number) => ({
  version_uuid: uuid,
  version_number: number,
  transaction_id: number,
  operation_type: number === 0 ? 'baseline' : 'update',
  issued_at: '2026-01-01T00:00:00Z',
  changed_by: null,
  changes: [],
});

const snapshotOf = (uuid: string, number: number, children: string[]) => ({
  result: {
    title: TITLE,
    rendered: definition(children, 1).result,
    _version: versionMeta(uuid, number),
  },
});

test('previewing versions names the one on screen, and none once back', async () => {
  window.featureFlags = {
    ...originalFlags,
    [FeatureFlag.VersionHistory]: true,
  };
  fetchMock.removeRoutes();
  fetchMock.get(metadataEndpoint, {
    result: { id: 7, uuid: 'c-uuid', title: TITLE },
  });
  fetchMock.get(versionsEndpoint, {
    result: [
      versionMeta('v-0', 0),
      versionMeta('v-1', 1),
      versionMeta('v-2', 2),
    ],
  });
  fetchMock.get(definitionEndpoint, definition([], 3));
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-1/',
    snapshotOf('v-1', 1, ['a']),
  );
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    snapshotOf('v-0', 0, ['a', 'b']),
  );

  renderPage();
  fireEvent.click(await screen.findByTestId('canvas-version-history-button'));
  // Newest first: the current version, then `v-1`, then `v-0`.
  const entries = await screen.findAllByTestId('canvas-version');
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );
  const { seen, stop } = recordActiveCanvas();

  fireEvent.click(entries[1]);
  // The live canvas' revision, not the snapshot's: a preview is not a change.
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );
  fireEvent.click(screen.getAllByTestId('canvas-version')[2]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3, 'v-0', 0)),
  );
  expect(screen.getAllByText('This widget is unavailable')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );
  expect(seen).toStrictEqual([
    previewing(3),
    previewing(3, 'v-0', 0),
    published(3),
  ]);
  stop();
});
