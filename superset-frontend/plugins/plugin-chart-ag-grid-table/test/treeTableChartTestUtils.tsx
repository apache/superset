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
// Import this helper first. It registers module mocks and global test hooks.
import '@testing-library/jest-dom';
import { ReactNode, useState, HTMLAttributes } from 'react';
import { screen, fireEvent, act } from '@superset-ui/core/spec';
import userEventLib from '@testing-library/user-event';
import type { AgGridReact, AgGridReactProps } from 'ag-grid-react';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { GenericDataType } from '@apache-superset/core/common';
import fetchMock from 'fetch-mock';
import { DataMask, SupersetClient } from '@superset-ui/core';
import TreeTableChart from '../src/TreeTable/TreeTableChart';
import * as fetchModule from '../src/TreeTable/fetchTreeTableData';
import { TreeTableTransformedProps } from '../src/TreeTable/types';

beforeAll(setupAGGridModules);

// JSDOM's selector engine repeatedly scans nested grids for the container's
// :has rules. Keep visual-style assertions in the separate styles test.
jest.mock('../src/TreeTable/styles', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TreeTableContainer: React.forwardRef<
      HTMLDivElement,
      { height: number; children: ReactNode } & HTMLAttributes<HTMLDivElement>
    >(function Container({ height, children, ...props }, ref) {
      return (
        <div ref={ref} style={{ height }} {...props}>
          {children}
        </div>
      );
    }),
  };
});

export const userEvent = userEventLib.setup({
  advanceTimers: jest.advanceTimersByTime,
});

beforeEach(() => {
  jest.useFakeTimers();
  const started = jest.now();
  // Measure the focus-prune window on the same clock as user events and timers.
  jest.spyOn(performance, 'now').mockImplementation(() => jest.now() - started);
  // jsdom cannot lay out AG Grid's 100px scrollbar probe. Give it the
  // dimensions of an overlay scrollbar so the grid can cache the measurement.
  const { get: clientWidth } = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientWidth',
  )!;
  const { get: offsetWidth } = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth',
  )!;
  jest
    .spyOn(Element.prototype, 'clientWidth', 'get')
    .mockImplementation(function (this: Element) {
      return this.classList.contains('ag-scrollbar-probe')
        ? 100
        : clientWidth!.call(this);
    });
  jest
    .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
    .mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ag-scrollbar-probe')
        ? 100
        : offsetWidth!.call(this);
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  document.documentElement.scrollTop = 0;
  jest.clearAllTimers();
  jest.useRealTimers();
});

jest.mock('ag-stack', () => ({
  ...jest.requireActual<typeof import('ag-stack')>('ag-stack'),
  _getInnerWidth: () => 800,
  _getInnerHeight: () => 400,
}));

// Keep AG Grid's behavior and markup, but keep its visual theme rules out of
// jsdom's style cascade. Role queries and focus walks repeatedly consult it.
const structuralStyles = document.createElement('style');
beforeAll(() => {
  structuralStyles.textContent = '.ag-hidden { display: none !important; }';
  document.head.appendChild(structuralStyles);
});
afterAll(() => structuralStyles.remove());

jest.mock('ag-grid-react', () => {
  const actual =
    jest.requireActual<typeof import('ag-grid-react')>('ag-grid-react');
  const React = jest.requireActual<typeof import('react')>('react');
  const themeStyleContainer = globalThis.document.createElement('div');
  return {
    ...actual,
    AgGridReact: React.forwardRef<AgGridReact, AgGridReactProps>(
      function Grid(props, ref) {
        return (
          <actual.AgGridReact
            {...props}
            ref={ref}
            themeStyleContainer={themeStyleContainer}
          />
        );
      },
    ),
  };
});

jest.mock('../src/TreeTable/fetchTreeTableData', () => {
  const actual = jest.requireActual<typeof fetchModule>(
    '../src/TreeTable/fetchTreeTableData',
  );
  return { __esModule: true, ...actual, default: jest.fn(actual.default) };
});

beforeEach(() =>
  jest
    .mocked(fetchModule.default)
    .mockReset()
    .mockImplementation(
      jest.requireActual<typeof fetchModule>(
        '../src/TreeTable/fetchTreeTableData',
      ).default,
    ),
);

let observedHeight = 0;

export const setObservedHeight = (height: number) => {
  observedHeight = height;
};

