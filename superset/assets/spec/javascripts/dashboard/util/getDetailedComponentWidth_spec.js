import { expect } from 'chai';

import getDetailedComponentWidth from '../../../../src/dashboard/util/getDetailedComponentWidth';
import * as types from '../../../../src/dashboard/util/componentTypes';
import {
  GRID_COLUMN_COUNT,
  GRID_MIN_COLUMN_COUNT,
} from '../../../../src/dashboard/util/constants';

describe('getDetailedComponentWidth', () => {
  it('should return an object with width, minimumWidth, and occupiedWidth', () => {
    expect(
      getDetailedComponentWidth({ id: '_', components: {} }),
    ).to.have.all.keys(['minimumWidth', 'occupiedWidth', 'width']);
  });

  describe('width', () => {
    it('should be undefined if the component is not resizable and has no defined width', () => {
      const empty = {
        width: undefined,
        occupiedWidth: undefined,
        minimumWidth: undefined,
      };

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.HEADER_TYPE },
        }),
      ).to.deep.equal(empty);

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.DIVIDER_TYPE },
        }),
      ).to.deep.equal(empty);

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.TAB_TYPE },
        }),
      ).to.deep.equal(empty);
    });

    it('should match component meta width for resizeable components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.CHART_TYPE, meta: { width: 1 } },
        }),
      ).to.deep.equal({ width: 1, occupiedWidth: 1, minimumWidth: 1 });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.MARKDOWN_TYPE, meta: { width: 2 } },
        }),
      ).to.deep.equal({ width: 2, occupiedWidth: 2, minimumWidth: 1 });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 3 } },
        }),
        // note: occupiedWidth is zero for colunns/see test below
      ).to.deep.equal({ width: 3, occupiedWidth: 0, minimumWidth: 1 });
    });

    it('should be GRID_COLUMN_COUNT for row components WITHOUT parents', () => {
      expect(
        getDetailedComponentWidth({
          id: 'row',
          components: { row: { id: 'row', type: types.ROW_TYPE } },
        }),
      ).to.deep.equal({
        width: GRID_COLUMN_COUNT,
        occupiedWidth: 0,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
      });
    });

    it('should match parent width for row components WITH parents', () => {
      expect(
        getDetailedComponentWidth({
          id: 'row',
          components: {
            row: { id: 'row', type: types.ROW_TYPE },
            parent: {
              id: 'parent',
              type: types.COLUMN_TYPE,
              children: ['row'],
              meta: { width: 7 },
            },
          },
        }),
      ).to.deep.equal({
        width: 7,
        occupiedWidth: 0,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
      });
    });

    it('should use either id or component (to support new components)', () => {
      expect(
        getDetailedComponentWidth({
          id: 'id',
          components: {
            id: { id: 'id', type: types.CHART_TYPE, meta: { width: 6 } },
          },
        }).width,
      ).to.equal(6);

      expect(
        getDetailedComponentWidth({
          component: { id: 'id', type: types.CHART_TYPE, meta: { width: 6 } },
        }).width,
      ).to.equal(6);
    });
  });

  describe('occupiedWidth', () => {
    it('should reflect the sum of child widths for row components', () => {
      expect(
        getDetailedComponentWidth({
          id: 'row',
          components: {
            row: {
              id: 'row',
              type: types.ROW_TYPE,
              children: ['child', 'child'],
            },
            child: { id: 'child', meta: { width: 3.5 } },
          },
        }),
      ).to.deep.equal({ width: 12, occupiedWidth: 7, minimumWidth: 7 });
    });

    it('should always be zero for column components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 2 } },
        }),
      ).to.deep.equal({ width: 2, occupiedWidth: 0, minimumWidth: 1 });
    });
  });

  describe('minimumWidth', () => {
    it('should equal GRID_MIN_COLUMN_COUNT for resizable components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.CHART_TYPE, meta: { width: 1 } },
        }),
      ).to.deep.equal({
        width: 1,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
        occupiedWidth: 1,
      });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.MARKDOWN_TYPE, meta: { width: 2 } },
        }),
      ).to.deep.equal({
        width: 2,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
        occupiedWidth: 2,
      });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 3 } },
        }),
      ).to.deep.equal({
        width: 3,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
        occupiedWidth: 0,
      });
    });

    it('should equal the width of row children for column components with row children', () => {
      expect(
        getDetailedComponentWidth({
          id: 'column',
          components: {
            column: {
              id: 'column',
              type: types.COLUMN_TYPE,
              children: ['rowChild', 'ignoredChartChild'],
              meta: { width: 12 },
            },
            rowChild: {
              id: 'rowChild',
              type: types.ROW_TYPE,
              children: ['rowChildChild', 'rowChildChild'],
            },
            rowChildChild: {
              id: 'rowChildChild',
              meta: { width: 3.5 },
            },
            ignoredChartChild: {
              id: 'ignoredChartChild',
              meta: { width: 100 },
            },
          },
        }),
        // occupiedWidth is zero for colunns/see test below
      ).to.deep.equal({ width: 12, occupiedWidth: 0, minimumWidth: 7 });
    });

    it('should equal occupiedWidth for row components', () => {
      expect(
        getDetailedComponentWidth({
          id: 'row',
          components: {
            row: {
              id: 'row',
              type: types.ROW_TYPE,
              children: ['child', 'child'],
            },
            child: { id: 'child', meta: { width: 3.5 } },
          },
        }),
      ).to.deep.equal({ width: 12, occupiedWidth: 7, minimumWidth: 7 });
    });
  });
});
