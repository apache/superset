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
 * What extensions are told about the draft and a version preview. The draft
 * named must be the one on screen: an extension uses it to publish what the
 * user reviewed, so a token or revision the screen hasn't caught up with is
 * worse than none.
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

type Reply = unknown;

/**
 * Serves the draft route by token, a reply per request in turn; the last
 * reply keeps answering. A reply may be a promise, to hold the response.
 */
const serveDrafts = (replies: Record<string, Reply[]>) => {
  fetchMock.get(draftEndpoint, ({ options }) => {
    const token = (options.headers as Record<string, string> | undefined)?.[
      'x-canvas-draft'
    ];
    const queue = token ? replies[token] : undefined;
    if (!queue?.length) return 404;
    return queue.length > 1 ? queue.shift() : queue[0];
  });
};

/** The draft route's reads so far. */
const draftGets = () =>
  fetchMock.callHistory
    .calls(draftEndpoint)
    .filter(({ options }) => options.method?.toUpperCase() === 'GET');

const published = (revision: number) => ({ id: 7, title: TITLE, revision });

/**
 * A draft's definition on screen with no draft named: leaving it, another
 * one loading, or the draft gone. The revision is the draft's own.
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

const focusWindow = () => fireEvent.focus(window);

const originalFlags = window.featureFlags;

afterEach(() => {
  window.location.hash = '';
  window.featureFlags = originalFlags;
  mockIdOrSlug = '7';
});

test('nothing is said about a canvas still loading', async () => {
  const definitionReply = held<unknown>();
  fetchMock.get(definitionEndpoint, () => definitionReply.promise);

  renderPage();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(definitionEndpoint)).toHaveLength(1),
  );

  expect(canvas.getActiveCanvas()).toBeUndefined();

  definitionReply.release(definition([]));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(1)),
  );
});

test('a draft opened from the page is named once its definition has loaded', async () => {
  fetchMock.get(definitionEndpoint, definition([], 1, true));
  fetchMock.post('glob:*/api/v1/canvas/7/draft', {
    result: { token: 'tok-a', revision: 0 },
  });
  const draftReply = held<unknown>();
  serveDrafts({ 'tok-a': [draftReply.promise] });

  renderPage();
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
  expect(seen).toStrictEqual([inDraft('tok-a', 0)]);
  stop();
});

test('a refetch that moves the draft on names the new revision', async () => {
  window.location.hash = '#draft=tok-a';
  serveDrafts({ 'tok-a': [draftDefinition(3), draftDefinition(4)] });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3)),
  );

  focusWindow();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 4)),
  );
});

test('leaving a draft stops naming it straight away', async () => {
  window.location.hash = '#draft=tok-a';
  serveDrafts({ 'tok-a': [draftDefinition(2)] });
  const publishedReply = held<unknown>();
  fetchMock.get(definitionEndpoint, () => publishedReply.promise);

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  const { seen, stop } = recordActiveCanvas();

  window.location.hash = '';
  await waitFor(() => expect(seen).toHaveLength(1));
  // The draft's definition is still on screen, but it is no longer open.
  expect(seen[0]).toStrictEqual(draftUnnamed(2));

  publishedReply.release(definition([]));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(1)),
  );
  expect(seen).toStrictEqual([draftUnnamed(2), published(1)]);
  stop();
});

test('switching drafts names neither until the new one has loaded', async () => {
  window.location.hash = '#draft=tok-a';
  const lateA = held<unknown>();
  const replyB = held<unknown>();
  serveDrafts({
    'tok-a': [draftDefinition(2), lateA.promise],
    'tok-b': [replyB.promise],
  });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  // A refetch of the first draft is still in flight when the user moves on.
  focusWindow();
  await waitFor(() =>
    expect(
      fetchMock.callHistory
        .calls(draftEndpoint)
        .filter(({ options }) => options.method?.toUpperCase() === 'GET'),
    ).toHaveLength(2),
  );
  const { seen, stop } = recordActiveCanvas();

  window.location.hash = '#draft=tok-b';
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(2)),
  );

  lateA.release(draftDefinition(3));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(2));

  replyB.release(draftDefinition(0));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-b', 0)),
  );
  expect(seen).toStrictEqual([draftUnnamed(2), inDraft('tok-b', 0)]);
  stop();
});

