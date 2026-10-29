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
import { render } from '../../../../spec/helpers/testing-library';
import EchartsTreemap from '../../src/Treemap/EchartsTreemap';
import Echart from '../../src/components/Echart';
import { EventHandlers, TreePathInfo } from '../../src/types';
import {
  EchartsTreemapFormData,
  TreemapTransformedProps,
} from '../../src/Treemap/types';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const renderTreemap = (
  onContextMenu?: jest.Mock,
): { eventHandlers: EventHandlers } => {
  mockedEchart.mockClear();

  const props: TreemapTransformedProps = {
    echartOptions: {},
    formData: {
      groupby: ['country', 'state'],
      dateFormat: 'smart_date',
      numberFormat: 'SMART_NUMBER',
      vizType: 'treemap',
    } as unknown as EchartsTreemapFormData,
    height: 400,
    width: 400,
    refs: {},
    groupby: ['country', 'state'],
    labelMap: { 'USA,CA': ['USA', 'CA'] },
    selectedValues: {},
    setDataMask: jest.fn(),
    emitCrossFilters: false,
    coltypeMapping: {},
    onContextMenu,
  };

  render(<EchartsTreemap {...props} />);

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers };
};

test('right-clicking a treemap node drills to detail for its groupby path', () => {
  const onContextMenu = jest.fn();
  const { eventHandlers } = renderTreemap(onContextMenu);

  const treePathInfo: TreePathInfo[] = [
    { name: 'sum__num', dataIndex: 0, value: 100 },
    { name: 'USA', dataIndex: 1, value: 60 },
    { name: 'CA', dataIndex: 2, value: 40 },
  ];
  const stop = jest.fn();

  eventHandlers.contextmenu({
    data: { name: 'CA', value: 40 },
    treePathInfo,
    event: {
      stop,
      event: { clientX: 50, clientY: 80 },
    },
  });

  expect(stop).toHaveBeenCalledTimes(1);
  expect(onContextMenu).toHaveBeenCalledTimes(1);
  const [x, y, payload] = onContextMenu.mock.calls[0];
  expect(x).toBe(50);
  expect(y).toBe(80);
  expect(payload.drillToDetail).toEqual([
    { col: 'country', op: '==', val: 'USA', formattedVal: 'USA' },
    { col: 'state', op: '==', val: 'CA', formattedVal: 'CA' },
  ]);
  expect(payload.drillBy).toEqual({
    filters: [
      { col: 'country', op: '==', val: 'USA', formattedVal: 'USA' },
      { col: 'state', op: '==', val: 'CA', formattedVal: 'CA' },
    ],
    groupbyFieldName: 'groupby',
  });
});

test('right-clicking the root node does not call onContextMenu', () => {
  const onContextMenu = jest.fn();
  const { eventHandlers } = renderTreemap(onContextMenu);

  const treePathInfo: TreePathInfo[] = [
    { name: 'sum__num', dataIndex: 0, value: 100 },
  ];

  eventHandlers.contextmenu({
    data: { name: 'sum__num', value: 100, children: [] },
    treePathInfo,
    event: {
      stop: jest.fn(),
      event: { clientX: 50, clientY: 80 },
    },
  });

  expect(onContextMenu).not.toHaveBeenCalled();
});
