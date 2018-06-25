import { describe, it } from 'mocha';
import { expect } from 'chai';

import componentIsResizable from '../../../../src/dashboard/util/componentIsResizable';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

const notResizable = [
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
];

const resizable = [COLUMN_TYPE, CHART_TYPE, MARKDOWN_TYPE];

describe('componentIsResizable', () => {
  resizable.forEach(type => {
    it(`should return true for ${type}`, () => {
      expect(componentIsResizable({ type })).to.equal(true);
    });
  });

  notResizable.forEach(type => {
    it(`should return false for ${type}`, () => {
      expect(componentIsResizable({ type })).to.equal(false);
    });
  });
});
