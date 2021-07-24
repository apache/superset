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
import getDropPosition, {
  DROP_TOP,
  DROP_RIGHT,
  DROP_BOTTOM,
  DROP_LEFT,
} from 'src/dashboard/util/getDropPosition';

import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  HEADER_TYPE,
  ROW_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';

describe('getDropPosition', () => {
  // helper to easily configure test
  function getMocks({
    parentType,
    componentType,
    draggingType,
    depth = 1,
    hasChildren = false,
    orientation = 'row',
    clientOffset = { x: 0, y: 0 },
    boundingClientRect = {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    isDraggingOverShallow = true,
  }) {
    const monitorMock = {
      getItem: () => ({
        id: 'id',
        type: draggingType,
      }),
      getClientOffset: () => clientOffset,
    };

    const ComponentMock = {
      props: {
        depth,
        parentComponent: {
          type: parentType,
        },
        component: {
          type: componentType,
          children: hasChildren ? [''] : [],
        },
        orientation,
        isDraggingOverShallow,
      },
      ref: {
        getBoundingClientRect: () => boundingClientRect,
      },
    };

    return [monitorMock, ComponentMock];
  }

  describe('invalid child + invalid sibling', () => {
    it('should return null', () => {
      const result = getDropPosition(
        // TAB is an invalid child + sibling of GRID > ROW
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: TAB_TYPE,
        }),
      );
      expect(result).toBeNull();
    });
  });

  describe('valid child + invalid sibling', () => {
    it('should return DROP_LEFT if component has NO children, and orientation is "row"', () => {
      // HEADER is a valid child + invalid sibling of ROOT > GRID
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_ROOT_TYPE,
          componentType: DASHBOARD_GRID_TYPE,
          draggingType: HEADER_TYPE,
        }),
      );
      expect(result).toBe(DROP_LEFT);
    });

    it('should return DROP_RIGHT if component HAS children, and orientation is "row"', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_ROOT_TYPE,
          componentType: DASHBOARD_GRID_TYPE,
          draggingType: HEADER_TYPE,
          hasChildren: true,
        }),
      );
      expect(result).toBe(DROP_RIGHT);
    });

    it('should return DROP_TOP if component has NO children, and orientation is "column"', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_ROOT_TYPE,
          componentType: DASHBOARD_GRID_TYPE,
          draggingType: HEADER_TYPE,
          orientation: 'column',
        }),
      );
      expect(result).toBe(DROP_TOP);
    });

    it('should return DROP_BOTTOM if component HAS children, and orientation is "column"', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_ROOT_TYPE,
          componentType: DASHBOARD_GRID_TYPE,
          draggingType: HEADER_TYPE,
          orientation: 'column',
          hasChildren: true,
        }),
      );
      expect(result).toBe(DROP_BOTTOM);
    });
  });

  describe('invalid child + valid sibling', () => {
    it('should return DROP_TOP if orientation="row" and clientOffset is closer to component top than bottom', () => {
      const result = getDropPosition(
        // HEADER is an invalid child but valid sibling of GRID > ROW
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: HEADER_TYPE,
          clientOffset: { y: 10 },
          boundingClientRect: {
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_TOP);
    });

    it('should return DROP_BOTTOM if orientation="row" and clientOffset is closer to component bottom than top', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: HEADER_TYPE,
          clientOffset: { y: 55 },
          boundingClientRect: {
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_BOTTOM);
    });

    it('should return DROP_LEFT if orientation="column" and clientOffset is closer to component left than right', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: HEADER_TYPE,
          orientation: 'column',
          clientOffset: { x: 45 },
          boundingClientRect: {
            left: 0,
            right: 100,
          },
        }),
      );
      expect(result).toBe(DROP_LEFT);
    });

    it('should return DROP_RIGHT if orientation="column" and clientOffset is closer to component right than left', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: HEADER_TYPE,
          orientation: 'column',
          clientOffset: { x: 55 },
          boundingClientRect: {
            left: 0,
            right: 100,
          },
        }),
      );
      expect(result).toBe(DROP_RIGHT);
    });
  });

  describe('child + valid sibling (row orientation)', () => {
    it('should return DROP_LEFT if component has NO children, and clientOffset is NOT near top/bottom sibling boundary', () => {
      const result = getDropPosition(
        // CHART is a valid child + sibling of GRID > ROW
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          clientOffset: { x: 10, y: 50 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_LEFT);
    });

    it('should return DROP_RIGHT if component HAS children, and clientOffset is NOT near top/bottom sibling boundary', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          hasChildren: true,
          clientOffset: { x: 10, y: 50 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_RIGHT);
    });

    it('should return DROP_TOP regardless of component children if clientOffset IS near top sibling boundary', () => {
      const noChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          clientOffset: { x: 10, y: 2 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      const withChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          hasChildren: true,
          clientOffset: { x: 10, y: 2 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(noChildren).toBe(DROP_TOP);
      expect(withChildren).toBe(DROP_TOP);
    });

    it('should return DROP_BOTTOM regardless of component children if clientOffset IS near bottom sibling boundary', () => {
      const noChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          clientOffset: { x: 10, y: 95 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      const withChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          hasChildren: true,
          clientOffset: { x: 10, y: 95 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(noChildren).toBe(DROP_BOTTOM);
      expect(withChildren).toBe(DROP_BOTTOM);
    });
  });

  describe('child + valid sibling (column orientation)', () => {
    it('should return DROP_TOP if component has NO children, and clientOffset is NOT near left/right sibling boundary', () => {
      const result = getDropPosition(
        // CHART is a valid child + sibling of GRID > ROW
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          clientOffset: { x: 50, y: 0 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_TOP);
    });

    it('should return DROP_BOTTOM if component HAS children, and clientOffset is NOT near left/right sibling boundary', () => {
      const result = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          hasChildren: true,
          clientOffset: { x: 50, y: 0 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(result).toBe(DROP_BOTTOM);
    });

    it('should return DROP_LEFT regardless of component children if clientOffset IS near left sibling boundary', () => {
      const noChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          clientOffset: { x: 10, y: 2 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      const withChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          hasChildren: true,
          clientOffset: { x: 10, y: 2 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(noChildren).toBe(DROP_LEFT);
      expect(withChildren).toBe(DROP_LEFT);
    });

    it('should return DROP_RIGHT regardless of component children if clientOffset IS near right sibling boundary', () => {
      const noChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          clientOffset: { x: 90, y: 95 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      const withChildren = getDropPosition(
        ...getMocks({
          parentType: DASHBOARD_GRID_TYPE,
          componentType: ROW_TYPE,
          draggingType: CHART_TYPE,
          orientation: 'column',
          hasChildren: true,
          clientOffset: { x: 90, y: 95 },
          boundingClientRect: {
            left: 0,
            right: 100,
            top: 0,
            bottom: 100,
          },
        }),
      );
      expect(noChildren).toBe(DROP_RIGHT);
      expect(withChildren).toBe(DROP_RIGHT);
    });
  });
});