test('a draft that fails to open is never named', async () => {
  window.location.hash = '#draft=tok-a';
  serveDrafts({});

  renderPage();

  expect(
    await screen.findByText('This draft is no longer available'),
  ).toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('a draft whose refresh fails is pending until one succeeds', async () => {
  // The last good definition stays on screen, but it may no longer be the
  // draft's latest, so there is no revision to publish.
  window.location.hash = '#draft=tok-a';
  serveDrafts({ 'tok-a': [draftDefinition(2), 500, draftDefinition(3)] });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  const { seen, stop } = recordActiveCanvas();

  focusWindow();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingIn('tok-a', 2)),
  );
  expect(
    screen.getByText('Draft. Only you can see these changes.'),
  ).toBeInTheDocument();

  focusWindow();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3)),
  );
  expect(seen).toStrictEqual([pendingIn('tok-a', 2), inDraft('tok-a', 3)]);
  stop();
});

test.each([404, 403])(
  'a draft whose refresh answers %i is no longer named',
  async status => {
    // Published, discarded or expired elsewhere, or out of the user's reach:
    // the draft is gone, not pending.
    window.location.hash = '#draft=tok-a';
    serveDrafts({ 'tok-a': [draftDefinition(2), status] });

    renderPage();
    await waitFor(() =>
      expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
    );
    const { seen, stop } = recordActiveCanvas();

    focusWindow();

    await waitFor(() =>
      expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(2)),
    );
    // What was on screen stays there.
    expect(
      screen.getByText('Draft. Only you can see these changes.'),
    ).toBeInTheDocument();
    expect(seen).toStrictEqual([draftUnnamed(2)]);
    stop();
  },
);

test('a draft found gone stays unnamed when a later refresh fails otherwise', async () => {
  // Going offline after the draft was taken out of the user's reach must not
  // bring it back as pending, which it would then stay. A 403 rather than a
  // 404: a 404 also stops the refreshes, so none would follow it.
  window.location.hash = '#draft=tok-a';
  serveDrafts({
    'tok-a': [draftDefinition(2), 403, 500, draftDefinition(3)],
  });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  const { seen, stop } = recordActiveCanvas();

  focusWindow();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(2)),
  );
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(3));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(draftUnnamed(2));

  // Only a refresh that succeeds names it again.
  focusWindow();

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3)),
  );
  expect(seen).toStrictEqual([draftUnnamed(2), inDraft('tok-a', 3)]);
  stop();
});

test('a later refresh answering an older revision does not take the draft back', async () => {
  // Requests are answered in order, but a read can still lag behind one
  // answered before it.
  window.location.hash = '#draft=tok-a';
  serveDrafts({
    'tok-a': [draftDefinition(4), draftDefinition(6), draftDefinition(5)],
  });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 4)),
  );

  focusWindow();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 6)),
  );
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(3));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 6));
});

test('save is held while an undo is still settling', async () => {
  // Until the refetch lands, the revision on screen is the one the undo
  // started from, and a publish naming it would be rejected.
  window.location.hash = '#draft=tok-a';
  const undoable = (revision: number) => ({
    result: {
      ...draftDefinition(revision).result,
      canUndo: true,
      canRedo: true,
      empty: false,
      changes: [],
    },
  });
  const refetchAfterUndo = held<unknown>();
  serveDrafts({ 'tok-a': [undoable(2), refetchAfterUndo.promise] });
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', undoable(3));
  const commits = () =>
    fetchMock.callHistory.calls('glob:*/api/v1/canvas/draft/commit');

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  const save = () => screen.getByRole('button', { name: 'Save' });
  expect(save()).toBeEnabled();

  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(draftGets()).toHaveLength(2));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(pendingIn('tok-a', 2));
  expect(save()).toBeDisabled();
  // Discarding names no revision, so it stays a way out of the draft even
  // if the refetch never lands.
  expect(screen.getByRole('button', { name: 'Discard' })).toBeEnabled();
  fireEvent.click(save());
  await settle();
  expect(commits()).toHaveLength(0);

  refetchAfterUndo.release(undoable(3));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3)),
  );
  expect(save()).toBeEnabled();
});

