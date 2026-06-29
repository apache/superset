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
import {
  setHoveredFilter,
  unsetHoveredFilter,
  setFocusedFilter,
  unsetFocusedFilter,
  setHoveredChartCustomization,
  unsetHoveredChartCustomization,
} from 'src/dashboard/stores';
import {
  dispatchHoverAction,
  dispatchFocusAction,
  dispatchChartCustomizationHoverAction,
} from './utils';

// These dispatchers are debounced; .flush() runs the pending call synchronously.
jest.mock('src/dashboard/stores', () => ({
  setHoveredFilter: jest.fn(),
  unsetHoveredFilter: jest.fn(),
  setFocusedFilter: jest.fn(),
  unsetFocusedFilter: jest.fn(),
  setHoveredChartCustomization: jest.fn(),
  unsetHoveredChartCustomization: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('dispatchHoverAction sets the hovered filter when an id is given', () => {
  dispatchHoverAction('filter-1');
  dispatchHoverAction.flush();

  expect(setHoveredFilter).toHaveBeenCalledWith('filter-1');
  expect(unsetHoveredFilter).not.toHaveBeenCalled();
});

test('dispatchHoverAction unsets the hovered filter when no id is given', () => {
  dispatchHoverAction();
  dispatchHoverAction.flush();

  expect(unsetHoveredFilter).toHaveBeenCalledTimes(1);
  expect(setHoveredFilter).not.toHaveBeenCalled();
});

test('dispatchFocusAction sets the focused filter when an id is given', () => {
  dispatchFocusAction('filter-2');
  dispatchFocusAction.flush();

  expect(setFocusedFilter).toHaveBeenCalledWith('filter-2');
  expect(unsetFocusedFilter).not.toHaveBeenCalled();
});

test('dispatchFocusAction unsets the focused filter when no id is given', () => {
  dispatchFocusAction();
  dispatchFocusAction.flush();

  expect(unsetFocusedFilter).toHaveBeenCalledTimes(1);
  expect(setFocusedFilter).not.toHaveBeenCalled();
});

test('dispatchChartCustomizationHoverAction sets the hovered customization when an id is given', () => {
  dispatchChartCustomizationHoverAction('chart-1');
  dispatchChartCustomizationHoverAction.flush();

  expect(setHoveredChartCustomization).toHaveBeenCalledWith('chart-1');
  expect(unsetHoveredChartCustomization).not.toHaveBeenCalled();
});

test('dispatchChartCustomizationHoverAction unsets the hovered customization when no id is given', () => {
  dispatchChartCustomizationHoverAction();
  dispatchChartCustomizationHoverAction.flush();

  expect(unsetHoveredChartCustomization).toHaveBeenCalledTimes(1);
  expect(setHoveredChartCustomization).not.toHaveBeenCalled();
});
