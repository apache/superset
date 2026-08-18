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
  ChartCustomizationType,
  type ChartCustomization,
} from '@superset-ui/core';
import { LabeledValue } from '@superset-ui/core/components';
import { render, screen } from 'spec/helpers/testing-library';
import GroupByFilterCard, {
  createLabelSortComparator,
} from './GroupByFilterCard';

jest.mock('src/utils/cachedSupersetGet', () => ({
  // Never resolves, pinning the card in its column-loading state.
  cachedSupersetGet: jest.fn(() => new Promise(() => {})),
}));

const apple: LabeledValue = { value: 'a', label: 'Apple' };
const banana: LabeledValue = { value: 'b', label: 'Banana' };

test('sorts display values A-Z when sortAscending is true', () => {
  const compare = createLabelSortComparator(true);
  expect(compare(apple, banana)).toBeLessThan(0);
  expect(compare(banana, apple)).toBeGreaterThan(0);
});

test('sorts display values Z-A when sortAscending is false', () => {
  const compare = createLabelSortComparator(false);
  expect(compare(apple, banana)).toBeGreaterThan(0);
  expect(compare(banana, apple)).toBeLessThan(0);
});

test('preserves source order when sortAscending is unset', () => {
  const compare = createLabelSortComparator(undefined);
  expect(compare(apple, banana)).toBe(0);
  expect(compare(banana, apple)).toBe(0);
});

const groupByCustomization: ChartCustomization = {
  id: 'groupby-1',
  name: 'Group By',
  filterType: 'filter_groupby',
  type: ChartCustomizationType.ChartCustomization,
  targets: [{ datasetId: 1 }],
  scope: { rootPath: [], excluded: [] },
  controlValues: {},
  defaultDataMask: {},
};

test('renders the column-loading spinner small and muted', async () => {
  render(<GroupByFilterCard customizationItem={groupByCustomization} />, {
    useRedux: true,
    initialState: {
      dataMask: {},
      nativeFilters: { filters: {} },
    },
  });
  const spinner = await screen.findByTestId('loading-indicator');
  expect(spinner).toHaveClass('inline');
  expect(spinner).toHaveStyle({ opacity: 0.25, width: '40px' });
});
