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
import { FeatureFlag } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import { renderHook } from '@testing-library/react-hooks';
import mockState from 'spec/fixtures/mockState';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { noOp } from 'src/utils/common';
import { useContextMenu } from './useContextMenu';
import { ContextMenuItem } from './ChartContextMenu';

const CONTEXT_MENU_TEST_ID = 'chart-context-menu';

// @ts-ignore
global.featureFlags = {
  [FeatureFlag.DASHBOARD_CROSS_FILTERS]: true,
  [FeatureFlag.DRILL_TO_DETAIL]: true,
  [FeatureFlag.DRILL_BY]: true,
};

const setup = ({
  onSelection = noOp,
  displayedItems = ContextMenuItem.All,
  additionalConfig = {},
}: {
  onSelection?: () => void;
  displayedItems?: ContextMenuItem | ContextMenuItem[];
  additionalConfig?: Record<string, any>;
} = {}) => {
  const { result } = renderHook(() =>
    useContextMenu(
      sliceId,
      { datasource: '1__table', viz_type: 'pie' },
      onSelection,
      displayedItems,
      additionalConfig,
    ),
  );
  render(result.current.contextMenu, {
    useRedux: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: { Admin: [['can_explore', 'Superset']] },
      },
    },
  });
  return result;
};

test('Context menu renders', () => {
  const result = setup();
  expect(screen.queryByTestId(CONTEXT_MENU_TEST_ID)).not.toBeInTheDocument();
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByTestId(CONTEXT_MENU_TEST_ID)).toBeInTheDocument();
  expect(screen.getByText('Add cross-filter')).toBeInTheDocument();
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});

test('Context menu contains all items only', () => {
  const result = setup({
    displayedItems: [ContextMenuItem.DrillToDetail, ContextMenuItem.DrillBy],
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Add cross-filter')).not.toBeInTheDocument();
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});
