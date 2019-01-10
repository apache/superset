import { expect } from 'chai';

import newEntitiesFromDrop from '../../../../src/dashboard/util/newEntitiesFromDrop';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

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
    expect(result.a.children.length).to.equal(1);
    expect(Object.keys(result).length).to.equal(2);
    expect(result[newId].type).to.equal(CHART_TYPE);
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

    expect(result.a.children.length).to.equal(1);
    expect(Object.keys(result).length).to.equal(3);
    expect(result[newTabsId].type).to.equal(TABS_TYPE);
    expect(result[newTabId].type).to.equal(TAB_TYPE);
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

    expect(result.a.children.length).to.equal(1);
    expect(Object.keys(result).length).to.equal(3);
    expect(result[newRowId].type).to.equal(ROW_TYPE);
    expect(result[newChartId].type).to.equal(CHART_TYPE);
  });
});
