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
import { FeatureFlag, VizType } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import { renderHook } from '@testing-library/react-hooks';
import mockState from 'spec/fixtures/mockState';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { noOp } from 'src/utils/common';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import { useContextMenu } from './useContextMenu';
import { ContextMenuItem } from './ChartContextMenu';

jest.mock('src/utils/cachedSupersetGet');

const mockCachedSupersetGet = cachedSupersetGet as jest.MockedFunction<
  typeof cachedSupersetGet
>;
const CONTEXT_MENU_TEST_ID = 'chart-context-menu';

// @ts-ignore
global.featureFlags = {
  [FeatureFlag.DrillToDetail]: true,
  [FeatureFlag.DrillBy]: true,
};

const setup = ({
  onSelection = noOp,
  displayedItems = ContextMenuItem.All,
  additionalConfig = {},
  roles = undefined,
}: {
  onSelection?: () => void;
  displayedItems?: ContextMenuItem | ContextMenuItem[];
  additionalConfig?: Record<string, any>;
  roles?: Record<string, string[][]>;
} = {}) => {
  const { result } = renderHook(() =>
    useContextMenu(
      sliceId,
      { datasource: '1__table', viz_type: VizType.Pie },
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
        roles: roles ?? {
          Admin: [
            ['can_explore', 'Superset'],
            ['can_samples', 'Datasource'],
            ['can_write', 'ExploreFormDataRestApi'],
            ['can_get_drill_info', 'Dataset'],
          ],
        },
      },
    },
  });
  return result;
};

beforeEach(() => {
  mockCachedSupersetGet.mockClear();
  mockCachedSupersetGet.mockResolvedValue({
    response: {} as Response,
    json: {
      result: {
        columns: [],
        metrics: [],
      },
    },
  });
});

test('Context menu renders', () => {
  const result = setup();
  expect(screen.queryByTestId(CONTEXT_MENU_TEST_ID)).not.toBeInTheDocument();
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByTestId(CONTEXT_MENU_TEST_ID)).toBeInTheDocument();
  expect(screen.getByText('Add cross-filter')).toBeInTheDocument();
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});

test('Context menu contains all displayed items only', () => {
  const result = setup({
    displayedItems: [ContextMenuItem.DrillToDetail, ContextMenuItem.DrillBy],
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Add cross-filter')).not.toBeInTheDocument();
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});

test('Context menu shows "Drill by" with `can_drill`, `can_write` & `can_get_drill_info`  perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_write', 'ExploreFormDataRestApi'],
        ['can_drill', 'Dashboard'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});

test('Context menu shows "Drill by" with `can_drill`, `can_get_drill_info` & `can_explore` + `can_write` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_write', 'ExploreFormDataRestApi'],
        ['can_explore', 'Superset'],
        ['can_drill', 'Dashboard'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByText('Drill by')).toBeInTheDocument();
});

test('Context menu does not show "Drill by" with neither of required perms', () => {
  const result = setup({
    roles: {
      Admin: [['invalid_permission', 'Dashboard']],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill by')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill by" with just `can_dril` perm', () => {
  const result = setup({
    roles: {
      Admin: [['can_drill', 'Dashboard']],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill by')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill by" with just `can_dril` & `can_write` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_drill', 'Dashboard'],
        ['can_write', 'ExploreFormDataRestApi'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill by')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill by" with just `can_drill`, `can_explore` & `can_write` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_write', 'ExploreFormDataRestApi'],
        ['can_explore', 'Superset'],
        ['can_drill', 'Dashboard'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill by')).not.toBeInTheDocument();
});

test('Context menu shows "Drill to detail" with `can_samples`, `can_explore` & `can_get_drill_info` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_samples', 'Datasource'],
        ['can_explore', 'Superset'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Context menu shows "Drill to detail" with `can_drill`, `can_samples` & `can_get_drill_info` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_samples', 'Datasource'],
        ['can_drill', 'Dashboard'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Context menu shows "Drill to detail" with `can_drill`, `can_get_drill_info` & `can_explore` + `can_samples` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_samples', 'Datasource'],
        ['can_explore', 'Superset'],
        ['can_drill', 'Dashboard'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.getByText('Drill to detail')).toBeInTheDocument();
});

test('Context menu does not show "Drill to detail" with neither of required perms', () => {
  const result = setup({
    roles: {
      Admin: [['invalid_permission', 'Dashboard']],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill to detail" with just `can_drill` perm', () => {
  const result = setup({
    roles: {
      Admin: [['can_drill', 'Dashboard']],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill to detail" with just `can_drill` & `can_samples` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_drill', 'Dashboard'],
        ['can_samples', 'Datasource'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill to detail" with `can_samples` & `can_explore` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_samples', 'Datasource'],
        ['can_explore', 'Superset'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Context menu does not show "Drill to detail" with `can_drill`, `can_explore` + `can_samples` perms', () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_samples', 'Datasource'],
        ['can_explore', 'Superset'],
        ['can_drill', 'Dashboard'],
      ],
    },
  });
  result.current.onContextMenu(0, 0, {});
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});

test('Dataset drill info API call is made when user has drill permissions', async () => {
  const result = setup({
    roles: {
      Admin: [
        ['can_explore', 'Superset'],
        ['can_samples', 'Datasource'],
        ['can_write', 'ExploreFormDataRestApi'],
        ['can_get_drill_info', 'Dataset'],
      ],
    },
  });

  result.current.onContextMenu(0, 0, {});

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(mockCachedSupersetGet).toHaveBeenCalledWith({
    endpoint: expect.stringContaining(
      '/api/v1/dataset/1/drill_info/?q=(dashboard_id:',
    ),
  });
});

test('Dataset drill info API call is not made when user lacks drill permissions', async () => {
  const result = setup({
    roles: {
      Admin: [['invalid_permission', 'Dashboard']],
    },
  });

  result.current.onContextMenu(0, 0, {});

  await new Promise(resolve => setTimeout(resolve, 0));

  expect(mockCachedSupersetGet).not.toHaveBeenCalled();
  expect(screen.queryByText('Drill by')).not.toBeInTheDocument();
  expect(screen.queryByText('Drill to detail')).not.toBeInTheDocument();
});
