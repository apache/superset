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
import {
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import setupPlugins from 'src/setup/setupPlugins';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { BinaryQueryObjectFilterClause, VizType } from '@superset-ui/core';
import { Menu } from '@superset-ui/core/components/Menu';
import DrillDetailModal from '../DrillDetail/DrillDetailModal';
import { useDrillDetailMenuItems, DrillDetailMenuItemsProps } from './index';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

jest.mock(
  '../DrillDetail/DrillDetailPane',
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

  const menuItems = useDrillDetailMenuItems({
    setFilters,
    formData: formData ?? defaultFormData,
    filters: modalFilters,
    isContextMenu,
    setShowModal: setShowMenu,
  });

  return (
    <>
      <Menu forceSubMenuRender items={menuItems} />

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

const setupMenu = async (filters: BinaryQueryObjectFilterClause[]) => {
  cleanup();
  // Small delay to ensure DOM cleanup is complete
  await new Promise(resolve => setTimeout(resolve, 10));
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
  buttonName: string | null,
  filters: BinaryQueryObjectFilterClause[] = [],
) => {
  if (buttonName) {
    const button = screen.getByRole('menuitem', { name: buttonName });
    userEvent.click(button);
  }
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
const expectMenuItemEnabled = async (menuItem: HTMLElement) => {
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
  const drillToDetailMenuItem = screen
    .getAllByRole('menuitem')
    .find(menuItem => within(menuItem).queryByText('Drill to detail'));
  expect(drillToDetailMenuItem).toBeDefined();
  await expectMenuItemEnabled(drillToDetailMenuItem!);
  await expectDrillToDetailModal('Drill to detail');
};

/**
 * "Drill to detail" item should be present and disabled
 */
const expectDrillToDetailDisabled = async (tooltipContent?: string) => {
  const drillToDetailMenuItem = screen
    .getAllByRole('menuitem')
    .find(menuItem => within(menuItem).queryByText('Drill to detail'));

  expect(drillToDetailMenuItem).toBeDefined();
  await expectMenuItemDisabled(drillToDetailMenuItem!, tooltipContent);
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
  const drillToDetailBy = screen
    .getAllByRole('menuitem')
    .find(menuItem => within(menuItem).queryByText('Drill to detail by'));
  await expectMenuItemEnabled(drillToDetailBy!);

  userEvent.hover(drillToDetailBy!);

  const submenu = await screen.findByRole('menu', {});
  expect(submenu).toBeInTheDocument();
};

/**
 * "Drill to detail by" submenu should be present and disabled
 */
const expectDrillToDetailByDisabled = async (tooltipContent?: string) => {
  const drillToDetailBySubmenuItem = screen
    .getAllByRole('menuitem')
    .find(menuItem => within(menuItem).queryByText('Drill to detail by'));
  await expectMenuItemDisabled(drillToDetailBySubmenuItem!, tooltipContent);
};

/**
 * "Drill to detail by {dimension}" submenu item should exist and open the correct modal
 */
const expectDrillToDetailByDimension = async (
  filter: BinaryQueryObjectFilterClause,
) => {
  const formattedVal = filter.formattedVal as string;
  const drillByMenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  userEvent.hover(drillByMenuItem);

  const submenuPopup = (await waitFor(() =>
    screen
      .getAllByRole('menu', { hidden: true })
      .find(menu =>
        (menu.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .includes(formattedVal),
      ),
  )) as HTMLElement;

  const drillToDetailBySubmenuItem = (await waitFor(() => {
    const items = within(submenuPopup).getAllByRole('menuitem');
    return items.find(item =>
      (item.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .includes(`Drill to detail by ${filter.formattedVal}`),
    );
  })) as HTMLElement;

  const menuItemName = `Drill to detail by ${filter.formattedVal}`;

  await expectMenuItemEnabled(drillToDetailBySubmenuItem);
  await expectDrillToDetailModal(menuItemName, [filter]);
};

/**
 * "Drill to detail by all" submenu item should exist and open the correct modal
 */
const expectDrillToDetailByAll = async (
  filters: BinaryQueryObjectFilterClause[],
) => {
  const drillByMenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  userEvent.hover(drillByMenuItem);

  await screen.findByRole('menu');

  const drillToDetailBySubmenuItem = await screen.findByText(/all/i, {});

  await expectMenuItemEnabled(drillToDetailBySubmenuItem);

  userEvent.click(drillToDetailBySubmenuItem);
  await expectDrillToDetailModal(null, filters);
};

beforeAll(() => {
  setupPlugins();
});

test('dropdown menu for unsupported chart', async () => {
  renderMenu({ formData: unsupportedChartFormData });
  await expectDrillToDetailEnabled();
  await expectNoDrillToDetailBy();
});

test('context menu for unsupported chart', async () => {
  renderMenu({
    formData: unsupportedChartFormData,
    isContextMenu: true,
  });

  await expectDrillToDetailEnabled();
  await expectDrillToDetailByDisabled(
    'Drill to detail by value is not yet supported for this chart type.',
  );
});

test('dropdown menu for supported chart, no dimensions', async () => {
  renderMenu({
    formData: noDimensionsFormData,
  });

  await expectDrillToDetailDisabled(
    'Drill to detail is disabled because this chart does not group data by dimension value.',
  );

  await expectNoDrillToDetailBy();
});

test('context menu for supported chart, no dimensions, no filters', async () => {
  renderMenu({
    formData: noDimensionsFormData,
    isContextMenu: true,
  });

  const message =
    'Drill to detail is disabled because this chart does not group data by dimension value.';

  await expectDrillToDetailDisabled(message);
  await expectDrillToDetailByDisabled(message);
});

test('context menu for supported chart, no dimensions, 1 filter', async () => {
  renderMenu({
    formData: noDimensionsFormData,
    isContextMenu: true,
    filters: [filterA],
  });

  const message =
    'Drill to detail is disabled because this chart does not group data by dimension value.';

  await expectDrillToDetailDisabled(message);
  await expectDrillToDetailByDisabled(message);
});

test('dropdown menu for supported chart, dimensions', async () => {
  renderMenu({ formData: defaultFormData });
  await expectDrillToDetailEnabled();
  await expectNoDrillToDetailBy();
});

test('context menu for supported chart, dimensions, no filters', async () => {
  renderMenu({
    formData: defaultFormData,
    isContextMenu: true,
  });

  await expectDrillToDetailEnabled();
  await expectDrillToDetailByDisabled(
    'Right-click on a dimension value to drill to detail by that value.',
  );
});

test('context menu for supported chart, dimensions, 1 filter', async () => {
  const filters = [filterA];
  renderMenu({
    formData: defaultFormData,
    isContextMenu: true,
    filters,
  });

  await expectDrillToDetailByEnabled();
  await expectDrillToDetailByDimension(filterA);
});

test('context menu for supported chart, dimensions, filter A', async () => {
  const filters = [filterA, filterB];
  await setupMenu(filters);
  await expectDrillToDetailByEnabled();
  await expectDrillToDetailByDimension(filterA);
});

test('context menu for supported chart, dimensions, filter B', async () => {
  const filters = [filterA, filterB];
  await setupMenu(filters);
  await expectDrillToDetailByEnabled();
  await expectDrillToDetailByDimension(filterB);
});

test.skip('context menu for supported chart, dimensions, all filters', async () => {
  const filters = [filterA, filterB];
  await setupMenu(filters);
  await expectDrillToDetailByAll(filters);
});