test('an undo whose refetch fails can still be discarded', async () => {
  // Polling off (the test default): nothing retries the refetch until the
  // window regains focus, so the step never reaches the screen.
  window.location.hash = '#draft=tok-a';
  const undoable = (revision: number) => ({
    result: {
      ...draftDefinition(revision).result,
      canUndo: true,
      canRedo: true,
      empty: false,
      changes: [],
    },
  });
  serveDrafts({ 'tok-a': [undoable(2), 500] });
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', undoable(3));
  fetchMock.delete(draftEndpoint, { result: {} });
  fetchMock.get(definitionEndpoint, definition([], 9, true));

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(draftGets()).toHaveLength(2));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(pendingIn('tok-a', 2));
  expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(9)),
  );
  expect(
    fetchMock.callHistory
      .calls(draftEndpoint)
      .filter(({ options }) => options.method?.toUpperCase() === 'DELETE'),
  ).toHaveLength(1);
  expect(screen.queryByTestId('canvas-draft-banner')).not.toBeInTheDocument();
});

test('a discard made while an undo settles is not undone by the refetch landing late', async () => {
  window.location.hash = '#draft=tok-a';
  const undoable = (revision: number) => ({
    result: {
      ...draftDefinition(revision).result,
      canUndo: true,
      canRedo: true,
      empty: false,
      changes: [],
    },
  });
  const refetchAfterUndo = held<unknown>();
  serveDrafts({ 'tok-a': [undoable(2), refetchAfterUndo.promise] });
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', undoable(3));
  fetchMock.delete(draftEndpoint, { result: {} });
  fetchMock.get(definitionEndpoint, definition([], 9, true));

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(draftGets()).toHaveLength(2));
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(9)),
  );

  refetchAfterUndo.release(undoable(3));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(published(9));
  expect(screen.queryByTestId('canvas-draft-banner')).not.toBeInTheDocument();
});

test('a failed step on a draft the user has left reads nothing of it', async () => {
  window.location.hash = '#draft=tok-a';
  const undoable = (revision: number) => ({
    result: {
      ...draftDefinition(revision).result,
      canUndo: true,
      canRedo: true,
      empty: false,
      changes: [],
    },
  });
  serveDrafts({ 'tok-a': [undoable(2)], 'tok-b': [undoable(5)] });
  const stepReply = held<unknown>();
  fetchMock.post('glob:*/api/v1/canvas/draft/undo', () => stepReply.promise);

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/canvas/draft/undo'),
    ).toHaveLength(1),
  );
  window.location.hash = '#draft=tok-b';
  // Pending, not settled: the step on the draft left is still in flight.
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(pendingIn('tok-b', 5)),
  );
  const getsBefore = draftGets().length;
  stepReply.release({ status: 409, body: { message: 'Draft A moved on' } });
  await settle();

  expect(draftGets()).toHaveLength(getsBefore);
  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-b', 5));
});

test('an older response that lands last does not take the draft back', async () => {
  window.location.hash = '#draft=tok-a';
  const slow = held<unknown>();
  serveDrafts({
    'tok-a': [draftDefinition(4), slow.promise, draftDefinition(6)],
  });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 4)),
  );

  focusWindow();
  focusWindow();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 6)),
  );

  slow.release(draftDefinition(5));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 6));
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

const versionsEndpoint = 'glob:*/api/v1/canvas/c-uuid/versions/';
const olderVersionEndpoint = 'glob:*/api/v1/canvas/c-uuid/versions/v-1/';

const versionMeta = (uuid: string, number: number) => ({
  version_uuid: uuid,
  version_number: number,
  transaction_id: number,
  operation_type: number === 0 ? 'baseline' : 'update',
  issued_at: '2026-01-01T00:00:00Z',
  changed_by: null,
  changes: [],
});

const withVersionHistory = () => {
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
};

const snapshotOf = (uuid: string, number: number, children: string[]) => ({
  result: {
    title: TITLE,
    rendered: definition(children, 1).result,
    _version: versionMeta(uuid, number),
  },
});

const snapshot = snapshotOf('v-1', 1, ['a']);

/** Newest first: the current version, then `v-1`, then `v-0`. */
const versionEntries = async () => {
  fireEvent.click(await screen.findByTestId('canvas-version-history-button'));
  return screen.findAllByTestId('canvas-version');
};

const openOlderVersion = async () => {
  fireEvent.click((await versionEntries())[1]);
};

