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
import { render } from '@testing-library/react';
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Sankey from '../../src/Sankey/Sankey';
import transformProps from '../../src/Sankey/transformProps';
import { SankeyChartProps } from '../../src/Sankey/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';
import {
  sankeyLinkKey,
  SankeyLinkDatum,
  SankeyNodeDatum,
} from '../../src/Sankey/crossFilter';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const data = [
  { source: 'A', target: 'B', value: 10 },
  { source: 'B', target: 'C', value: 5 },
];

function setup(
  overrides: {
    emitCrossFilters?: boolean;
    selectedValues?: string[];
  } = {},
) {
  const onContextMenu = jest.fn();
  const setDataMask = jest.fn();
  const chartProps = new ChartProps({
    formData: {
      datasource: '1__table',
      viz_type: 'sankey_v2',
      source: 'source',
      target: 'target',
      metric: 'value',
    },
    width: 800,
    height: 600,
    queriesData: [{ data }],
    theme: supersetTheme,
    hooks: { onContextMenu, setDataMask },
    emitCrossFilters: overrides.emitCrossFilters ?? true,
    filterState: { selectedValues: overrides.selectedValues },
  });
  const transformed = transformProps(chartProps as SankeyChartProps);
  render(<Sankey {...transformed} />);
  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  const series = transformed.echartOptions.series as {
    data: SankeyNodeDatum[];
    links: SankeyLinkDatum[];
  };
  return {
    eventHandlers,
    onContextMenu,
    setDataMask,
    nodeB: series.data.find(node => node.name === 'B') as SankeyNodeDatum,
    linkBC: series.links.find(link => link.target === 'C') as SankeyLinkDatum,
  };
}

const pointerEvent = {
  stop: jest.fn(),
  event: { clientX: 10, clientY: 20 } as PointerEvent,
};

beforeEach(() => {
  mockedEchart.mockClear();
});

test('clicking a node emits a filter and a second click clears it', () => {
  const { eventHandlers, setDataMask, nodeB } = setup();

  eventHandlers.click({ data: nodeB });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [{ col: 'target', op: 'IN', val: ['B'] }],
      },
    }),
  );

  const selected = setDataMask.mock.calls[0][0].filterState
    .selectedValues as string[];
  mockedEchart.mockClear();
  const next = setup({ selectedValues: selected });
  next.eventHandlers.click({ data: next.nodeB });

  expect(next.setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: { filters: [] },
      filterState: {
        label: null,
        value: null,
        selectedValues: null,
      },
    }),
  );
});

test('clicking a link filters both of its columns', () => {
  const { eventHandlers, setDataMask, linkBC } = setup();

  eventHandlers.click({ data: linkBC });

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [
          { col: 'source', op: 'IN', val: ['B'] },
          { col: 'target', op: 'IN', val: ['C'] },
        ],
      },
      filterState: expect.objectContaining({
        label: 'B → C',
        selectedValues: [sankeyLinkKey('B', 'C')],
      }),
    }),
  );
});

test('click does nothing when the chart does not emit cross filters', () => {
  const { eventHandlers, setDataMask, nodeB } = setup({
    emitCrossFilters: false,
  });

  eventHandlers.click({ data: nodeB });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('the context menu drills a node by the column that owns it', () => {
  const { eventHandlers, onContextMenu, nodeB } = setup();

  eventHandlers.contextmenu({ data: nodeB, event: pointerEvent });

  expect(onContextMenu).toHaveBeenCalledWith(10, 20, {
    drillToDetail: [{ col: 'target', op: '==', val: 'B', formattedVal: 'B' }],
    crossFilter: expect.objectContaining({
      isCurrentValueSelected: false,
    }),
    drillBy: {
      filters: [{ col: 'target', op: '==', val: 'B', formattedVal: 'B' }],
      groupbyFieldName: 'target',
    },
  });
});

test('the context menu drills a link to both columns', () => {
  const { eventHandlers, onContextMenu, linkBC } = setup();

  eventHandlers.contextmenu({ data: linkBC, event: pointerEvent });

  const payload = onContextMenu.mock.calls[0][2];
  expect(payload.drillToDetail).toEqual([
    { col: 'source', op: '==', val: 'B', formattedVal: 'B' },
    { col: 'target', op: '==', val: 'C', formattedVal: 'C' },
  ]);
  expect(payload.drillBy).toBeUndefined();
});
