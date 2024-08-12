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
import newEntitiesFromDrop from 'src/dashboard/util/newEntitiesFromDrop';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';

describe('newEntitiesFromDrop', () => {
  it('should return a new Entity of appropriate type, and add it to the drop target children', () => {
    const result = newEntitiesFromDrop({
      dropResult: {
        destination: { id: 'a', index: 0 },
        dragging: { type: CHART_TYPE },
        source: { id: 'b', index: 0 },
      },
      layout: {
        a: {
          id: 'a',
          type: ROW_TYPE,
          children: [],
        },
      },
    });

    const newId = result.a.children[0];
    expect(result.a.children).toHaveLength(1);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result[newId].type).toBe(CHART_TYPE);
  });

  it('should create Tab AND Tabs components if the drag entity is Tabs', () => {
    const result = newEntitiesFromDrop({
      dropResult: {
        destination: { id: 'a', index: 0 },
        dragging: { type: TABS_TYPE },
        source: { id: 'b', index: 0 },
      },
      layout: {
        a: {
          id: 'a',
          type: DASHBOARD_GRID_TYPE,
          children: [],
        },
      },
    });

    const newTabsId = result.a.children[0];
    const newTabId = result[newTabsId].children[0];

    expect(result.a.children).toHaveLength(1);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result[newTabsId].type).toBe(TABS_TYPE);
    expect(result[newTabId].type).toBe(TAB_TYPE);
  });

  it('should create a Row if the drag entity should be wrapped in a row', () => {
    const result = newEntitiesFromDrop({
      dropResult: {
        destination: { id: 'a', index: 0 },
        dragging: { type: CHART_TYPE },
        source: { id: 'b', index: 0 },
      },
      layout: {
        a: {
          id: 'a',
          type: DASHBOARD_GRID_TYPE,
          children: [],
        },
      },
    });

    const newRowId = result.a.children[0];
    const newChartId = result[newRowId].children[0];

    expect(result.a.children).toHaveLength(1);
    expect(Object.keys(result)).toHaveLength(3);
    const newRow = result[newRowId];
    expect(newRow.type).toBe(ROW_TYPE);
    expect(newRow.parents).toEqual(['a']);
    const newChart = result[newChartId];
    expect(newChart.type).toBe(CHART_TYPE);
    expect(newChart.parents).toEqual(['a', newRowId]);
  });
});