test('a version preview is said while it is on screen', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3));
  fetchMock.get(olderVersionEndpoint, snapshot);

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );

  await openOlderVersion();

  // The live canvas' revision, not the snapshot's: a preview is not a change.
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );
});

test('a preview that loads after a draft opened is not shown', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3, true));
  const lateSnapshot = held<unknown>();
  fetchMock.get(olderVersionEndpoint, () => lateSnapshot.promise);
  fetchMock.post('glob:*/api/v1/canvas/7/draft', {
    result: { token: 'tok-a', revision: 0 },
  });
  serveDrafts({ 'tok-a': [draftDefinition(0)] });

  renderPage();
  await openOlderVersion();
  fireEvent.click(await screen.findByRole('button', { name: 'Edit canvas' }));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 0)),
  );

  lateSnapshot.release(snapshot);
  await settle();

  expect(
    document.querySelector('[data-test="canvas-version-preview"]'),
  ).not.toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 0));
});

test('leaving the page says no canvas is open', async () => {
  fetchMock.get(definitionEndpoint, definition([]));

  const { unmount } = renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(1)),
  );

  unmount();

  expect(canvas.getActiveCanvas()).toBeUndefined();
});

test('of two versions clicked in turn, the second is the one previewed', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3));
  const first = held<unknown>();
  fetchMock.get(olderVersionEndpoint, () => first.promise);
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    snapshotOf('v-0', 0, ['a', 'b']),
  );

  renderPage();
  const entries = await versionEntries();
  fireEvent.click(entries[1]);
  fireEvent.click(entries[2]);

  await waitFor(() =>
    expect(screen.getAllByText('This widget is unavailable')).toHaveLength(2),
  );

  first.release(snapshot);
  await settle();

  // Still the second: the first answered last, but was asked first.
  expect(screen.getAllByText('This widget is unavailable')).toHaveLength(2);
  expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3, 'v-0', 0));
});

test('restoring a version ends the preview', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3), {
    name: definitionEndpoint,
  });
  fetchMock.get(olderVersionEndpoint, snapshot);
  fetchMock.post('glob:*/api/v1/canvas/c-uuid/versions/v-1/restore', {
    result: { revision: 4, skippedPlacements: [] },
  });

  renderPage();
  await openOlderVersion();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );
  const { seen, stop } = recordActiveCanvas();
  fetchMock.removeRoute(definitionEndpoint);
  fetchMock.get(definitionEndpoint, definition([], 4));

  const restoreButtons = () =>
    screen.getAllByRole('button', { name: 'Restore this version' });
  fireEvent.click(restoreButtons()[0]);
  // The banner's button, then the confirmation's.
  await waitFor(() => expect(restoreButtons()).toHaveLength(2));
  fireEvent.click(restoreButtons()[1]);

  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(4)),
  );
  // Whether the restored revision lands with the preview's end or after it
  // is down to timing; the preview is over either way.
  expect(seen.length).toBeGreaterThan(0);
  seen.forEach(value => expect(value).not.toHaveProperty('previewedVersion'));
  stop();
});

test('a version still loading when another is restored is not shown after it', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3), {
    name: definitionEndpoint,
  });
  fetchMock.get(olderVersionEndpoint, snapshot);
  const oldest = held<unknown>();
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    () => oldest.promise,
  );
  fetchMock.post('glob:*/api/v1/canvas/c-uuid/versions/v-1/restore', {
    result: { revision: 4, skippedPlacements: [] },
  });

  renderPage();
  fireEvent.click((await versionEntries())[1]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );
  // Another version is asked for, then the one on screen is restored.
  fireEvent.click(screen.getAllByTestId('canvas-version')[2]);
  fetchMock.removeRoute(definitionEndpoint);
  fetchMock.get(definitionEndpoint, definition([], 4));
  const restoreButtons = () =>
    screen.getAllByRole('button', { name: 'Restore this version' });
  fireEvent.click(restoreButtons()[0]);
  await waitFor(() => expect(restoreButtons()).toHaveLength(2));
  fireEvent.click(restoreButtons()[1]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(4)),
  );

  oldest.release(snapshotOf('v-0', 0, ['a', 'b']));
  await settle();

  expect(
    document.querySelector('[data-test="canvas-version-preview"]'),
  ).not.toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toStrictEqual(published(4));
});

