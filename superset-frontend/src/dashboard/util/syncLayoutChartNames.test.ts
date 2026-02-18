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

import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import type { LayoutItem } from '../types';
import syncLayoutChartNames from './syncLayoutChartNames';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.Mock;

function makeLayout(
  chartId: number,
  sliceName: string,
): { layout: Record<string, LayoutItem>; chartIdToLayoutId: Record<number, string> } {
  const componentId = `CHART-test-${chartId}`;
  return {
    layout: {
      [componentId]: {
        id: componentId,
        type: 'CHART',
        children: [],
        parents: [],
        meta: { chartId, sliceName },
      } as LayoutItem,
    },
    chartIdToLayoutId: { [chartId]: componentId },
  };
}

afterEach(() => {
  mockIsFeatureEnabled.mockReset();
});

test('overwrites sliceName when content localization is disabled', () => {
  mockIsFeatureEnabled.mockReturnValue(false);

  const { layout, chartIdToLayoutId } = makeLayout(42, 'Server Name');
  syncLayoutChartNames(layout, chartIdToLayoutId, 42, 'Updated Name');

  expect(layout['CHART-test-42'].meta.sliceName).toBe('Updated Name');
});

test('preserves server-localized sliceName when content localization is enabled', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.EnableContentLocalization,
  );

  const { layout, chartIdToLayoutId } = makeLayout(42, 'Localized German Name');
  syncLayoutChartNames(layout, chartIdToLayoutId, 42, 'Original English Name');

  expect(layout['CHART-test-42'].meta.sliceName).toBe('Localized German Name');
});

test('checks EnableContentLocalization flag specifically', () => {
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.EnableContentLocalization,
  );

  syncLayoutChartNames({}, {}, 1, 'name');

  expect(mockIsFeatureEnabled).toHaveBeenCalledWith(
    FeatureFlag.EnableContentLocalization,
  );
});

test('no-op when chartId not in layout', () => {
  mockIsFeatureEnabled.mockReturnValue(false);

  const { layout, chartIdToLayoutId } = makeLayout(42, 'Original');
  syncLayoutChartNames(layout, chartIdToLayoutId, 999, 'New Name');

  expect(layout['CHART-test-42'].meta.sliceName).toBe('Original');
});
