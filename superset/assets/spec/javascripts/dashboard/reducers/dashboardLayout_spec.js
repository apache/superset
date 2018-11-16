import layoutReducer from '../../../../src/dashboard/reducers/dashboardLayout';

import {
  UPDATE_COMPONENTS,
  DELETE_COMPONENT,
  CREATE_COMPONENT,
  MOVE_COMPONENT,
  CREATE_TOP_LEVEL_TABS,
  DELETE_TOP_LEVEL_TABS,
} from '../../../../src/dashboard/actions/dashboardLayout';

import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
  NEW_COMPONENTS_SOURCE_ID,
  NEW_TABS_ID,
  NEW_ROW_ID,
} from '../../../../src/dashboard/util/constants';

describe('dashboardLayout reducer', () => {
  it('should return initial state for unrecognized actions', () => {
    expect(layoutReducer(undefined, {})).toEqual({});
  });

  it('should delete a component, remove its reference in its parent, and recursively all of its children', () => {
    expect(
      layoutReducer(
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

  it('should delete a parent if the parent was a row and no longer has children', () => {
    expect(
      layoutReducer(
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

  it('should update components', () => {
    expect(
      layoutReducer(
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

  it('should move a component', () => {
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
      layoutReducer(layout, {
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

  it('should wrap a moved component in a row if need be', () => {
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

    const result = layoutReducer(layout, {
      type: MOVE_COMPONENT,
      payload: { dropResult },
    });

    const newRow = Object.values(result).find(
      component =>
        ['source', 'destination', 'toMove'].indexOf(component.id) === -1,
    );

    expect(newRow.children[0]).toBe('toMove');
    expect(result.destination.children[0]).toBe(newRow.id);
    expect(Object.keys(result)).toHaveLength(4);
  });

  it('should add top-level tabs from a new tabs component, moving grid children to new tab', () => {
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

    const result = layoutReducer(layout, {
      type: CREATE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    const tabComponent = Object.values(result).find(
      component => component.type === TAB_TYPE,
    );

    const tabsComponent = Object.values(result).find(
      component => component.type === TABS_TYPE,
    );

    expect(Object.keys(result)).toHaveLength(5); // initial + Tabs + Tab
    expect(result[DASHBOARD_ROOT_ID].children[0]).toBe(tabsComponent.id);
    expect(result[tabsComponent.id].children[0]).toBe(tabComponent.id);
    expect(result[tabComponent.id].children[0]).toBe('child');
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(0);
  });

  it('should add top-level tabs from an existing tabs component, moving grid children to new tab', () => {
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

    const result = layoutReducer(layout, {
      type: CREATE_TOP_LEVEL_TABS,
      payload: { dropResult },
    });

    expect(Object.keys(result)).toHaveLength(Object.keys(layout).length);
    expect(result[DASHBOARD_ROOT_ID].children[0]).toBe('tabs');
    expect(result.tabs.children[0]).toBe('tab');
    expect(result.tab.children).toEqual(['child', 'child2']);
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(0);
  });

  it('should remove top-level tabs, moving children to the grid', () => {
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

    const result = layoutReducer(layout, {
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
      },
      child: {
        id: 'child',
        children: [],
      },
      child2: {
        id: 'child2',
        children: [],
      },
    });
  });

  it('should create a component', () => {
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

    const result = layoutReducer(layout, {
      type: CREATE_COMPONENT,
      payload: { dropResult },
    });

    const newId = result[DASHBOARD_GRID_ID].children[1];
    expect(result[DASHBOARD_GRID_ID].children).toHaveLength(2);
    expect(result[newId].type).toBe(ROW_TYPE);
  });
});
