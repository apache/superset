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
import getDetailedComponentWidth from 'src/dashboard/util/getDetailedComponentWidth';
import * as types from 'src/dashboard/util/componentTypes';
import {
  GRID_COLUMN_COUNT,
  GRID_MIN_COLUMN_COUNT,
} from 'src/dashboard/util/constants';

describe('getDetailedComponentWidth', () => {
  it('should return an object with width, minimumWidth, and occupiedWidth', () => {
    expect(
      Object.keys(getDetailedComponentWidth({ id: '_', components: {} })),
    ).toEqual(
      expect.arrayContaining(['minimumWidth', 'occupiedWidth', 'width']),
    );
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
      ).toEqual(empty);

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.DIVIDER_TYPE },
        }),
      ).toEqual(empty);

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.TAB_TYPE },
        }),
      ).toEqual(empty);
    });

    it('should match component meta width for resizeable components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.CHART_TYPE, meta: { width: 1 } },
        }),
      ).toEqual({ width: 1, occupiedWidth: 1, minimumWidth: 1 });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.MARKDOWN_TYPE, meta: { width: 2 } },
        }),
      ).toEqual({ width: 2, occupiedWidth: 2, minimumWidth: 1 });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 3 } },
        }),
        // note: occupiedWidth is zero for colunns/see test below
      ).toEqual({ width: 3, occupiedWidth: 0, minimumWidth: 1 });
    });

    it('should be GRID_COLUMN_COUNT for row components WITHOUT parents', () => {
      expect(
        getDetailedComponentWidth({
          id: 'row',
          components: { row: { id: 'row', type: types.ROW_TYPE } },
        }),
      ).toEqual({
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
      ).toEqual({
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
      ).toBe(6);

      expect(
        getDetailedComponentWidth({
          component: { id: 'id', type: types.CHART_TYPE, meta: { width: 6 } },
        }).width,
      ).toBe(6);
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
      ).toEqual({ width: 12, occupiedWidth: 7, minimumWidth: 7 });
    });

    it('should always be zero for column components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 2 } },
        }),
      ).toEqual({ width: 2, occupiedWidth: 0, minimumWidth: 1 });
    });
  });

  describe('minimumWidth', () => {
    it('should equal GRID_MIN_COLUMN_COUNT for resizable components', () => {
      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.CHART_TYPE, meta: { width: 1 } },
        }),
      ).toEqual({
        width: 1,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
        occupiedWidth: 1,
      });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.MARKDOWN_TYPE, meta: { width: 2 } },
        }),
      ).toEqual({
        width: 2,
        minimumWidth: GRID_MIN_COLUMN_COUNT,
        occupiedWidth: 2,
      });

      expect(
        getDetailedComponentWidth({
          component: { id: '', type: types.COLUMN_TYPE, meta: { width: 3 } },
        }),
      ).toEqual({
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
      ).toEqual({ width: 12, occupiedWidth: 0, minimumWidth: 7 });
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
      ).toEqual({ width: 12, occupiedWidth: 7, minimumWidth: 7 });
    });
  });
});
