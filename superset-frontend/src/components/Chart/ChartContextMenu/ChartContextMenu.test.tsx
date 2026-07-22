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
import { useRef, useState } from 'react';
import { ContextMenuFilters, FeatureFlag, VizType } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import mockState from 'spec/fixtures/mockState';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import ChartContextMenu, {
  ChartContextMenuRef,
  ContextMenuItem,
} from './ChartContextMenu';

jest.mock('src/utils/cachedSupersetGet');

// The scope-selector behavior within the submenu (which filters get built
// for x-axis/series/both) is covered by DrillBySubmenu.test.tsx. Here we
// only need a stand-in that lets us trigger onDrillBy with a distinguishable
// config, so we can assert ChartContextMenu wires it into the modal.
jest.mock('../DrillBy/DrillBySubmenu', () => ({
  DrillBySubmenu: ({ onDrillBy }: any) => (
    <button
      type="button"
      data-test="fake-drill-by-submenu"
      onClick={() =>
        onDrillBy(
          { column_name: 'city', groupby: true },
          { id: 1, columns: [], metrics: [] },
          { filters: [{ col: 'selected_scope' }], groupbyFieldName: 'groupby' },
        )
      }
    >
      Fake Drill By
    </button>
  ),
}));

jest.mock('src/components/Chart/DrillBy/DrillByModal', () => ({
  __esModule: true,
  default: ({ drillByConfig }: any) => (
    <div data-test="drill-by-modal">{JSON.stringify(drillByConfig)}</div>
  ),
}));

const mockCachedSupersetGet = cachedSupersetGet as jest.MockedFunction<
  typeof cachedSupersetGet
>;

const defaultFormData = {
  datasource: '1__table',
  viz_type: VizType.Pie,
};

const TestWrapper = ({
  openFilters = {},
}: {
  openFilters?: ContextMenuFilters;
}) => {
  const contextMenuRef = useRef<ChartContextMenuRef>(null);
  const [isTooltipVisible, setIsTooltipVisible] = useState(true);

  const handleClose = () => {
    setIsTooltipVisible(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => contextMenuRef.current?.open(100, 100, openFilters)}
        data-test="open-context-menu"
      >
        Open Context Menu
      </button>
      {isTooltipVisible && (
        <div data-test="tooltip-visible">Tooltip is visible</div>
      )}
      <ChartContextMenu
        ref={contextMenuRef}
        id={sliceId}
        formData={defaultFormData}
        onSelection={jest.fn()}
        onClose={handleClose}
        displayedItems={ContextMenuItem.All}
      />
    </>
  );
};

const setup = (openFilters?: ContextMenuFilters) =>
  render(<TestWrapper openFilters={openFilters} />, {
    useRedux: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: {
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

beforeEach(() => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.DrillToDetail]: true,
    [FeatureFlag.DrillBy]: true,
  };

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

afterEach(() => {
  // @ts-ignore
  delete global.featureFlags;
});

test('tooltip is restored when user clicks outside to close context menu', async () => {
  setup();

  const openButton = screen.getByTestId('open-context-menu');
  userEvent.click(openButton);

  await waitFor(() => {
    expect(screen.getByTestId('chart-context-menu')).toBeInTheDocument();
  });

  expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();

  userEvent.click(document.body);

  await waitFor(() => {
    expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();
  });
});

test('tooltip is restored when user selects a menu item', async () => {
  setup();

  const openButton = screen.getByTestId('open-context-menu');
  userEvent.click(openButton);

  await waitFor(() => {
    expect(screen.getByTestId('chart-context-menu')).toBeInTheDocument();
  });

  const menuItem = screen.getByText('Drill to detail');
  userEvent.click(menuItem);

  await waitFor(() => {
    expect(screen.getByTestId('tooltip-visible')).toBeInTheDocument();
  });
});

test('drill by modal uses the scope selected in the submenu over the raw context filters', async () => {
  setup({
    drillBy: {
      filters: [{ col: 'raw_scope', op: '==', val: 'raw' }],
      groupbyFieldName: 'groupby',
    },
  });

  userEvent.click(screen.getByTestId('open-context-menu'));

  await waitFor(() => {
    expect(screen.getByTestId('chart-context-menu')).toBeInTheDocument();
  });

  const submenuButton = await screen.findByTestId('fake-drill-by-submenu');
  userEvent.click(submenuButton);

  await waitFor(() => {
    expect(screen.getByTestId('drill-by-modal')).toBeInTheDocument();
  });

  const modalConfig = JSON.parse(
    screen.getByTestId('drill-by-modal').textContent || '{}',
  );
  expect(modalConfig.filters).toEqual([{ col: 'selected_scope' }]);
});
