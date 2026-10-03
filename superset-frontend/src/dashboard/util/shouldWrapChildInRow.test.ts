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
import shouldWrapChildInRow from 'src/dashboard/util/shouldWrapChildInRow';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  FILTER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from 'src/dashboard/util/componentTypes';

describe('shouldWrapChildInRow', () => {
  test('should return true for CHART, COLUMN, MARKDOWN, and FILTER under DASHBOARD_GRID', () => {
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: CHART_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: COLUMN_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: MARKDOWN_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: FILTER_TYPE,
      }),
    ).toBe(true);
  });

  test('should return true for CHART, COLUMN, MARKDOWN, and FILTER under TAB', () => {
    expect(
      shouldWrapChildInRow({
        parentType: TAB_TYPE,
        childType: CHART_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: TAB_TYPE,
        childType: COLUMN_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: TAB_TYPE,
        childType: MARKDOWN_TYPE,
      }),
    ).toBe(true);
    expect(
      shouldWrapChildInRow({
        parentType: TAB_TYPE,
        childType: FILTER_TYPE,
      }),
    ).toBe(true);
  });

  test('should return false for other components or parent types', () => {
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: ROW_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: TABS_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: HEADER_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_GRID_TYPE,
        childType: DIVIDER_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: ROW_TYPE,
        childType: FILTER_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: DASHBOARD_ROOT_TYPE,
        childType: FILTER_TYPE,
      }),
    ).toBe(false);
    expect(
      shouldWrapChildInRow({
        parentType: null,
        childType: FILTER_TYPE,
      }),
    ).toBe(false);
  });
});