test('moving to another canvas says nothing of it until it has loaded', async () => {
  // The page stays mounted when only the id changes, and for a render still
  // holds the previous canvas's title and definition.
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

test('a canvas that fails after a draft was named says nothing', async () => {
  // Leaving the draft for a published canvas that cannot be read.
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

test('an older refresh failing after a newer one succeeded leaves the draft settled', async () => {
  window.location.hash = '#draft=tok-a';
  const slowFailure = held<unknown>();
  serveDrafts({
    'tok-a': [draftDefinition(2), slowFailure.promise, draftDefinition(3)],
  });

  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );

  focusWindow();
  focusWindow();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3)),
  );

  slowFailure.release(500);
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 3));
});

test('going back to the current canvas drops a preview still loading', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3));
  fetchMock.get(olderVersionEndpoint, snapshot);
  const second = held<unknown>();
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    () => second.promise,
  );

  renderPage();
  const entries = await versionEntries();
  fireEvent.click(entries[1]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );
  fireEvent.click(entries[2]);
  fireEvent.click(screen.getByRole('button', { name: 'Back to current' }));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );

  second.release(snapshotOf('v-0', 0, ['a', 'b']));
  await settle();

  expect(
    document.querySelector('[data-test="canvas-version-preview"]'),
  ).not.toBeInTheDocument();
  expect(canvas.getActiveCanvas()).toStrictEqual(published(3));
});

test('reopening a draft does not bring back what was asked before leaving it', async () => {
  // A refresh of the draft is still in flight when the user leaves and comes
  // back before the published canvas answers; that refresh then answers
  // before the request sent on coming back.
  window.location.hash = '#draft=tok-a';
  const beforeLeaving = held<unknown>();
  const afterReturning = held<unknown>();
  serveDrafts({
    'tok-a': [
      draftDefinition(2),
      beforeLeaving.promise,
      afterReturning.promise,
    ],
  });
  const publishedReply = held<unknown>();
  fetchMock.get(definitionEndpoint, () => publishedReply.promise);
  renderPage();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2)),
  );
  focusWindow();
  await waitFor(() => expect(draftGets()).toHaveLength(2));
  const { seen, stop } = recordActiveCanvas();

  window.location.hash = '';
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(definitionEndpoint)).toHaveLength(1),
  );
  window.location.hash = '#draft=tok-a';
  await waitFor(() => expect(draftGets()).toHaveLength(3));

  beforeLeaving.release(draftDefinition(3));
  await settle();

  expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 2));

  afterReturning.release(draftDefinition(4));
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(inDraft('tok-a', 4)),
  );
  publishedReply.release(definition([]));
  await settle();

  expect(seen).toStrictEqual([
    draftUnnamed(2),
    inDraft('tok-a', 2),
    inDraft('tok-a', 4),
  ]);
  stop();
});

test('previewing another version names the one on screen', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3));
  fetchMock.get(olderVersionEndpoint, snapshot);
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    snapshotOf('v-0', 0, ['a', 'b']),
  );

  renderPage();
  const entries = await versionEntries();
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(published(3)),
  );
  const { seen, stop } = recordActiveCanvas();

  fireEvent.click(entries[1]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3)),
  );
  fireEvent.click(screen.getAllByTestId('canvas-version')[2]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3, 'v-0', 0)),
  );
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

test('an older preview failing after a newer one loaded shows no error', async () => {
  withVersionHistory();
  fetchMock.get(definitionEndpoint, definition([], 3));
  const first = held<unknown>();
  fetchMock.get(olderVersionEndpoint, () => first.promise);
  fetchMock.get(
    'glob:*/api/v1/canvas/c-uuid/versions/v-0/',
    snapshotOf('v-0', 0, ['a', 'b']),
  );

  renderPage();
  const entries = await versionEntries();
  fireEvent.click(entries[1]);
  fireEvent.click(entries[2]);
  await waitFor(() =>
    expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3, 'v-0', 0)),
  );

  first.release(500);
  await settle();

  // The preview's own banner is the only alert: no error beside it.
  expect(screen.getAllByRole('alert')).toEqual([
    screen.getByTestId('canvas-version-preview'),
  ]);
  expect(canvas.getActiveCanvas()).toStrictEqual(previewing(3, 'v-0', 0));
});
