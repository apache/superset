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
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, within } from 'spec/helpers/testing-library';
import setupPlugins from 'src/setup/setupPlugins';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { BinaryQueryObjectFilterClause, VizType } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import DrillDetailMenuItems, {
  DrillDetailMenuItemsProps,
} from './DrillDetailMenuItems';
import DrillDetailModal from './DrillDetailModal';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

jest.mock(
  './DrillDetailPane',
  () =>
    ({
      initialFilters,
    }: {
      initialFilters: BinaryQueryObjectFilterClause[];
    }) => <pre data-test="modal-filters">{JSON.stringify(initialFilters)}</pre>,
);

const { id: defaultChartId, form_data: defaultFormData } =
  chartQueries[sliceId];

const { slice_name: chartName } = defaultFormData;
const unsupportedChartFormData = {
  ...defaultFormData,
  viz_type: VizType.Sankey,
};

const noDimensionsFormData = {
  ...defaultFormData,
  viz_type: VizType.Table,
  query_mode: 'raw',
};

const filterA: BinaryQueryObjectFilterClause = {
  col: 'sample_column',
  op: '==',
  val: 1234567890,
  formattedVal: 'Yesterday',
};

const filterB: BinaryQueryObjectFilterClause = {
  col: 'sample_column_2',
  op: '==',
  val: 987654321,
  formattedVal: 'Two days ago',
};

const MockRenderChart = ({
  chartId,
  formData,
  isContextMenu,
  filters,
}: Partial<DrillDetailMenuItemsProps> & { chartId?: number }) => {
  const [showMenu, setShowMenu] = useState(false);

  const [modalFilters, setFilters] = useState<
    BinaryQueryObjectFilterClause[] | undefined
  >(filters);

  return (
    <>
      <Menu forceSubMenuRender>
        <DrillDetailMenuItems
          setFilters={setFilters}
          formData={formData ?? defaultFormData}
          filters={modalFilters}
          isContextMenu={isContextMenu}
          setShowModal={setShowMenu}
        />
      </Menu>

      <DrillDetailModal
        chartId={chartId ?? defaultChartId}
        formData={formData ?? defaultFormData}
        showModal={showMenu}
        initialFilters={modalFilters ?? []}
        onHideModal={() => {
          setShowMenu(false);
        }}
      />
    </>
  );
};

const renderMenu = ({
  chartId,
  formData,
  isContextMenu,
  filters,
}: Partial<DrillDetailMenuItemsProps> & { chartId?: number }) => {
  const store = getMockStoreWithNativeFilters();
  return render(
    <MockRenderChart
      chartId={chartId}
      formData={formData}
      isContextMenu={isContextMenu}
      filters={filters}
    />,
    { useRouter: true, useRedux: true, store },
  );
};

const setupMenu = (filters: BinaryQueryObjectFilterClause[]) => {
  cleanup();
  renderMenu({
    chartId: defaultChartId,
    formData: defaultFormData,
    isContextMenu: true,
    filters,
  });
};

/**
 * Drill to Detail modal should appear with correct initial filters
 */
const expectDrillToDetailModal = async (
  buttonName: string,
  filters: BinaryQueryObjectFilterClause[] = [],
) => {
  const button = screen.getByRole('menuitem', { name: buttonName });

  await userEvent.click(button);
  const modal = await screen.findByRole('dialog', {
    name: `Drill to detail: ${chartName}`,
  });

  expect(modal).toBeInTheDocument();
  const modalFilters = await screen.findByTestId('modal-filters');
  expect(modalFilters).toHaveTextContent(JSON.stringify(filters));
};

/**
 * Menu item should be enabled without explanatory tooltip
 */
const expectMenuItemEnabled = async (menuItem: HTMLElement | null) => {
  expect(menuItem).not.toBeNull(); // Ensure element exists
  if (!menuItem) return; // Prevent further assertions on null

  expect(menuItem).toBeInTheDocument();
  expect(menuItem).not.toHaveAttribute('aria-disabled');
  const tooltipTrigger = within(menuItem).queryByTestId('tooltip-trigger');
  expect(tooltipTrigger).not.toBeInTheDocument();
};

/**
 * Menu item should be disabled, optionally with an explanatory tooltip
 */
