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
import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { QueryObjectFilterClause } from '@superset-ui/core';
import { Menu } from 'src/components/Menu';
import {
  DrillDetailMenuItems,
  DrillDetailMenuItemsProps,
} from './DrillDetailMenuItems';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

jest.mock(
  './DrillDetailPane',
  () =>
    ({ initialFilters }: { initialFilters: QueryObjectFilterClause[] }) =>
      <pre data-test="modal-filters">{JSON.stringify(initialFilters)}</pre>,
);

const { id: chartId, form_data: chartFormData } = chartQueries[sliceId];

const { slice_name: chartName } = chartFormData;
const unsupportedChartFormData = {
  ...chartFormData,
  viz_type: 'dist_bar',
};

const noDimensionsFormData = {
  ...chartFormData,
  viz_type: 'table',
  query_mode: 'raw',
};

const filterA: QueryObjectFilterClause = {
  col: 'sample_column',
  op: '==',
  val: 1234567890,
  formattedVal: 'Yesterday',
};

const filterB: QueryObjectFilterClause = {
  col: 'sample_column_2',
  op: '==',
  val: 987654321,
  formattedVal: 'Two days ago',
};

const renderMenu = (props: Omit<DrillDetailMenuItemsProps, 'chartId'>) => {
  const store = getMockStoreWithNativeFilters();
  return render(
    <Menu>
      <DrillDetailMenuItems chartId={chartId} {...props} />
    </Menu>,
    { useRouter: true, useRedux: true, store },
  );
};

/**
 * Drill to Detail modal should appear with correct initial filters
 */
const expectDrillToDetailModal = async (
  buttonName: string,
  filters: QueryObjectFilterClause[] = [],
) => {
  const button = screen.getByRole('menuitem', { name: buttonName });
  userEvent.click(button);
  const modal = await screen.findByRole('dialog', {
    name: `Drill to detail: ${chartName}`,
  });

  expect(modal).toBeVisible();
  expect(screen.getByTestId('modal-filters')).toHaveTextContent(
    JSON.stringify(filters),
  );
};

/**
 * "Drill to detail" item should be enabled and open the correct modal
 */
const expectDrillToDetailMenuItem = async () => {
  const drillToDetailMenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail',
  });

  const drillToDetailTooltipTrigger = screen.queryByTestId(
    'no-aggregations-tooltip-trigger',
  );

  expect(drillToDetailMenuItem).toBeVisible();
  expect(drillToDetailMenuItem).not.toHaveAttribute('aria-disabled');
  expect(drillToDetailTooltipTrigger).not.toBeInTheDocument();
  await expectDrillToDetailModal('Drill to detail');
};

/**
 * "Drill to detail" item should be disabled with tooltip
 */
const expectDrillToDetailMenuItemDisabled = async () => {
  const drillToDetailMenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail',
  });

  userEvent.hover(screen.getByTestId('no-aggregations-tooltip-trigger'));
  const noAggregationTooltip = await screen.findByRole('tooltip', {
    name: 'Drill to detail is disabled because this chart does not group data by dimension value.',
  });

  expect(drillToDetailMenuItem).toBeVisible();
  expect(drillToDetailMenuItem).toHaveAttribute('aria-disabled', 'true');
  expect(noAggregationTooltip).toBeInTheDocument();
};

/**
 * "Drill to detail by" item should not be present
 */
const expectNoDrillToDetailBySubMenu = async () => {
  const drillToDetailBy = screen.queryByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" submenu should be present and enabled
 */
const expectDrillToDetailBySubMenu = async () => {
  const drillToDetailBy = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).toBeVisible();
  expect(drillToDetailBy).not.toHaveClass('ant-menu-submenu-disabled');
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  expect(
    await screen.findByTestId('drill-to-detail-by-submenu'),
  ).toBeInTheDocument();
};

/**
 * "Drill to detail by" submenu should be present and disabled
 */
const expectDrillToDetailBySubMenuDisabled = async () => {
  const drillToDetailBy = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).toBeVisible();
  expect(drillToDetailBy).toHaveClass('ant-menu-submenu-disabled');
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  expect(
    screen.queryByTestId('drill-to-detail-by-submenu'),
  ).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" unsupported chart message should be the only menu item
 */
const expectUnsupportedChartMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailBySubMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const unsupportedChartMessage = screen.queryByRole('menuitem', {
    name: 'Drill to detail by value is not yet supported for this chart type.',
  });

  const drillToDetailByDimension = screen.queryByRole('menuitem', {
    name: /Drill to detail by (?!value is not yet supported for this chart type\.)/,
  });

  expect(unsupportedChartMessage).toBeInTheDocument();
  expect(unsupportedChartMessage).toHaveAttribute('aria-disabled', 'true');
  expect(drillToDetailBySubMenu).toContainElement(unsupportedChartMessage);
  expect(drillToDetailByDimension).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" unsupported click message should be the only menu item
 */
const expectUnsupportedClickMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailBySubMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const unsupportedClickMessage = screen.queryByRole('menuitem', {
    name: 'Right-click on a dimension value to drill to detail by that value.',
  });

  const drillToDetailByDimension = screen.queryByRole('menuitem', {
    name: /Drill to detail by (?!value is not yet supported for this chart type\.)/,
  });

  expect(unsupportedClickMessage).toBeInTheDocument();
  expect(unsupportedClickMessage).toHaveAttribute('aria-disabled', 'true');
  expect(drillToDetailBySubMenu).toContainElement(unsupportedClickMessage);
  expect(drillToDetailByDimension).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" submenu item should exist and open the correct modal
 */
const expectDrillToDetailByDimension = async (
  filter: QueryObjectFilterClause,
) => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailBySubMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const menuItemName = `Drill to detail by ${filter.formattedVal}`;
  const drillToDetailBySubmenuItem = screen.getByRole('menuitem', {
    name: menuItemName,
  });

  expect(drillToDetailBySubmenuItem).toBeInTheDocument();
  expect(drillToDetailBySubmenuItem).not.toHaveAttribute('aria-disabled');
  expect(drillToDetailBySubMenu).toContainElement(drillToDetailBySubmenuItem);
  await expectDrillToDetailModal(menuItemName, [filter]);
};

/**
 * "Drill to detail by" submenu item should exist and open the correct modal
 */
const expectDrillToDetailByAll = async (filters: QueryObjectFilterClause[]) => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailBySubMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const menuItemName = 'Drill to detail by all';
  const drillToDetailBySubmenuItem = screen.getByRole('menuitem', {
    name: menuItemName,
  });

  expect(drillToDetailBySubmenuItem).toBeInTheDocument();
  expect(drillToDetailBySubmenuItem).not.toHaveAttribute('aria-disabled');
  expect(drillToDetailBySubMenu).toContainElement(drillToDetailBySubmenuItem);
  await expectDrillToDetailModal(menuItemName, filters);
};

test('dropdown menu for unsupported chart', async () => {
  renderMenu({ formData: unsupportedChartFormData });
  await expectDrillToDetailMenuItem();
  await expectNoDrillToDetailBySubMenu();
  await expectDrillToDetailModal('Drill to detail');
});

test('context menu for unsupported chart', async () => {
  renderMenu({
    formData: unsupportedChartFormData,
    isContextMenu: true,
  });

  await expectDrillToDetailMenuItem();
  await expectDrillToDetailBySubMenu();
  await expectUnsupportedChartMessage();
});

test('dropdown menu for supported chart, no dimensions', async () => {
  renderMenu({
    formData: noDimensionsFormData,
  });

  await expectDrillToDetailMenuItemDisabled();
  await expectNoDrillToDetailBySubMenu();
});

test('context menu for supported chart, no dimensions, no filters', async () => {
  renderMenu({
    formData: noDimensionsFormData,
    isContextMenu: true,
  });

  await expectDrillToDetailMenuItemDisabled();
  await expectDrillToDetailBySubMenuDisabled();
});

test('context menu for supported chart, no dimensions, 1 filter', async () => {
  renderMenu({
    formData: noDimensionsFormData,
    isContextMenu: true,
    contextPayload: { filters: [filterA] },
  });

  await expectDrillToDetailMenuItemDisabled();
  await expectDrillToDetailBySubMenuDisabled();
});

test('dropdown menu for supported chart, dimensions', async () => {
  renderMenu({ formData: chartFormData });
  await expectDrillToDetailMenuItem();
  await expectNoDrillToDetailBySubMenu();
});

test('context menu for supported chart, dimensions, no filters', async () => {
  renderMenu({
    formData: chartFormData,
    isContextMenu: true,
  });

  await expectDrillToDetailMenuItem();
  await expectDrillToDetailBySubMenu();
  await expectUnsupportedClickMessage();
});

test('context menu for supported chart, dimensions, 1 filter', async () => {
  const filters = [filterA];
  renderMenu({
    formData: chartFormData,
    isContextMenu: true,
    contextPayload: { filters },
  });

  await expectDrillToDetailMenuItem();
  await expectDrillToDetailBySubMenu();
  await expectDrillToDetailByDimension(filterA);
});

test('context menu for supported chart, dimensions, 2 filters', async () => {
  const filters = [filterA, filterB];
  renderMenu({
    formData: chartFormData,
    isContextMenu: true,
    contextPayload: { filters },
  });

  await expectDrillToDetailMenuItem();
  await expectDrillToDetailBySubMenu();
  await expectDrillToDetailByDimension(filterA);
  await expectDrillToDetailByDimension(filterB);
  await expectDrillToDetailByAll(filters);
});
