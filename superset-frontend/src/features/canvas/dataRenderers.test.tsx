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
import { render, screen } from 'spec/helpers/testing-library';
import CanvasGrid, { emptyScopeValues } from './CanvasGrid';
import { registerBuiltinRenderers } from './builtinRenderers';
import { CanvasDefinitionResult, CanvasSettings } from './types';
import type { CanvasLayout } from './useCanvasLayout';

/** Far more rows than the table's four grid rows can show at once. */
const ROW_COUNT = 60;

// The table's rows come from the server; the widget after it has none.
jest.mock('./useWidgetRows', () => ({
  ...jest.requireActual('./useWidgetRows'),
  useWidgetRows: ({ nodeId }: { nodeId: string }) =>
    nodeId === 'table'
      ? {
          rows: Array.from({ length: 60 }, (_, index) => ({
            country: `Country ${index + 1}`,
            revenue: (index + 1) * 1000,
          })),
          loading: false,
          query: 'SELECT country, revenue FROM sales',
          language: 'sql',
          datasource: '13__table',
        }
      : { rows: [], loading: false },
}));

const settings: CanvasSettings = {
  refresh: { interval: 0, stagger: 0, exempt: [] },
  colors: { labelColors: {} },
  display: { showTimestamps: false },
  crossFilters: { enabled: true },
};

const placements = {
  table: { col: 1, row: 1, colSpan: 24, rowSpan: 4 },
  after: { col: 1, row: 5, colSpan: 24, rowSpan: 2 },
};

/** A table in a fixed cell of four rows, with a widget right below it. */
const result: CanvasDefinitionResult = {
  version: 1,
  revision: 1,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['table', 'after'],
    },
    nodes: {
      table: {
        widgetType: 'ag-grid-table',
        schemaVersion: 1,
        props: {
          dataBinding: { datasetId: 13 },
          columnDefs: [
            { field: 'country', headerName: 'Country' },
            { field: 'revenue', headerName: 'Revenue' },
          ],
        },
        layout: {},
      },
      after: {
        widgetType: 'markdown',
        schemaVersion: 1,
        props: { content: 'Below the table' },
        layout: {},
      },
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings,
  },
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  eventScopes: {},
  placements,
  layouts: placements,
  childOrder: { root: ['table', 'after'] },
  widgetTypes: { table: 'ag-grid-table', after: 'markdown' },
  gridColumns: {},
  layoutConstraints: {},
  canEdit: false,
};

const layout: CanvasLayout = {
  placements: result.placements,
  layouts: result.layouts,
  childOrder: result.childOrder,
  layoutConstraints: result.layoutConstraints,
  revision: result.revision,
  saving: false,
  place: jest.fn(),
  move: jest.fn(),
  swap: jest.fn(),
  filterScopes: {},
  crossFilterScopes: {},
  customizationScopes: {},
  eventScopes: {},
  remove: jest.fn(),
  removed: new Set<string>(),
  dismissError: jest.fn(),
};

const renderTable = () => {
  registerBuiltinRenderers();
  const rendered = render(
    <CanvasGrid
      canvasId={1}
      result={result}
      values={emptyScopeValues()}
      onValueChange={jest.fn()}
      layout={layout}
      editable={false}
    />,
    { useRedux: true, useRouter: true },
  );
  const node = (nodeId: string) =>
    rendered.container.querySelector(
      `[data-node-id="${nodeId}"]`,
    ) as HTMLElement;
  const content = node('table').querySelector(
    ':scope > .canvas-interactive > .canvas-content',
  ) as HTMLElement;
  return { ...rendered, node, content };
};

test('a long table keeps to its cell and scrolls inside it', async () => {
  // Every row is rendered, unpaginated, and the widget's own content box is
  // what scrolls them: the table never grows its cell, so the widget after it
  // stays where it was placed rather than being pushed down or painted over.
  const { container, node, content } = renderTable();
  const table = content.querySelector('.ant-table') as HTMLElement;

  expect(
    content.querySelectorAll('.ant-table-tbody .ant-table-row'),
  ).toHaveLength(ROW_COUNT);
  expect(container.querySelector('.ant-pagination')).toBeNull();

  // The cell is the four rows it was given, and the next widget starts after.
  expect(getComputedStyle(node('table')).gridRow).toBe('1/span 4');
  expect(getComputedStyle(node('after')).gridRow).toBe('5/span 2');
  expect(node('table')).not.toContainElement(node('after'));
  // react-markdown is stubbed in tests (spec/helpers/shim.tsx) to echo its source.
  expect(await screen.findByText(/Below the table/)).toBeInTheDocument();

  // The content box fills the cell and scrolls; nothing between it and the
  // table claims the scrolling for itself.
  const contentStyle = getComputedStyle(content);
  expect(contentStyle.height).toBe('100%');
  expect(contentStyle.overflow).toBe('auto');
  // Its own stacking context, so the sticky header cannot outbid the handles.
  expect(contentStyle.isolation).toBe('isolate');
  let ancestor = table.parentElement;
  while (ancestor && ancestor !== content) {
    expect(['auto', 'scroll']).not.toContain(
      getComputedStyle(ancestor).overflowY ||
        getComputedStyle(ancestor).overflow,
    );
    ancestor = ancestor.parentElement;
  }
  expect(ancestor).toBe(content);
});

test("a long table's header stays put while its rows scroll", () => {
  // antd's sticky header, which holds to the top of the nearest scrolling
  // ancestor -- the widget's content box -- rather than to the page.
  const { content } = renderTable();
  const header = content.querySelector('.ant-table-header') as HTMLElement;

  expect(header).toHaveClass('ant-table-sticky-holder');
  expect(header).toHaveTextContent('Country');
  expect(header).toHaveTextContent('Revenue');
  // The header is its own block above the body, not the body's first row.
  expect(header.querySelector('.ant-table-tbody')).toBeNull();
  expect(content.querySelector('.ant-table-body, .ant-table-content')).not.toBe(
    null,
  );
});

test("a long table's menu stays outside the content that scrolls", () => {
  // Out of the content box, so the rows scroll under it rather than taking it
  // with them, and the sticky header cannot paint over it.
  const { node, content } = renderTable();
  const menu = screen.getByRole('button', { name: 'More Options' });
  const chrome = node('table').querySelector(
    ':scope > .canvas-interactive > .canvas-chrome',
  ) as HTMLElement;

  expect(chrome).toContainElement(menu);
  expect(content).not.toContainElement(menu);
});
