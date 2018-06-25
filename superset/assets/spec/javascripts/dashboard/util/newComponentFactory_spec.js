import { describe, it } from 'mocha';
import { expect } from 'chai';

import newComponentFactory from '../../../../src/dashboard/util/newComponentFactory';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

const types = [
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  NEW_COMPONENT_SOURCE_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
];

describe('newEntityFactory', () => {
  types.forEach(type => {
    it(`returns a new ${type}`, () => {
      const result = newComponentFactory(type);

      expect(result.type).to.equal(type);
      expect(typeof result.id).to.equal('string');
      expect(typeof result.meta).to.equal('object');
      expect(Array.isArray(result.children)).to.equal(true);
    });
  });

  it('adds passed meta data to the entity', () => {
    const banana = 'banana';
    const result = newComponentFactory(CHART_TYPE, { banana });
    expect(result.meta.banana).to.equal(banana);
  });
});
