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
import type { canvas as canvasApi } from '@apache-superset/core';
import { render, screen } from 'spec/helpers/testing-library';
import { canvas } from 'src/core';
import CanvasGrid from './CanvasGrid';
import { CanvasDefinitionResult } from './types';

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 3,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['f', 'g', 'lost', 'odd'],
    },
    nodes: {
      f: { widget: 'w-filter', layout: {} },
      g: { widget: 'w-group', layout: {}, children: ['c1'] },
      c1: { widget: 'w-chart', layout: { colSpan: 6 } },
      lost: { widget: 'w-gone', layout: {} },
      odd: { widget: 'w-odd', layout: {} },
    },
    interactions: { filters: {} },
  },
  filterScopes: { f: ['c1'] },
  placements: {
    f: { col: 1, row: 1, colSpan: 24, rowSpan: 1 },
    g: { col: 1, row: 2, colSpan: 24, rowSpan: 4 },
    lost: { col: 1, row: 6, colSpan: 12, rowSpan: 1 },
    odd: { col: 13, row: 6, colSpan: 12, rowSpan: 1 },
    c1: { col: 1, row: 1, colSpan: 6, rowSpan: 1 },
  },
  widgetTypes: {
    f: 'test.filter',
    g: 'test.group',
    c1: 'test.chart',
    odd: 'test.odd',
  },
  gridColumns: { g: 12 },
};

const Chart = ({ widgetId, filters }: canvasApi.CanvasWidgetProps) => (
  <div>{`chart ${widgetId} filters=${JSON.stringify(filters)}`}</div>
);
const Filter = ({ setFilterValue }: canvasApi.CanvasWidgetProps) => (
  <button type="button" onClick={() => setFilterValue('EMEA')}>
    set filter
  </button>
);
const Group = ({ renderGrid }: canvasApi.CanvasWidgetProps) => (
  <section aria-label="group">{renderGrid()}</section>
);

const registrations = [
  canvas.registerWidgetRenderer('test.chart', Chart),
  canvas.registerWidgetRenderer('test.filter', Filter),
  canvas.registerWidgetRenderer('test.group', Group),
];
afterAll(() => registrations.forEach(registration => registration.dispose()));

test('renders widgets through their renderers, nested in grid containers', () => {
  render(
    <CanvasGrid
      canvasId={7}
      result={result}
      filterValues={{}}
      onFilterChange={jest.fn()}
    />,
  );

  expect(screen.getByRole('region', { name: 'group' })).toHaveTextContent(
    'chart w-chart filters=[]',
  );
});

test('shows placeholders for unavailable widgets and unknown types', () => {
  render(
    <CanvasGrid
      canvasId={7}
      result={result}
      filterValues={{}}
      onFilterChange={jest.fn()}
    />,
  );

  expect(screen.getByText('This widget is unavailable')).toBeInTheDocument();
  expect(
    screen.getByText('No renderer for widget type "test.odd"'),
  ).toBeInTheDocument();
});

test('filter values reach the nodes in the filter scope', () => {
  const onFilterChange = jest.fn();
  render(
    <CanvasGrid
      canvasId={7}
      result={result}
      filterValues={{ f: 'EMEA' }}
      onFilterChange={onFilterChange}
    />,
  );

  expect(
    screen.getByText(
      'chart w-chart filters=[{"filterNodeId":"f","value":"EMEA"}]',
    ),
  ).toBeInTheDocument();

  screen.getByRole('button', { name: 'set filter' }).click();

  expect(onFilterChange).toHaveBeenCalledWith('f', 'EMEA');
});