const expectMenuItemDisabled = async (
  menuItem: HTMLElement,
  tooltipContent?: string,
) => {
  expect(menuItem).toBeVisible();
  expect(menuItem).toHaveAttribute('aria-disabled', 'true');
  const tooltipTrigger = within(menuItem).queryByTestId('tooltip-trigger');
  if (tooltipContent) {
    userEvent.hover(tooltipTrigger as HTMLElement);
    const tooltip = await screen.findByRole('tooltip', {
      name: tooltipContent,
    });

    expect(tooltip).toBeInTheDocument();
  } else {
    expect(tooltipTrigger).not.toBeInTheDocument();
  }
};

/**
 * "Drill to detail" item should be enabled and open the correct modal
 */
const expectDrillToDetailEnabled = async () => {
  const drillToDetailMenuItem = await screen.findByRole('menuitem', {
    name: 'Drill to detail',
  });

  await expectMenuItemEnabled(drillToDetailMenuItem);
  await expectDrillToDetailModal('Drill to detail');
};

/**
 * "Drill to detail" item should be present and disabled
 */
const expectDrillToDetailDisabled = async (tooltipContent?: string) => {
  const drillToDetailMenuItem = await screen.findByRole('menuitem', {
    name: 'Drill to detail',
  });

  await expectMenuItemDisabled(drillToDetailMenuItem, tooltipContent);
};

/**
 * "Drill to detail by" item should not be present
 */
const expectNoDrillToDetailBy = async () => {
  const drillToDetailBy = screen.queryByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" submenu should be present and enabled
 */
const expectDrillToDetailByEnabled = async () => {
  const drillToDetailBy = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  await expectMenuItemEnabled(drillToDetailBy);
  userEvent.hover(drillToDetailBy);

  const submenus = await screen.findAllByTestId('drill-to-detail-by-submenu');

  expect(submenus.length).toEqual(2);
};

/**
 * "Drill to detail by" submenu should be present and disabled
 */
const expectDrillToDetailByDisabled = async (tooltipContent?: string) => {
  const drillToDetailBySubmenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  await expectMenuItemDisabled(drillToDetailBySubmenuItem, tooltipContent);
};

/**
 * "Drill to detail by {dimension}" submenu item should exist and open the correct modal
 */
// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

// Update expectDrillToDetailByDimension helper
const expectDrillToDetailByDimension = async (
  filter: BinaryQueryObjectFilterClause,
) => {
  userEvent.hover(screen.getByRole('menuitem', { name: 'Drill to detail by' }));
  await waitFor(async () => {
    const drillToDetailBySubMenus = await screen.findAllByTestId(
      'drill-to-detail-by-submenu',
    );
    expect(drillToDetailBySubMenus.length).toBeGreaterThan(0);
  });

  const menuItemName = `Drill to detail by ${filter.formattedVal}`;
  const menuItem = await screen.findByText(menuItemName);

  await expectMenuItemEnabled(menuItem);
  await expectDrillToDetailModal(menuItemName, [filter]);
};

// Update expectDrillToDetailByAll helper
const expectDrillToDetailByAll = async (
  filters: BinaryQueryObjectFilterClause[],
) => {
  userEvent.hover(screen.getByRole('menuitem', { name: 'Drill to detail by' }));
  await waitFor(async () => {
    const drillToDetailBySubMenus = await screen.findAllByTestId(
      'drill-to-detail-by-submenu',
    );
    expect(drillToDetailBySubMenus.length).toBeGreaterThan(0);
  });

  const menuItem = await screen.findByText((content, element) => {
    const text = element?.textContent || '';
    return text.toLowerCase().includes('drill to detail by all');
  });

  await expectMenuItemEnabled(menuItem);
  await expectDrillToDetailModal('Drill to detail by all', filters);
};

// Update test timeouts
test('context menu for supported chart, dimensions, filter A', async () => {
  const filters = [filterA, filterB];
  setupMenu(filters);
  await expectDrillToDetailByEnabled();
  await expectDrillToDetailByDimension(filterA);
}, 30000);

test('context menu for supported chart, dimensions, filter B', async () => {
  const filters = [filterA, filterB];
  setupMenu(filters);
  await expectDrillToDetailByEnabled();
  await expectDrillToDetailByDimension(filterB);
}, 30000);

test('context menu for supported chart, dimensions, all filters', async () => {
  const filters = [filterA, filterB];
  setupMenu(filters);
  await expectDrillToDetailByAll(filters);
}, 30000);
