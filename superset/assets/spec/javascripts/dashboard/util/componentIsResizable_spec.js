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
import componentIsResizable from '../../../../src/dashboard/util/componentIsResizable';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

const notResizable = [
  DASHBOARD_GRID_TYPE,
  DASHBOARD_ROOT_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
];

const resizable = [COLUMN_TYPE, CHART_TYPE, MARKDOWN_TYPE];

describe('componentIsResizable', () => {
  resizable.forEach(type => {
    it(`should return true for ${type}`, () => {
      expect(componentIsResizable({ type })).toBe(true);
    });
  });

  notResizable.forEach(type => {
    it(`should return false for ${type}`, () => {
      expect(componentIsResizable({ type })).toBe(false);
    });
  });
});
