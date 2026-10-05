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
import CanvasGrid, { emptyScopeValues, ScopeValues } from './CanvasGrid';
import { CanvasDefinitionResult, CanvasSettings } from './types';

const settings: CanvasSettings = {
  refresh: { interval: 0, stagger: 0, exempt: [] },
  colors: { scheme: 'supersetColors', labelColors: { EMEA: '#123456' } },
  display: { showTimestamps: true },
  crossFilters: { enabled: true },
};

const result: CanvasDefinitionResult = {
  version: 1,
  revision: 3,
  definition: {
    version: 1,
    root: {
      layout: { columns: 24, gap: 16, rowUnit: 40 },
      children: ['f', 'g', 'lost', 'odd', 'unknown'],
    },
    nodes: {
      f: { instance: 'w-filter', layout: {} },
      g: { instance: 'w-group', layout: {}, children: ['c1'] },
      c1: {
        widget: 'test.chart',
        schemaVersion: 1,
        props: { title: 'Revenue' },
        layout: { colSpan: 6 },
      },
      lost: { instance: 'w-gone', layout: {} },
      odd: { instance: 'w-odd', layout: {} },
      unknown: { instance: 'w-unknown', layout: {} },
    },
    interactions: { filters: {}, crossFilters: {}, customizations: {} },
    settings,
  },
  filterScopes: { f: ['c1'] },
  crossFilterScopes: { odd: ['c1'] },
  customizationScopes: {},
  placements: {
    f: { col: 1, row: 1, colSpan: 24, rowSpan: 1 },
    g: { col: 1, row: 2, colSpan: 24, rowSpan: 4 },
    lost: { col: 1, row: 6, colSpan: 12, rowSpan: 1 },
    odd: { col: 13, row: 6, colSpan: 12, rowSpan: 1 },
    unknown: { col: 1, row: 7, colSpan: 24, rowSpan: 1 },
    c1: { col: 1, row: 1, colSpan: 6, rowSpan: 1 },
  },
  widgetTypes: {
    f: 'test.filter',
    g: 'test.group',
    c1: 'test.chart',
    odd: 'test.odd',
    unknown: 'test.unknown',
  },
  gridColumns: { g: 12 },
};

const Chart = ({
  props,
  filters,
  crossFilters,
  colors,
  showTimestamp,
  refreshKey,
}: canvasApi.CanvasWidgetProps) => (
  <div>
    <span>{`chart ${props?.title} filters=${JSON.stringify(filters)}`}</span>
    <span>{`cross=${JSON.stringify(crossFilters)}`}</span>
    <span>{`colors=${colors.scheme} timestamp=${showTimestamp} refresh=${refreshKey}`}</span>
  </div>
);
const CrossSource = ({ setCrossFilter }: canvasApi.CanvasWidgetProps) => (
  <button type="button" onClick={() => setCrossFilter('France')}>
    cross filter
  </button>
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
  canvas.registerWidgetRenderer('test.odd', CrossSource),
];

const renderGrid = (
  values: ScopeValues = emptyScopeValues(),
  onValueChange = jest.fn(),
  gridResult: CanvasDefinitionResult = result,
) =>
  render(
    <CanvasGrid
      canvasId={7}
      result={gridResult}
      values={values}
      onValueChange={onValueChange}
      refreshKeys={{ c1: 2 }}
    />,
  );
afterAll(() => registrations.forEach(registration => registration.dispose()));

test('renders widgets through their renderers, nested in grid containers', () => {
  renderGrid();

  expect(screen.getByRole('region', { name: 'group' })).toHaveTextContent(
    'chart Revenue filters=[]',
  );
  expect(
    screen.getByText('colors=supersetColors timestamp=true refresh=2'),
  ).toBeInTheDocument();
});

test('shows placeholders for unavailable widgets and unregistered types', () => {
  renderGrid();

  expect(screen.getByText('This widget is unavailable')).toBeInTheDocument();
  expect(
    screen.getByText('No renderer for widget type "test.unknown"'),
  ).toBeInTheDocument();
});

test('filter values reach the nodes in the filter scope', () => {
  const onValueChange = jest.fn();
  renderGrid({ ...emptyScopeValues(), filter: { f: 'EMEA' } }, onValueChange);

  expect(
    screen.getByText(
      'chart Revenue filters=[{"filterNodeId":"f","value":"EMEA"}]',
    ),
  ).toBeInTheDocument();

  screen.getByRole('button', { name: 'set filter' }).click();

  expect(onValueChange).toHaveBeenCalledWith('filter', 'f', 'EMEA');
});

test('cross-filter values reach the nodes in the source scope', () => {
  const onValueChange = jest.fn();
  renderGrid(
    { ...emptyScopeValues(), crossFilter: { odd: 'France' } },
    onValueChange,
  );

  expect(
    screen.getByText('cross=[{"filterNodeId":"odd","value":"France"}]'),
  ).toBeInTheDocument();
  screen.getByRole('button', { name: 'cross filter' }).click();
  expect(onValueChange).toHaveBeenCalledWith('crossFilter', 'odd', 'France');
});

test('setting a cross-filter does nothing while cross-filters are off', () => {
  const onValueChange = jest.fn();
  const off: CanvasDefinitionResult = {
    ...result,
    definition: {
      ...result.definition,
      settings: { ...settings, crossFilters: { enabled: false } },
    },
  };
  renderGrid(emptyScopeValues(), onValueChange, off);

  screen.getByRole('button', { name: 'cross filter' }).click();

  expect(onValueChange).not.toHaveBeenCalled();
});
