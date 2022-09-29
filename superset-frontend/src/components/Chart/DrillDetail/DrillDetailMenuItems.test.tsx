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

jest.mock('./DrillDetailPane', () => () => null);

const { id: chartId, form_data: chartFormData } = chartQueries[sliceId];

const { slice_name: chartName } = chartFormData;
const unsupportedChartFormData = {
  ...chartFormData,
  viz_type: 'dist_bar',
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
  filters?: QueryObjectFilterClause[],
) => {
  const button = screen.getByRole('menuitem', { name: buttonName });
  userEvent.click(button);
  const modal = await screen.findByRole('dialog', {
    name: `Drill to detail: ${chartName}`,
  });

  expect(modal).toBeVisible();
  expect(screen.queryAllByRole('clearable-filter')).toHaveLength(
    filters?.length ?? 0,
  );

  if (filters) {
    filters.forEach(({ col, formattedVal }) =>
      expect(
        screen.findByRole('clearable-filter', {
          name: `${col} ${formattedVal}`,
        }),
      ).toBeVisible(),
    );
  }
};

/**
 * "Drill to detail" item should be enabled
 */
const expectDrillToDetailMenuItem = async () => {
  const drillToDetailMenuItem = screen.getByRole('menuitem', {
    name: 'Drill to detail',
  });

  const noAggregationTooltip = screen.queryByRole('tooltip', {
    name: 'Drill to detail is disabled because this chart does not aggregate data by dimension value.',
  });

  expect(drillToDetailMenuItem).toBeVisible();
  expect(drillToDetailMenuItem).toBeEnabled();
  expect(noAggregationTooltip).not.toBeInTheDocument();
  await expectDrillToDetailModal('Drill to detail');
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

//  "Drill to detail by" submenu should be enabled
const expectDrillToDetailBySubMenu = async () => {
  const drillToDetailBy = screen.getByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).toBeVisible();
  expect(drillToDetailBy).toBeEnabled();
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  expect(
    await screen.findByTestId('drill-to-detail-by-submenu'),
  ).toBeInTheDocument();
};

/**
 * "Drill to detail by" unsupported chart message should be the only menu item
 */
const expectUnsupportedChartMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailByMenu = await screen.findByTestId(
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
  expect(drillToDetailByMenu).toContainElement(unsupportedChartMessage);
  expect(drillToDetailByDimension).not.toBeInTheDocument();
};

/**
 * "Drill to detail by" unsupported click message should be the only menu item
 */
const expectUnsupportedClickMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailByMenu = await screen.findByTestId(
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
  expect(drillToDetailByMenu).toContainElement(unsupportedClickMessage);
  expect(drillToDetailByDimension).not.toBeInTheDocument();
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

test.todo(
  'dropdown menu for supported chart, no dimensions',
  // async () => {
  //   renderMenu({
  //     formData: noDimensionsFormData,
  //   });
  //   await expectDrillToDetailMenuItemDisabled();
  //   await expectNoDrillToDetailBySubMenu();
  // }
);

test.todo(
  'context menu for supported chart, no dimensions, no filters',
  // async () => {
  //   renderMenu({
  //     formData: noDimensionsFormData,
  //     isContextMenu: true,
  //   });
  //   await expectDrillToDetailMenuItemDisabled();
  //   await expectDrillToDetailBySubMenuDisabled();
  // },
);

test.todo(
  'context menu for supported chart, no dimensions, 1 filter',
  // async () => {
  // renderMenu({
  //   formData: noDimensionsFormData,
  //   isContextMenu: true,
  //   contextPayload: { filters: [filterA] },
  // });
  // await expectDrillToDetailMenuItemDisabled();
  // await expectDrillToDetailBySubMenuDisabled();
  // },
);

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

test.todo(
  'context menu for supported chart, dimensions, 1 filter',
  // async () => {
  // const filters = [filterA];
  // renderMenu({
  //   formData: chartFormData,
  //   isContextMenu: true,
  //   contextPayload: { filters },
  // });
  // await expectDrillToDetailMenuItem();
  // await expectDrillToDetailBySubMenu();
  // await expectDrillToDetailBySubmenuItem(filterA);
  // },
);

test.todo(
  'context menu for supported chart, dimensions, 2 filters',
  // async () => {
  // const filters = [filterA, filterB];
  // renderMenu({
  //   formData: chartFormData,
  //   isContextMenu: true,
  //   contextPayload: { filters },
  // });
  // await expectDrillToDetailMenuItem();
  // await expectDrillToDetailBySubMenu();
  // await expectDrillToDetailBySubmenuItem(filterA);
  // await expectDrillToDetailBySubmenuItem(filterB);
  // await expectDrillToDetailBySubmenuItem([filters]);
  // },
);
