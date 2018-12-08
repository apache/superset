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

      expect(result.type).toBe(type);
      expect(typeof result.id).toBe('string');
      expect(typeof result.meta).toBe('object');
      expect(Array.isArray(result.children)).toBe(true);
    });
  });

  it('adds passed meta data to the entity', () => {
    const banana = 'banana';
    const result = newComponentFactory(CHART_TYPE, { banana });
    expect(result.meta.banana).toBe(banana);
  });
});
