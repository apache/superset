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
import componentIsResizable from './componentIsResizable';
import isValidChild from './isValidChild';
import shouldWrapChildInRow from './shouldWrapChildInRow';
import isDashboardEmpty from './isDashboardEmpty';
import getDetailedComponentWidth from './getDetailedComponentWidth';
import {
  EXTENSION_TYPE,
  DASHBOARD_GRID_TYPE,
  TAB_TYPE,
  COLUMN_TYPE,
} from './componentTypes';

test('componentIsResizable honors meta.resizable for extension components', () => {
  expect(componentIsResizable({ type: EXTENSION_TYPE })).toBe(true);
  expect(
    componentIsResizable({ type: EXTENSION_TYPE, meta: { resizable: true } }),
  ).toBe(true);
  expect(
    componentIsResizable({ type: EXTENSION_TYPE, meta: { resizable: false } }),
  ).toBe(false);
});

test('isValidChild restricts extension parents via meta.validParents', () => {
  // Allowed in GRID when GRID is listed
  expect(
    isValidChild({
      parentType: DASHBOARD_GRID_TYPE,
      childType: EXTENSION_TYPE,
      parentDepth: 1,
      childMeta: { validParents: [DASHBOARD_GRID_TYPE] },
    }),
  ).toBe(true);
  // Forbidden in COLUMN when only GRID is listed
  expect(
    isValidChild({
      parentType: COLUMN_TYPE,
      childType: EXTENSION_TYPE,
      parentDepth: 4,
      childMeta: { validParents: [DASHBOARD_GRID_TYPE] },
    }),
  ).toBe(false);
  // No restriction → standard leaf behavior (allowed in GRID at depth 1)
  expect(
    isValidChild({
      parentType: DASHBOARD_GRID_TYPE,
      childType: EXTENSION_TYPE,
      parentDepth: 1,
    }),
  ).toBe(true);
});

test('shouldWrapChildInRow honors meta.wrapInRow for extension components', () => {
  expect(
    shouldWrapChildInRow({
      parentType: DASHBOARD_GRID_TYPE,
      childType: EXTENSION_TYPE,
    }),
  ).toBe(true);
  expect(
    shouldWrapChildInRow({
      parentType: DASHBOARD_GRID_TYPE,
      childType: EXTENSION_TYPE,
      childMeta: { wrapInRow: false },
    }),
  ).toBe(false);
});

test('isDashboardEmpty respects meta.isUserContent for extension components', () => {
  const userContent = {
    a: { type: EXTENSION_TYPE, meta: { isUserContent: true } },
  };
  const nonUserContent = {
    a: { type: EXTENSION_TYPE, meta: { isUserContent: false } },
  };
  expect(isDashboardEmpty(userContent)).toBe(false);
  // An extension that opts out of being user content leaves the dashboard empty
  expect(isDashboardEmpty(nonUserContent)).toBe(true);
  // Default (no flag) counts as user content
  expect(isDashboardEmpty({ a: { type: EXTENSION_TYPE, meta: {} } })).toBe(
    false,
  );
});

test('getDetailedComponentWidth honors meta.minWidth for extension components', () => {
  const withMin = getDetailedComponentWidth({
    component: { type: EXTENSION_TYPE, meta: { minWidth: 3 } } as any,
  });
  expect(withMin.minimumWidth).toBe(3);
  const withoutMin = getDetailedComponentWidth({
    component: { type: EXTENSION_TYPE, meta: {} } as any,
  });
  expect(withoutMin.minimumWidth).toBe(1);
});

test('extension nesting still respects container depth limits', () => {
  // Even when validParents allows TAB, the depth gate still applies.
  expect(
    isValidChild({
      parentType: TAB_TYPE,
      childType: EXTENSION_TYPE,
      parentDepth: 999,
      childMeta: { validParents: [TAB_TYPE] },
    }),
  ).toBe(false);
});
