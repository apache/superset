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
import layoutReducer, {
  recursivelyDeleteChildren,
} from 'src/dashboard/reducers/dashboardLayout';

import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  MOVE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
} from 'src/dashboard/actions/dashboardLayout';

import type { DashboardLayout } from 'src/dashboard/types';

import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';

import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  NEW_COMPONENTS_SOURCE_ID,
  NEW_TABS_ID,
  NEW_ROW_ID,
} from 'src/dashboard/util/constants';

// Cast reducer to accept partial mock data in tests
const testReducer = layoutReducer as (
  state: any,
  action: any,
) => DashboardLayout;

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('dashboardLayout reducer', () => {
  test('should return initial state for unrecognized actions', () => {
    expect(testReducer(undefined, {})).toEqual({});
  });

  test('should delete a component, remove its reference in its parent, and recursively all of its children', () => {
    expect(
      testReducer(
        {
          toDelete: {
            id: 'toDelete',
            children: ['child1'],
          },
          child1: {
            id: 'child1',
            children: ['child2'],
          },
          child2: {
            id: 'child2',
            children: [],
          },
          parentId: {
            id: 'parentId',
            type: ROW_TYPE,
            children: ['toDelete', 'anotherId'],
          },
        },
        {
          type: DELETE_COMPONENT,
          payload: { id: 'toDelete', parentId: 'parentId' },
        },
      ),
    ).toEqual({
      parentId: {
        id: 'parentId',
        children: ['anotherId'],
        type: ROW_TYPE,
      },
    });
  });

  test('should delete a parent if the parent was a row and no longer has children', () => {
    expect(
      testReducer(
        {
          grandparentId: {
            id: 'grandparentId',
            children: ['parentId'],
          },
          parentId: {
            id: 'parentId',
            type: ROW_TYPE,
            children: ['toDelete'],
          },
          toDelete: {
            id: 'toDelete',
            children: ['child1'],
          },
          child1: {
            id: 'child1',
            children: [],
          },
        },
        {
          type: DELETE_COMPONENT,
          payload: { id: 'toDelete', parentId: 'parentId' },
        },
      ),
    ).toEqual({
      grandparentId: {
        id: 'grandparentId',
        children: [],
      },
    });
  });

  test('should update components', () => {
    expect(
      testReducer(
        {
          update: {
            id: 'update',
            children: [],
          },
          update2: {
            id: 'update2',
            children: [],
          },
          dontUpdate: {
            id: 'dontUpdate',
            something: 'something',
            children: ['abcd'],
          },
        },
        {
          type: UPDATE_COMPONENTS,
          payload: {
            nextComponents: {
              update: {
                id: 'update',
                newField: 'newField',
              },
              update2: {
                id: 'update2',
                newField: 'newField',
              },
            },
          },
        },
      ),
    ).toEqual({
      update: {
        id: 'update',
        newField: 'newField',
      },
      update2: {
        id: 'update2',
        newField: 'newField',
      },
      dontUpdate: {
        id: 'dontUpdate',
        something: 'something',
        children: ['abcd'],
      },
    });
  });

  test('should move a component', () => {
    const layout = {
      source: {
        id: 'source',
        type: ROW_TYPE,
        children: ['dontMove', 'toMove'],
      },
      destination: {
        id: 'destination',
        type: ROW_TYPE,
        children: ['anotherChild'],
      },
      toMove: {
        id: 'toMove',
        type: CHART_TYPE,
        children: [],
      },
    };

    const dropResult = {
      source: { id: 'source', type: ROW_TYPE, index: 1 },
      destination: { id: 'destination', type: ROW_TYPE, index: 0 },
      dragging: { id: 'toMove', type: CHART_TYPE },
    };

    expect(
      testReducer(layout, {
        type: MOVE_COMPONENT,
        payload: { dropResult },
      }),
    ).toEqual({
      source: {
        id: 'source',
        type: ROW_TYPE,
        children: ['dontMove'],
      },
      destination: {
        id: 'destination',
        type: ROW_TYPE,
        children: ['toMove', 'anotherChild'],
      },
      toMove: {
        id: 'toMove',
        type: CHART_TYPE,
        children: [],
      },
    });
  });

  test('should wrap a moved component in a row if need be', () => {
    const layout = {
      source: {
        id: 'source',
        type: ROW_TYPE,
        children: ['dontMove', 'toMove'],
      },
      destination: {
        id: 'destination',
        type: DASHBOARD_GRID_TYPE,
        children: [],
      },
      toMove: {
        id: 'toMove',
        type: CHART_TYPE,
        children: [],
      },
    };

    const dropResult = {
      source: { id: 'source', type: ROW_TYPE, index: 1 },
      destination: { id: 'destination', type: DASHBOARD_GRID_TYPE, index: 0 },
      dragging: { id: 'toMove', type: CHART_TYPE },
    };

    const result = testReducer(layout, {
      type: MOVE_COMPONENT,
      payload: { dropResult },
    });

    const newRow = Object.values(result).find(
      component =>
        ['source', 'destination', 'toMove'].indexOf(component.id) === -1,
    )!;

    expect(newRow.children[0]).toBe('toMove');
    expect(result.destination.children[0]).toBe(newRow.id);
    expect(Object.keys(result)).toHaveLength(4);
  });

  test('should add top-level tabs from a new tabs component, moving grid children to new tab', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        children: [DASHBOARD_GRID_ID],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        children: ['child'],
      },
      child: {
        id: 'child',
        children: [],
      },
    };

    const dropResult = {
      source: { id: NEW_COMPONENTS_SOURCE_ID, type: '' },
      destination: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        index: 0,
      },
      dragging: { id: NEW_TABS_ID, type: TABS_TYPE },
    };

    const result = testReducer(layout, {
      type: CREATE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    const tabComponent = Object.values(result).find(
      component => component.type === TAB_TYPE,
    )!;

    const tabsComponent = Object.values(result).find(
      component => component.type === TABS_TYPE,
    )!;

    expect(Object.keys(result)).toHaveLength(5); // initial + Tabs + Tab
    expect(result[DASHBOARD_ROOT_ID].children[0]).toBe(tabsComponent.id);
    expect(result[tabsComponent.id].children[0]).toBe(tabComponent.id);
    expect(result[tabComponent.id].children[0]).toBe('child');
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(0);
  });

  test('should add top-level tabs from an existing tabs component, moving grid children to new tab', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        children: [DASHBOARD_GRID_ID],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        children: ['child', 'tabs', 'child2'],
      },
      child: {
        id: 'child',
        children: [],
      },
      child2: {
        id: 'child2',
        children: [],
      },
      tabs: {
        id: 'tabs',
        type: TABS_TYPE,
        children: ['tab'],
      },
      tab: {
        id: 'tab',
        type: TAB_TYPE,
        children: [],
      },
    };

    const dropResult = {
      source: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE, index: 1 },
      destination: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        index: 0,
      },
      dragging: { id: 'tabs', type: TABS_TYPE },
    };

    const result = testReducer(layout, {
      type: CREATE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    expect(Object.keys(result)).toHaveLength(Object.keys(layout).length);
    expect(result[DASHBOARD_ROOT_ID].children[0]).toBe('tabs');
    expect(result.tabs.children[0]).toBe('tab');
    expect(result.tab.children).toEqual(['child', 'child2']);
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(0);
  });

  test('should remove top-level tabs, moving children to the grid', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        children: ['tabs'],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        children: [],
      },
      child: {
        id: 'child',
        children: [],
      },
      child2: {
        id: 'child2',
        children: [],
      },
      tabs: {
        id: 'tabs',
        type: TABS_TYPE,
        children: ['tab'],
      },
      tab: {
        id: 'tab',
        type: TAB_TYPE,
        children: ['child', 'child2'],
      },
    };

    const dropResult = {
      source: { id: DASHBOARD_GRID_ID, type: DASHBOARD_GRID_TYPE, index: 1 },
      destination: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        index: 0,
      },
      dragging: { id: 'tabs', type: TABS_TYPE },
    };

    const result = testReducer(layout, {
      type: DELETE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    expect(result).toEqual({
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        children: [DASHBOARD_GRID_ID],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        children: ['child', 'child2'],
        parents: [DASHBOARD_ROOT_ID],
      },
      child: {
        id: 'child',
        children: [],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      },
      child2: {
        id: 'child2',
        children: [],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      },
    });
  });

  test('should create a component', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        children: [DASHBOARD_GRID_ID],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        children: ['child'],
      },
      child: { id: 'child' },
    };

    const dropResult = {
      source: { id: NEW_COMPONENTS_SOURCE_ID, type: '' },
      destination: {
        id: DASHBOARD_GRID_ID,
        type: DASHBOARD_GRID_TYPE,
        index: 1,
      },
      dragging: { id: NEW_ROW_ID, type: ROW_TYPE },
    };

    const result = testReducer(layout, {
      type: CREATE_COMPONENT,
      payload: { dropResult },
    });

    const newId = result[DASHBOARD_GRID_ID].children[1];
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(2);
    expect(result[newId].type).toBe(ROW_TYPE);
  });

  test('should update parents array when creating top-level tabs', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        children: [DASHBOARD_GRID_ID],
        parents: [],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        type: DASHBOARD_GRID_TYPE,
        children: ['row1'],
        parents: [DASHBOARD_ROOT_ID],
      },
      row1: {
        id: 'row1',
        type: ROW_TYPE,
        children: ['chart1'],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      },
      chart1: {
        id: 'chart1',
        type: CHART_TYPE,
        children: [],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'row1'],
      },
    };

    const dropResult = {
      source: { id: NEW_COMPONENTS_SOURCE_ID, type: '' },
      destination: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        index: 0,
      },
      dragging: { id: NEW_TABS_ID, type: TABS_TYPE },
    };

    const result = testReducer(layout, {
      type: CREATE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    const tabComponent = Object.values(result).find(
      component => component.type === TAB_TYPE,
    )!;

    // Verify parents are updated for moved components
    expect(result.row1.parents).toContain(tabComponent.id);
    expect(result.chart1.parents).toContain(tabComponent.id);
  });

  test('should update parents array when moving a component', () => {
    const layout = {
      [DASHBOARD_ROOT_ID]: {
        id: DASHBOARD_ROOT_ID,
        type: DASHBOARD_ROOT_TYPE,
        children: [DASHBOARD_GRID_ID],
        parents: [],
      },
      [DASHBOARD_GRID_ID]: {
        id: DASHBOARD_GRID_ID,
        type: DASHBOARD_GRID_TYPE,
        children: ['row1', 'row2'],
        parents: [DASHBOARD_ROOT_ID],
      },
      row1: {
        id: 'row1',
        type: ROW_TYPE,
        children: ['chart1'],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      },
      row2: {
        id: 'row2',
        type: ROW_TYPE,
        children: [],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID],
      },
      chart1: {
        id: 'chart1',
        type: CHART_TYPE,
        children: [],
        parents: [DASHBOARD_ROOT_ID, DASHBOARD_GRID_ID, 'row1'],
      },
    };

    const dropResult = {
      source: { id: 'row1', type: ROW_TYPE, index: 0 },
      destination: { id: 'row2', type: ROW_TYPE, index: 0 },
      dragging: { id: 'chart1', type: CHART_TYPE },
    };

    const result = testReducer(layout, {
      type: MOVE_COMPONENT,
      payload: { dropResult },
    });

    // Chart should now have row2 as parent instead of row1
    expect(result.chart1.parents).toContain('row2');
    expect(result.chart1.parents).not.toContain('row1');
  });

  test('recursivelyDeleteChildren should be error proof with bad inputs', () => {
    /*
     ** The recursivelyDeleteChildren function was missing runtime safety checks before operating
     ** on sub properties of object causing runtime errors when a componentId lookup returned and unexpected value
     ** These test are to ensure this function is fault tolerant if provided any bad values while recursively looping
     ** through the data structure of
     */
    const componentId = '123';
    const componentParentId = '456';
    // Testing fault tolerance with intentionally invalid input (array instead of object)
    const nextComponents = [] as unknown as Parameters<
      typeof recursivelyDeleteChildren
    >[2];
    expect(() => {
      recursivelyDeleteChildren(componentId, componentParentId, nextComponents);
    }).not.toThrow();

    expect(() => {
      // Testing fault tolerance with intentionally invalid inputs
      recursivelyDeleteChildren(
        null as unknown as string,
        null as unknown as string,
        null as unknown as Parameters<typeof recursivelyDeleteChildren>[2],
      );
    }).not.toThrow();
  });
});
