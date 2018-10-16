import dropOverflowsParent from '../../../../src/dashboard/util/dropOverflowsParent';
import { NEW_COMPONENTS_SOURCE_ID } from '../../../../src/dashboard/util/constants';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  ROW_TYPE,
  HEADER_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

describe('dropOverflowsParent', () => {
  it('returns true if a parent does NOT have adequate width for child', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'a' },
      dragging: { id: 'z' },
    };

    const layout = {
      a: {
        id: 'a',
        type: ROW_TYPE,
        children: ['b', 'b', 'b', 'b'], // width = 4x bs = 12
      },
      b: {
        id: 'b',
        type: CHART_TYPE,
        meta: {
          width: 3,
        },
      },
      z: {
        id: 'z',
        type: CHART_TYPE,
        meta: {
          width: 2,
        },
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(true);
  });

  it('returns false if a parent DOES have adequate width for child', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'a' },
      dragging: { id: 'z' },
    };

    const layout = {
      a: {
        id: 'a',
        type: ROW_TYPE,
        children: ['b', 'b'],
      },
      b: {
        id: 'b',
        type: CHART_TYPE,
        meta: {
          width: 3,
        },
      },
      z: {
        id: 'z',
        type: CHART_TYPE,
        meta: {
          width: 2,
        },
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(false);
  });

  it('returns false if a child CAN shrink to available parent space', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'a' },
      dragging: { id: 'z' },
    };

    const layout = {
      a: {
        id: 'a',
        type: ROW_TYPE,
        children: ['b', 'b'], // 2x b = 10
      },
      b: {
        id: 'b',
        type: CHART_TYPE,
        meta: {
          width: 5,
        },
      },
      z: {
        id: 'z',
        type: CHART_TYPE,
        meta: {
          width: 10,
        },
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(false);
  });

  it('returns true if a child CANNOT shrink to available parent space', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'a' },
      dragging: { id: 'b' },
    };

    const layout = {
      a: {
        id: 'a',
        type: COLUMN_TYPE,
        meta: {
          width: 6,
        },
      },
      // rows with children cannot shrink
      b: {
        id: 'b',
        type: ROW_TYPE,
        children: ['bChild', 'bChild', 'bChild'],
      },
      bChild: {
        id: 'bChild',
        type: CHART_TYPE,
        meta: {
          width: 3,
        },
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(true);
  });

  it('returns true if a column has children that CANNOT shrink to available parent space', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'destination' },
      dragging: { id: 'dragging' },
    };

    const layout = {
      destination: {
        id: 'destination',
        type: ROW_TYPE,
        children: ['b', 'b'], // 2x b = 10, 2 available
      },
      b: {
        id: 'b',
        type: CHART_TYPE,
        meta: {
          width: 5,
        },
      },
      dragging: {
        id: 'dragging',
        type: COLUMN_TYPE,
        meta: {
          width: 10,
        },
        children: ['rowWithChildren'], // 2x b = width 10
      },
      rowWithChildren: {
        id: 'rowWithChildren',
        type: ROW_TYPE,
        children: ['b', 'b'],
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(true);
    // remove children
    expect(
      dropOverflowsParent(dropResult, {
        ...layout,
        dragging: { ...layout.dragging, children: [] },
      }),
    ).toBe(false);
  });

  it('should work with new components that are not in the layout', () => {
    const dropResult = {
      source: { id: NEW_COMPONENTS_SOURCE_ID },
      destination: { id: 'a' },
      dragging: { type: CHART_TYPE },
    };

    const layout = {
      a: {
        id: 'a',
        type: ROW_TYPE,
        children: [],
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(false);
  });

  it('source/destination without widths should not overflow parent', () => {
    const dropResult = {
      source: { id: '_' },
      destination: { id: 'tab' },
      dragging: { id: 'header' },
    };

    const layout = {
      tab: {
        id: 'tab',
        type: TAB_TYPE,
      },
      header: {
        id: 'header',
        type: HEADER_TYPE,
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).toBe(false);
  });
});