beforeAll(() => {
  global.ResizeObserver = class {
    callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(element: Element) {
      if (observedHeight)
        this.callback(
          [
            {
              contentRect: { height: observedHeight },
              target: element,
            } as unknown as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
    }

    unobserve() {}

    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

export const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data';

beforeAll(() => {
  fetchMock.mockGlobal();
  fetchMock.get('glob:*api/v1/security/csrf_token/*', { result: '1234' });
  SupersetClient.reset();
  SupersetClient.configure({ fetchRetryOptions: { retries: 0 } }).init();
});

afterAll(() => fetchMock.hardReset());

afterEach(() => {
  observedHeight = 0;
  fetchMock.clearHistory().removeRoutes({ names: [CHART_DATA_ENDPOINT] });
});

export const level = {
  key: 'session',
  name: 'Session',
  id_column: 'session_id',
  columns: ['channel'],
  detail_fields: ['detail'],
};

export const data = [
  { session_id: 'S1', channel: 'Voice' },
  { session_id: 'S2', channel: 'Chat' },
  { session_id: 'S1', channel: 'Voice' },
  { session_id: null, channel: 'Voice' },
  { session_id: '', channel: 'Chat' },
];

export function props(
  extra: Partial<TreeTableTransformedProps> = {},
): TreeTableTransformedProps {
  return {
    width: 800,
    height: 400,
    levels: [level],
    data,
    columns: [
      {
        key: 'session_id',
        label: 'Session Id',
        dataType: GenericDataType.String,
      },
      { key: 'channel', label: 'Channel', dataType: GenericDataType.String },
    ],
    colnames: ['session_id', 'channel'],
    coltypes: [GenericDataType.String, GenericDataType.String],
    rowcount: 120,
    pageSize: 50,
    currentPage: 0,
    serverPageLength: 50,
    ownState: {},
    setDataMask: jest.fn(),
    emitCrossFilters: false,
    sliceId: 0,
    rawFormData: {
      datasource: '1__table',
      viz_type: 'ag-grid-table',
      query_mode: 'tree',
      levels: extra.levels ?? [level],
    },
    verboseMap: {},
    ...extra,
  };
}

export function Harness({
  value,
  onMask,
}: {
  value: TreeTableTransformedProps;
  onMask: (mask: DataMask) => void;
}) {
  const [mask, setMask] = useState<DataMask>({
    ownState: value.ownState,
    filterState: { filters: value.filters },
  });
  return (
    <div id="chart-id-0">
      <TreeTableChart
        {...value}
        ownState={mask.ownState ?? {}}
        filters={mask.filterState?.filters}
        currentPage={mask.ownState?.currentPage ?? value.currentPage}
        pageSize={mask.ownState?.pageSize ?? value.pageSize}
        setDataMask={next => {
          onMask(next);
          setMask(previous => ({ ...previous, ...next }));
        }}
      />
    </div>
  );
}

export const tick = () => act(() => jest.advanceTimersByTimeAsync(30));

export const collapseFromMainButton = async () => {
  const button =
    screen.queryByRole('button', { name: 'Collapse all' }) ??
    screen.getByRole('button', { name: 'Expand all' });
  if (button.textContent === 'Expand all') await userEvent.click(button);
  await userEvent.click(button);
  return button;
};

export const pageSizeSelect = () =>
  screen
    .getAllByRole('combobox')
    .find(box => box.getAttribute('aria-label') !== 'Expand all to')!;

export const stepLevel = {
  key: 'step',
  name: 'Step',
  name_plural: 'Steps',
  id_column: 'step_id',
  parent_column: 'session_id',
  columns: ['item_desc'],
  detail_fields: ['result'],
};

export type ChildBody = {
  force: boolean;
  queries: {
    filters: { op: string; val?: unknown }[];
    metrics?: unknown[];
    row_offset?: number;
  }[];
};

export const inOf = (body: ChildBody) =>
  body.queries[0].filters.find(filter => filter.op === 'IN')?.val as
    | string[]
    | undefined;

let stepsHold: Promise<void> | undefined;
let stepsFail = false;

export const setStepsFail = (fail: boolean) => {
  stepsFail = fail;
};

export const holdSteps = () => {
  let release = () => {};
  stepsHold = new Promise(resolve => {
    release = () => {
      stepsHold = undefined;
      resolve();
    };
  });
  return () => act(async () => release());
};
afterEach(() => {
  stepsHold = undefined;
  stepsFail = false;
});

export const waitForSteps = () => stepsHold;

export const twoLevels = (extra: Partial<TreeTableTransformedProps> = {}) =>
  props({ levels: [level, stepLevel], ...extra });

/** The focused element, with a focused +/- button described by its cell (a focused +/- cell moves focus into its button). */
export const focusedStop = () => {
  const element = document.activeElement as HTMLElement | null;
  return (
    (element?.matches('button')
      ? element.closest<HTMLElement>('[col-id="tree_table_expand"]')
      : null) ?? element
  );
};

export function routeSteps(total = 3) {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    async ({ options }) => {
      if (stepsHold) await stepsHold;
      if (stepsFail) return { status: 500, body: { message: 'failed' } };
      const body = JSON.parse(options.body as string) as DeepBody;
      return {
        result: body.queries.map(query => {
          const ids = inOf({ ...body, queries: [query] })!;
          if (query.metrics.length)
            return {
              data: ids.includes('S1')
                ? [{ session_id: 'S1', 'COUNT_DISTINCT(step_id)': total }]
                : [],
              colnames: ['session_id', 'COUNT_DISTINCT(step_id)'],
              coltypes: [1, 0],
            };
          const offset = query.row_offset ?? 0;
          const n = query.post_processing[0]?.options?.n ?? query.row_limit;
          const all = Array.from({ length: total }, (_, index) => ({
            step_id: `S1-${index}`,
            session_id: 'S1',
            item_desc: `Step ${index}`,
            result: 'ok',
          }));
          if (query.orderby[1]?.[1] === false) all.reverse();
          return {
            data: ids.includes('S1')
              ? all.slice(offset, offset + (n ?? total))
              : [],
            colnames: ['step_id', 'session_id', 'item_desc', 'result'],
            coltypes: [1, 1, 1, 1],
          };
        }),
      };
    },
    { name: CHART_DATA_ENDPOINT },
  );
}

const TABBABLE = 'button, input, select, textarea, a[href], [tabindex]';

/** A Tab press: real keydown/keyup events, and the browser's default focus move when nothing prevents it. */
export async function pressTab(shift = false) {
  const active = (document.activeElement ?? document.body) as HTMLElement;
  const proceed = fireEvent.keyDown(active, {
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    shiftKey: shift,
  });
  if (proceed) {
    const current = (document.activeElement ?? document.body) as HTMLElement;
    const stops = [...document.querySelectorAll<HTMLElement>(TABBABLE)].filter(
      element =>
        element.tabIndex >= 0 &&
        !(element as HTMLButtonElement).disabled &&
        !element.closest(
          '[aria-hidden="true"],[hidden],.ag-hidden,.ag-paging-panel,.ag-tab-guard',
        ),
    );
    const after = (element: HTMLElement) =>
      Boolean(
        current.compareDocumentPosition(element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ) && !current.contains(element);
    const next = shift
      ? stops
          .filter(
            element =>
              !after(element) &&
              element !== current &&
              !element.contains(current),
          )
          .pop()
      : stops.find(after);
    next?.focus();
  }
  fireEvent.keyUp(document.activeElement ?? document.body, {
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    shiftKey: shift,
  });
  await tick();
}

export const stepsShown2 = {
  ...stepLevel,
  detail_fields: [],
  children_shown: 2,
};

export async function openFirst() {
  const [first] = await screen.findAllByRole('button', {
    name: /^Expand (?!all\b)/,
  });
  await userEvent.click(first);
}

export const parentCell = (
  container: HTMLElement,
  rowId: string,
  column: string,
) =>
  container
    .querySelector('.ag-grid-scrolling-container')!
    .querySelector<HTMLElement>(
      `:scope > [row-id="${rowId}"] [col-id="${column}"]`,
    )!;

/** Set nonzero scroll offsets and model the browser scrolling to an earlier toggle on focus. */
export function trackLoadMoreScroll(container: HTMLElement) {
  const viewport = container.querySelector<HTMLElement>('.ag-grid-viewport')!;
  const page = document.documentElement;
  viewport.scrollTop = 120;
  page.scrollTop = 240;
  const nativeFocus = HTMLElement.prototype.focus;
  const focus = jest
    .spyOn(HTMLElement.prototype, 'focus')
    .mockImplementation(function (this: HTMLElement, options?: FocusOptions) {
      if (
        this !== document.activeElement &&
        this.closest('.ag-cell') &&
        !options?.preventScroll
      ) {
        viewport.scrollTop = 0;
        page.scrollTop = 0;
      }
      nativeFocus.call(this, options);
    });
  return () => {
    expect([viewport.scrollTop, page.scrollTop]).toEqual([120, 240]);
    focus.mockRestore();
  };
}

// Four levels: Queue -> Agent -> Interaction ->
// Segment. Agent P works in both queues, so its interactions are matched by
// the whole path.
export const queueLevel = {
  key: 'queue',
  name: 'Queue',
  name_plural: 'Queues',
  id_column: 'queue',
  columns: ['queue'],
  detail_fields: [],
};

export const agentLevel = {
  key: 'agent',
  name: 'Agent',
  name_plural: 'Agents',
  id_column: 'agent',
  parent_column: 'queue',
  columns: ['agent'],
  detail_fields: [],
};

export const interactionLevel = {
  key: 'interaction',
  name: 'Interaction',
  name_plural: 'Interactions',
  id_column: 'interaction_id',
  parent_column: 'agent',
  columns: ['channel'],
  detail_fields: ['source_phone'],
};

export const segmentLevel = {
  key: 'segment',
  name: 'Segment',
  name_plural: 'Segments',
  id_column: 'segment_id',
  parent_column: 'interaction_id',
  columns: ['segment_no'],
  detail_fields: ['disposition'],
};

export const S4_LEVELS = [
  queueLevel,
  agentLevel,
  interactionLevel,
  segmentLevel,
];

export const SEGMENTS: Record<string, unknown>[] = [
  ['Q1', 'P', 'i1', 2],
  ['Q1', 'P', 'i2', 1],
  ['Q1', 'L', 'i4', 0],
  ['Q2', 'P', 'i3', 2],
].flatMap(([queue, agent, interaction, count]) => [
  ...Array.from({ length: count as number }, (_, index) => ({
    queue,
    agent,
    interaction_id: interaction,
    channel: `${interaction} voice`,
    source_phone: `${interaction} phone`,
    segment_id: `${interaction}-s${index}`,
    segment_no: `${interaction} no ${index}`,
    disposition: 'done',
  })),
  ...(count
    ? []
    : [
        {
          queue,
          agent,
          interaction_id: interaction,
          channel: `${interaction} voice`,
          source_phone: `${interaction} phone`,
          segment_id: null,
        },
      ]),
]);

type DeepQuery = {
  columns: string[];
  metrics: { column?: { column_name: string } }[];
  filters: { col: string; op: string; val?: unknown }[];
  orderby: [string, boolean][];
  post_processing: { options?: { groupby: string[]; n: number } }[];
  row_offset?: number;
  row_limit?: number;
};

/** Answer one children query from `SEGMENTS`, as the database would. */
function answerDeep(query: DeepQuery, table = SEGMENTS) {
  const rows = table.filter(row =>
    query.filters.every(filter => {
      if (filter.op === 'IN')
        return (filter.val as unknown[]).includes(row[filter.col]);
      if (filter.op === 'IS NOT NULL') return row[filter.col] != null;
      return true;
    }),
  );
  const tupleOf = (row: Record<string, unknown>, columns: string[]) =>
    JSON.stringify(columns.map(column => row[column]));
  const groups = new Map<string, Record<string, unknown>[]>();
  rows.forEach(row => {
    const key = tupleOf(row, query.columns);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  const pick = (row: Record<string, unknown>) =>
    Object.fromEntries(query.columns.map(column => [column, row[column]]));
  if (query.metrics.length) {
    const column = query.metrics[0].column!.column_name;
    return [...groups.values()].map(group => ({
      ...pick(group[0]),
      [`COUNT_DISTINCT(${column})`]: new Set(group.map(row => row[column]))
        .size,
    }));
  }
  const distinct = [...groups.values()].map(group => pick(group[0]));
  distinct.sort((a, b) => {
    for (const [column, ascending] of query.orderby) {
      if (a[column] === b[column]) continue;
      const order = String(a[column]) < String(b[column]) ? -1 : 1;
      return ascending ? order : -order;
    }
    return 0;
  });
  const options = query.post_processing[0]?.options;
  if (options) {
    const taken = new Map<string, number>();
    return distinct.filter(row => {
      const key = tupleOf(row, options.groupby);
      taken.set(key, (taken.get(key) ?? 0) + 1);
      return (taken.get(key) ?? 0) <= options.n;
    });
  }
  const offset = query.row_offset ?? 0;
  return distinct.slice(offset, offset + (query.row_limit ?? distinct.length));
}

export type DeepBody = { force: boolean; queries: DeepQuery[] };

export const deepLevelOf = (body: DeepBody) =>
  body.queries[0].filters.filter(filter => filter.op === 'IN').length;

let deepHold: Promise<void> | undefined;
let deepFailLevel: number | undefined;

export const failNextDeepLevel = (depth: number) => {
  deepFailLevel = depth;
};

export const holdDeep = () => {
  let release = () => {};
  deepHold = new Promise(resolve => {
    release = () => {
      deepHold = undefined;
      resolve();
    };
  });
  return () => act(async () => release());
};

export function routeDeep(table = SEGMENTS) {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    async ({ options }) => {
      const body = JSON.parse(options.body as string) as DeepBody;
      if (deepHold) await deepHold;
      if (deepFailLevel === deepLevelOf(body)) {
        deepFailLevel = undefined;
        return { status: 500, body: { message: 'failed' } };
      }
      return {
        result: body.queries.map(query => {
          const rows = answerDeep(query, table);
          const sqlRows = answerDeep(
            { ...query, post_processing: [] },
            table,
          ).length;
          return {
            data: rows,
            colnames: query.columns,
            coltypes: query.columns.map(() => GenericDataType.String),
            rowcount: rows.length,
            sql_rowcount: sqlRows,
          };
        }),
      };
    },
    { name: CHART_DATA_ENDPOINT },
  );
}

afterEach(() => {
  deepHold = undefined;
  deepFailLevel = undefined;
});

export const queueRows = [{ queue: 'Q1' }, { queue: 'Q2' }];

export const fourLevelProps = (
  extra: Partial<TreeTableTransformedProps> = {},
) =>
  props({
    height: 4000,
    levels: S4_LEVELS,
    data: queueRows,
    columns: [
      { key: 'queue', label: 'Queue', dataType: GenericDataType.String },
    ],
    colnames: ['queue'],
    coltypes: [GenericDataType.String],
    rowcount: 2,
    ...extra,
  });

/** The +/- button of the row with `text` in its own grid, at any depth. */
export const toggleOf = (text: string) => {
  const cell = screen
    .getAllByText(text)
    .map(element => element.closest<HTMLElement>('[role="row"]'))
    .find(Boolean)!;
  return cell.querySelector<HTMLElement>(
    '[col-id="tree_table_expand"] button',
  )!;
};

export const depthOf = (element: Element) => {
  let depth = 0;
  let row = element.closest('.ag-full-width-row');
  while (row) {
    depth += 1;
    row = row.parentElement?.closest('.ag-full-width-row') ?? null;
  }
  return depth;
};

export const keyboardLevels = [
  queueLevel,
  agentLevel,
  { ...interactionLevel, children_shown: 1 },
  { ...segmentLevel, children_shown: 1 },
];

export const deepKeyboardChart = (
  extra: Partial<TreeTableTransformedProps> = {},
) => (
  <>
    <button type="button">Before</button>
    <TreeTableChart {...fourLevelProps({ levels: keyboardLevels, ...extra })} />
    <button type="button">After</button>
  </>
);

/** Role, name and depth (0 = the parent grid or outside) of the focused element. */
export const describeDeep = () => {
  const element = focusedStop();
  if (!element || element === document.body) return 'BODY';
  const role = element.getAttribute('role') ?? element.tagName.toLowerCase();
  const name = (
    element.getAttribute('aria-label') ??
    (element.matches('.ag-full-width-row') ? 'area' : element.textContent) ??
    ''
  ).trim();
  return `${depthOf(element)} ${role} ${name}`;
};

/** The child grids of one level, in document order. */
export const gridsAtDepth = (container: HTMLElement, depth: number) =>
  [...container.querySelectorAll('[data-themed-ag-grid]')].filter(
    grid => depthOf(grid) === depth,
  );

/** Focus a +/- cell the way AG Grid does on a keyboard move. */
export const focusToggleCell = (button: HTMLElement) =>
  act(() => button.closest<HTMLElement>('[role="gridcell"]')!.focus());
