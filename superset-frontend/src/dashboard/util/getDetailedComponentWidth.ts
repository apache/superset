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
 */
import findParentId from './findParentId';
import { GRID_MIN_COLUMN_COUNT, GRID_COLUMN_COUNT } from './constants';
import {
  ROW_TYPE,
  COLUMN_TYPE,
  MARKDOWN_TYPE,
  CHART_TYPE,
  DYNAMIC_TYPE,
} from './componentTypes';
import { DashboardLayout, LayoutItem } from '../types';

interface ComponentWidthInfo {
  width?: number;
  occupiedWidth?: number;
  minimumWidth?: number;
}

function getTotalChildWidth({
  id,
  components,
}: {
  id: string;
  components: DashboardLayout;
}): number {
  const component = components[id];
  if (!component) return 0;

  let width = 0;

  (component.children || []).forEach(childId => {
    const child = components[childId] || {};
    width += (child.meta || {}).width || 0;
  });

  return width;
}

export default function getDetailedComponentWidth({
  id,
  component: passedComponent,
  components = {},
}: {
  id?: string;
  component?: LayoutItem;
  components?: DashboardLayout;
}): ComponentWidthInfo {
  const result: ComponentWidthInfo = {
    width: undefined,
    occupiedWidth: undefined,
    minimumWidth: undefined,
  };

  const component = passedComponent || (id ? components[id] : undefined);
  if (!component) return result;

  result.width = (component.meta || {}).width;
  result.occupiedWidth = result.width;

  // 🔹 ROW LOGIC
  if (component.type === ROW_TYPE) {
    const parentId = findParentId({
      childId: component.id,
      layout: components,
    });

    result.width =
      getDetailedComponentWidth({
        id: parentId ?? undefined,
        components,
      }).width || GRID_COLUMN_COUNT;

    result.occupiedWidth = getTotalChildWidth({ id: component.id, components });

    result.minimumWidth = result.occupiedWidth || GRID_MIN_COLUMN_COUNT;
  }

  // 🔹 COLUMN LOGIC (FIXED)
  else if (component.type === COLUMN_TYPE) {
    // Columns never occupy horizontal grid width themselves
    result.occupiedWidth = 0;
    result.minimumWidth = GRID_MIN_COLUMN_COUNT;

    (component.children || []).forEach(childId => {
      if (components[childId]?.type === ROW_TYPE) {
        const childWidth = getTotalChildWidth({ id: childId, components });

        result.minimumWidth = Math.max(
          result.minimumWidth ?? GRID_MIN_COLUMN_COUNT,
          childWidth,
        );
      }
    });
  }

  // 🔹 LEAF COMPONENTS
  else if (
    component.type === DYNAMIC_TYPE ||
    component.type === MARKDOWN_TYPE ||
    component.type === CHART_TYPE
  ) {
    result.minimumWidth = GRID_MIN_COLUMN_COUNT;
  }

  return result;
}
