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

import { createStore, render, screen } from 'spec/helpers/testing-library';
import {
  buildPageContextPayload,
  buildRecentChatHistorySummary,
  extractHelperDirectives,
  formatPageContextForChat,
  getMinimalContext,
  isContextTooLarge,
  truncateText,
  usePageContext,
  type PageContext,
} from './usePageContext';

/**
 * Renders the hook and exposes what it produced as JSON, which is enough to
 * assert on and avoids a second renderer just for hooks.
 */
const Probe = () => {
  const context = usePageContext();
  return <div data-test="context">{JSON.stringify(context)}</div>;
};

/**
 * Renders the hook at a path with a store holding exactly the given slices.
 *
 * The slices are served by pass-through reducers rather than the app's own: the
 * hook reads several page reducers that are never mounted together in the real
 * app, and only their shape matters here.
 */
const contextFor = (
  path: string,
  state: Record<string, unknown> = {},
): PageContext => {
  window.history.pushState({}, '', path);
  const reducers = Object.fromEntries(
    Object.keys(state).map(key => [key, () => state[key]]),
  );
  render(<Probe />, {
    useRouter: true,
    store: createStore(state, reducers),
  });
  return JSON.parse(screen.getByTestId('context').textContent ?? '{}');
};

test('a SQL Lab path reports the active editor, its tables and recent queries', () => {
  const context = contextFor('/sqllab', {
    sqlLab: {
      queryEditors: [
        {
          id: 'editor-1',
          name: 'Revenue',
          sql: 'SELECT 1',
          schema: 'public',
          dbId: 3,
        },
      ],
      tabHistory: ['editor-1'],
      unsavedQueryEditor: {},
      databases: { 3: { database_name: 'warehouse' } },
      tables: [
        { queryEditorId: 'editor-1', name: 'orders', schema: 'public' },
        { queryEditorId: 'other', name: 'ignored' },
      ],
      queries: {
        q1: { sqlEditorId: 'editor-1', sql: 'SELECT 1', state: 'success' },
      },
    },
  });

  expect(context.pageType).toBe('sqllab');
  expect(context.sqlContext?.activeEditor).toEqual(
    expect.objectContaining({
      name: 'Revenue',
      sql: 'SELECT 1',
      schema: 'public',
      database: 'warehouse',
    }),
  );
  // Tables belonging to another editor are not the user's current context.
  expect(context.sqlContext?.tables).toEqual([
    { name: 'orders', schema: 'public' },
  ]);
  expect(context.sqlContext?.recentQueries).toHaveLength(1);
});

test('the unsaved editor overrides the saved one', () => {
  const context = contextFor('/sqllab', {
    sqlLab: {
      queryEditors: [{ id: 'editor-1', name: 'Draft', sql: 'SELECT 1' }],
      tabHistory: ['editor-1'],
      // What the user has typed but not saved is what they are looking at.
      unsavedQueryEditor: { id: 'editor-1', sql: 'SELECT 2' },
      databases: {},
      tables: [],
      queries: {},
    },
  });

  expect(context.sqlContext?.activeEditor?.sql).toBe('SELECT 2');
});

test('an explore path reports the chart, its datasource and its controls', () => {
  const context = contextFor('/explore/?slice_id=7', {
    explore: {
      form_data: {
        slice_id: 7,
        viz_type: 'table',
        metrics: ['count'],
        time_range: 'Last week',
      },
      datasource: {
        id: 12,
        table_name: 'orders',
        type: 'table',
        schema: 'public',
        database: { database_name: 'warehouse' },
      },
      slice: { slice_id: 7, slice_name: 'Orders', description: 'All orders' },
      can_overwrite: true,
    },
  });

  expect(context.pageType).toBe('explore');
  expect(context.chartContext?.chartId).toBe(7);
  expect(context.chartContext?.chartName).toBe('Orders');
  expect(context.chartContext?.datasource).toEqual({
    id: 12,
    name: 'orders',
    type: 'table',
    schema: 'public',
    database: 'warehouse',
  });
  // A chart description is worth sending as markdown, not just as a field.
  expect(context.pageMarkdown).toEqual([
    { source: 'chart_description', content: 'All orders' },
  ]);
});

test('the chart id is recovered from the URL when the store has none', () => {
  const context = contextFor('/explore/?slice_id=42', {
    explore: { form_data: {}, datasource: null, slice: null },
  });

  expect(context.chartContext?.chartId).toBe(42);
});

test('a dashboard reports only the charts and markdown in the active tab', () => {
  const context = contextFor('/superset/dashboard/1/', {
    dashboardInfo: { dashboard_title: 'Sales' },
    dashboardState: { activeTabs: ['TAB-A'] },
    dashboardLayout: {
      present: {
        'TAB-A': { id: 'TAB-A', type: 'TAB', meta: { text: 'This week' } },
        'TAB-B': { id: 'TAB-B', type: 'TAB', meta: { text: 'Last week' } },
        'CHART-1': {
          id: 'CHART-1',
          type: 'CHART',
          parents: ['TAB-A'],
          meta: { chartId: 1, sliceName: 'Revenue' },
        },
        'CHART-2': {
          id: 'CHART-2',
          type: 'CHART',
          parents: ['TAB-B'],
          meta: { chartId: 2, sliceName: 'Hidden' },
        },
        'MARKDOWN-1': {
          id: 'MARKDOWN-1',
          type: 'MARKDOWN',
          parents: ['TAB-A'],
          meta: { code: 'Read me' },
        },
      },
    },
    sliceEntities: { slices: {} },
  });

  expect(context.pageType).toBe('dashboard');
  expect(context.dashboardContext?.title).toBe('Sales');
  expect(context.dashboardContext?.activeTabLabel).toBe('This week');
  // A chart in an unselected tab is not on screen, so it is not context.
  expect(context.dashboardContext?.charts).toEqual([
    { id: 1, title: 'Revenue' },
  ]);
  expect(context.pageMarkdown).toEqual([
    { source: 'dashboard_component', content: 'Read me' },
  ]);
});

