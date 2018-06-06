import { describe, it } from 'mocha';
import { expect } from 'chai';

import findFirstParentContainerId from '../../../../src/dashboard/util/findFirstParentContainer';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_ROOT_ID,
} from '../../../../src/dashboard/util/constants';

describe('findFirstParentContainer', () => {
  const mockGridLayout = {
    DASHBOARD_VERSION_KEY: 'v2',
    DASHBOARD_ROOT_ID: {
      type: 'DASHBOARD_ROOT_TYPE',
      id: 'DASHBOARD_ROOT_ID',
      children: ['DASHBOARD_GRID_ID'],
    },
    DASHBOARD_GRID_ID: {
      type: 'DASHBOARD_GRID_TYPE',
      id: 'DASHBOARD_GRID_ID',
      children: ['DASHBOARD_ROW_TYPE-Bk45URrlQ'],
    },
    'DASHBOARD_ROW_TYPE-Bk45URrlQ': {
      type: 'DASHBOARD_ROW_TYPE',
      id: 'DASHBOARD_ROW_TYPE-Bk45URrlQ',
      children: ['DASHBOARD_CHART_TYPE-ryxVc8RHlX'],
    },
    'DASHBOARD_CHART_TYPE-ryxVc8RHlX': {
      type: 'DASHBOARD_CHART_TYPE',
      id: 'DASHBOARD_CHART_TYPE-ryxVc8RHlX',
      children: [],
    },
    DASHBOARD_HEADER_ID: {
      id: 'DASHBOARD_HEADER_ID',
      type: 'DASHBOARD_HEADER_TYPE',
    },
  };
  const mockTabsLayout = {
    'DASHBOARD_CHART_TYPE-S1gilYABe7': {
      children: [],
      id: 'DASHBOARD_CHART_TYPE-S1gilYABe7',
      type: 'DASHBOARD_CHART_TYPE',
    },
    'DASHBOARD_CHART_TYPE-SJli5K0HlQ': {
      children: [],
      id: 'DASHBOARD_CHART_TYPE-SJli5K0HlQ',
      type: 'DASHBOARD_CHART_TYPE',
    },
    DASHBOARD_GRID_ID: {
      children: [],
      id: 'DASHBOARD_GRID_ID',
      type: 'DASHBOARD_GRID_TYPE',
    },
    DASHBOARD_HEADER_ID: {
      id: 'DASHBOARD_HEADER_ID',
      type: 'DASHBOARD_HEADER_TYPE',
    },
    DASHBOARD_ROOT_ID: {
      children: ['DASHBOARD_TABS_TYPE-SkgJ5t0Bem'],
      id: 'DASHBOARD_ROOT_ID',
      type: 'DASHBOARD_ROOT_TYPE',
    },
    'DASHBOARD_ROW_TYPE-S1B8-JLgX': {
      children: ['DASHBOARD_CHART_TYPE-SJli5K0HlQ'],
      id: 'DASHBOARD_ROW_TYPE-S1B8-JLgX',
      type: 'DASHBOARD_ROW_TYPE',
    },
    'DASHBOARD_ROW_TYPE-S1bUb1Ilm': {
      children: ['DASHBOARD_CHART_TYPE-S1gilYABe7'],
      id: 'DASHBOARD_ROW_TYPE-S1bUb1Ilm',
      type: 'DASHBOARD_ROW_TYPE',
    },
    'DASHBOARD_TABS_TYPE-ByeLSWyLe7': {
      children: ['DASHBOARD_TAB_TYPE-BJbLSZ1UeQ'],
      id: 'DASHBOARD_TABS_TYPE-ByeLSWyLe7',
      type: 'DASHBOARD_TABS_TYPE',
    },
    'DASHBOARD_TABS_TYPE-SkgJ5t0Bem': {
      children: [
        'DASHBOARD_TAB_TYPE-HkWJcFCHxQ',
        'DASHBOARD_TAB_TYPE-ByDBbkLlQ',
      ],
      id: 'DASHBOARD_TABS_TYPE-SkgJ5t0Bem',
      meta: {},
      type: 'DASHBOARD_TABS_TYPE',
    },
    'DASHBOARD_TAB_TYPE-BJbLSZ1UeQ': {
      children: ['DASHBOARD_ROW_TYPE-S1bUb1Ilm'],
      id: 'DASHBOARD_TAB_TYPE-BJbLSZ1UeQ',
      type: 'DASHBOARD_TAB_TYPE',
    },
    'DASHBOARD_TAB_TYPE-ByDBbkLlQ': {
      children: ['DASHBOARD_ROW_TYPE-S1B8-JLgX'],
      id: 'DASHBOARD_TAB_TYPE-ByDBbkLlQ',
      type: 'DASHBOARD_TAB_TYPE',
    },
    'DASHBOARD_TAB_TYPE-HkWJcFCHxQ': {
      children: ['DASHBOARD_TABS_TYPE-ByeLSWyLe7'],
      id: 'DASHBOARD_TAB_TYPE-HkWJcFCHxQ',
      type: 'DASHBOARD_TAB_TYPE',
    },
    DASHBOARD_VERSION_KEY: 'v2',
  };

  it('should return grid root', () => {
    expect(findFirstParentContainerId(mockGridLayout)).to.equal(
      DASHBOARD_GRID_ID,
    );
  });

  it('should return first tab', () => {
    const tabsId = mockTabsLayout[DASHBOARD_ROOT_ID].children[0];
    const firstTabId = mockTabsLayout[tabsId].children[0];
    expect(findFirstParentContainerId(mockTabsLayout)).to.equal(firstTabId);
  });
});
