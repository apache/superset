import { describe, it } from 'mocha';
import { expect } from 'chai';

import dropOverflowsParent from '../../../../src/dashboard/util/dropOverflowsParent';
import { NEW_COMPONENTS_SOURCE_ID } from '../../../../src/dashboard/util/constants';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  ROW_TYPE,
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

    expect(dropOverflowsParent(dropResult, layout)).to.equal(true);
  });

  it('returns false if a parent DOES not have adequate width for child', () => {
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

    expect(dropOverflowsParent(dropResult, layout)).to.equal(false);
  });

  it('it should base result off of column width (instead of its children) if dropped on column', () => {
    const dropResult = {
      source: { id: 'z' },
      destination: { id: 'a' },
      dragging: { id: 'b' },
    };

    const layout = {
      a: {
        id: 'a',
        type: COLUMN_TYPE,
        meta: { width: 10 },
      },
      b: {
        id: 'b',
        type: CHART_TYPE,
        meta: {
          width: 2,
        },
      },
    };

    expect(dropOverflowsParent(dropResult, layout)).to.equal(false);
    expect(
      dropOverflowsParent(dropResult, {
        ...layout,
        a: { ...layout.a, meta: { width: 1 } },
      }),
    ).to.equal(true);
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

    expect(dropOverflowsParent(dropResult, layout)).to.equal(false);
  });
});