test('only native filters with a value are reported as active', () => {
  const context = contextFor('/superset/dashboard/1/', {
    dashboardInfo: { dashboard_title: 'Sales' },
    dashboardState: { activeTabs: [] },
    dashboardLayout: { present: {} },
    sliceEntities: { slices: {} },
    nativeFilters: {
      filters: {
        applied: {
          id: 'applied',
          name: 'Region',
          filterType: 'filter_select',
          targets: [{ column: { name: 'region' } }],
        },
        empty: { id: 'empty', name: 'Segment', targets: [] },
        unset: { id: 'unset', name: 'Channel', targets: [] },
      },
    },
    dataMask: {
      applied: { id: 'applied', filterState: { value: ['EU'] } },
      empty: { id: 'empty', filterState: { value: [] } },
      unset: { id: 'unset', filterState: {} },
    },
  });

  expect(context.dashboardContext?.activeFilters).toEqual([
    {
      name: 'Region',
      column: 'region',
      filterType: 'filter_select',
      value: ['EU'],
    },
  ]);
});

test('a path with no page context still reports where the user is', () => {
  const context = contextFor('/anything/else');

  expect(context.pageType).toBe('other');
  expect(context.pathname).toBe('/anything/else');
  expect(context.sqlContext).toBeUndefined();
});

test('formatPageContextForChat spells out the SQL, the filters and the markdown', () => {
  const formatted = formatPageContextForChat({
    url: '/superset/dashboard/1/',
    pathname: '/superset/dashboard/1/',
    pageType: 'dashboard',
    dashboardContext: {
      title: 'Sales',
      activeTabId: 'TAB-A',
      activeTabLabel: 'This week',
      charts: [{ id: 1, title: 'Revenue' }],
      activeFilters: [{ name: 'Region', column: 'region', value: ['EU'] }],
    },
    pageMarkdown: [{ source: 'dashboard_component', content: 'Read me' }],
  });

  expect(formatted).toContain('Current page: dashboard');
  expect(formatted).toContain('- Title: Sales');
  expect(formatted).toContain('1: Revenue');
  expect(formatted).toContain('"Region" on column "region": EU');
  expect(formatted).toContain('Read me');
});

test('a @helper markdown block becomes a directive and leaves the prose', () => {
  const context: PageContext = {
    url: '/superset/dashboard/1/',
    pathname: '/superset/dashboard/1/',
    pageType: 'dashboard',
    pageMarkdown: [
      { source: 'dashboard_component', content: '@helper Prefer weekly grain' },
      { source: 'dashboard_component', content: 'Visible note' },
    ],
  };

  expect(extractHelperDirectives(context)).toEqual(['Prefer weekly grain']);
  // The directive is an instruction to the assistant, not content to describe.
  const formatted = formatPageContextForChat(context);
  expect(formatted).toContain('Visible note');
  expect(formatted).not.toContain('Prefer weekly grain');
});

test('getMinimalContext clips the parts that make a context large', () => {
  const long = 'x'.repeat(600);
  const minimal = getMinimalContext({
    url: '/sqllab',
    pathname: '/sqllab',
    pageType: 'sqllab',
    sqlContext: {
      activeEditor: { sql: long, name: 'Big' },
      tables: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
      recentQueries: [{ sql: long }],
    },
  });

  expect(minimal.sqlContext?.activeEditor?.sql).toHaveLength(203);
  expect(minimal.sqlContext?.tables).toHaveLength(3);
  expect(minimal.sqlContext?.recentQueries).toEqual([]);
});

test('isContextTooLarge only flags a context past the threshold', () => {
  const base: PageContext = {
    url: '/sqllab',
    pathname: '/sqllab',
    pageType: 'sqllab',
  };

  expect(isContextTooLarge(base)).toBe(false);
  expect(
    isContextTooLarge({
      ...base,
      sqlContext: { activeEditor: { sql: 'x'.repeat(6000) } },
    }),
  ).toBe(true);
});

test('the request payload carries the formatted prose and the directives', () => {
  const payload = buildPageContextPayload({
    url: '/sqllab',
    pathname: '/sqllab',
    pageType: 'sqllab',
    pageMarkdown: [
      { source: 'chart_description', content: '@helper Be terse' },
    ],
  });

  expect(payload.pageType).toBe('sqllab');
  expect(typeof payload.formatted).toBe('string');
  expect(payload.helper_directives).toEqual(['Be terse']);
});

test('truncateText marks that it clipped', () => {
  expect(truncateText('abcdef', 3)).toBe('abc...');
  expect(truncateText('abc', 3)).toBe('abc');
});

test('the chat history summary keeps the most recent turns, clipped from the front', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `turn ${index}`,
  }));

  const summary = buildRecentChatHistorySummary(history, 2);

  // The tail is what a follow-up question refers to, so the front is what goes.
  expect(summary).toBe(
    [
      'user: turn 8',
      'assistant: turn 9',
      'user: turn 10',
      'assistant: turn 11',
    ].join('\n'),
  );
  expect(buildRecentChatHistorySummary([])).toBeUndefined();
});

test('the chat history summary is clipped to a character budget', () => {
  const summary = buildRecentChatHistorySummary(
    [{ role: 'user', content: 'x'.repeat(100) }],
    4,
    20,
  );

  expect(summary).toHaveLength(20);
});
