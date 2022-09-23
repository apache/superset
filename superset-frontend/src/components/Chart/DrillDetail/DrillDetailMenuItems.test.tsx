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
import { Menu } from 'src/components/Menu';
import {
  DrillDetailMenuItems,
  DrillDetailMenuItemsProps,
} from './DrillDetailMenuItems';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

const { id: chartId, form_data: supportedChartFormData } =
  chartQueries[sliceId];

const unsupportedChartFormData = {
  ...supportedChartFormData,
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

//  "Drill to detail" item should be enabled
const expectDrillToDetailMenuItem = () => {
  const drillToDetail = screen.queryByRole('menuitem', {
    name: 'Drill to detail',
  });

  expect(drillToDetail).toBeInTheDocument();
  expect(drillToDetail).toBeEnabled();
  expect(drillToDetail).toHaveTextContent('Drill to detail');
};

//  "Drill to detail" tooltip should not be present
const expectNoDrillToDetailMenuItemTooltip = () => {
  const noAggregationTooltip = screen.queryByRole('tooltip', {
    name: 'Drill to detail is disabled because this chart does not aggregate data by dimension value.',
  });

  expect(noAggregationTooltip).not.toBeInTheDocument();
};

//  "Drill to detail by" item should not be present
const expectNoDrillToDetailBySubMenu = () => {
  const drillToDetailBy = screen.queryByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).not.toBeInTheDocument();
};

//  "Drill to detail by" should be enabled
const expectDrillToDetailBySubMenu = async () => {
  const drillToDetailBy = screen.queryByRole('menuitem', {
    name: 'Drill to detail by',
  });

  expect(drillToDetailBy).toBeInTheDocument();
  expect(drillToDetailBy).toBeEnabled();

  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailByMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  expect(drillToDetailByMenu).toBeInTheDocument();
};

//  "Drill to detail by" unsupported chart message should be the only menu item
const expectUnsupportedChartMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailByMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const unsupportedChartMessage = screen.queryByRole('menuitem', {
    name: 'Drill to detail by value is not yet supported for this chart type.',
  });

  expect(unsupportedChartMessage).toBeInTheDocument();
  expect(unsupportedChartMessage).toHaveAttribute('aria-disabled', 'true');
  expect(drillToDetailByMenu).toContainElement(unsupportedChartMessage);

  const drillToDetailByDimension = screen.queryByRole('menuitem', {
    name: /Drill to detail by (?!value is not yet supported for this chart type\.)/,
  });

  expect(drillToDetailByDimension).not.toBeInTheDocument();
};

//  "Drill to detail by" unsupported click message should be the only menu item
const expectUnsupportedClickMessage = async () => {
  userEvent.hover(screen.getByRole('button', { name: 'Drill to detail by' }));
  const drillToDetailByMenu = await screen.findByTestId(
    'drill-to-detail-by-submenu',
  );

  const unsupportedClickMessage = screen.queryByRole('menuitem', {
    name: 'Right-click on a dimension value to drill to detail by that value.',
  });

  expect(unsupportedClickMessage).toBeInTheDocument();
  expect(unsupportedClickMessage).toHaveAttribute('aria-disabled', 'true');
  expect(drillToDetailByMenu).toContainElement(unsupportedClickMessage);

  const drillToDetailByDimension = screen.queryByRole('menuitem', {
    name: /Drill to detail by (?!value is not yet supported for this chart type\.)/,
  });

  expect(drillToDetailByDimension).not.toBeInTheDocument();
};

test('dropdown menu for unsupported chart', () => {
  renderMenu({ formData: unsupportedChartFormData });
  expectDrillToDetailMenuItem();
  expectNoDrillToDetailMenuItemTooltip();
  expectNoDrillToDetailBySubMenu();
});

test('context menu for unsupported chart', async () => {
  renderMenu({
    formData: unsupportedChartFormData,
    isContextMenu: true,
  });

  expectDrillToDetailMenuItem();
  expectNoDrillToDetailMenuItemTooltip();
  await expectDrillToDetailBySubMenu();
  await expectUnsupportedChartMessage();
});

test('dropdown menu for supported chart', () => {
  renderMenu({ formData: supportedChartFormData });
  expectDrillToDetailMenuItem();
  expectNoDrillToDetailMenuItemTooltip();
  expectNoDrillToDetailBySubMenu();
});

test('context menu for supported chart, no filters', async () => {
  renderMenu({
    formData: supportedChartFormData,
    isContextMenu: true,
  });

  expectDrillToDetailMenuItem();
  expectNoDrillToDetailMenuItemTooltip();
  await expectDrillToDetailBySubMenu();
  await expectUnsupportedClickMessage();
});

//  Atomic data tests
//  Drill by dimensions/all tests
//  Opening modal tests (see below)
//  Permissions tests
//  Change width

// const chart = chartQueries[sliceId];
// const setup = (overrides: Record<string, any> = {}) => {
//   const store = getMockStoreWithNativeFilters();
//   const props = {
//     chartId: sliceId,
//     formData: chart.form_data as unknown as QueryFormData,
//     ...overrides,
//   };
//   return render(
//     <Menu data-testid="menu">
//       <DrillDetailMenuItems {...props} />
//     </Menu>,
//     {
//       useRedux: true,
//       useRouter: true,
//       store,
//     },
//   );
// };
// const waitForRender = (overrides: Record<string, any> = {}) =>
//   waitFor(() => setup(overrides));

// fetchMock.post(
//   'end:/datasource/samples?force=false&datasource_type=table&datasource_id=7&per_page=50&page=1',
//   {
//     result: {
//       data: [],
//       colnames: [],
//       coltypes: [],
//     },
//   },
// );

// const mockHistoryPush = jest.fn();
// jest.mock('react-router-dom', () => ({
//   ...jest.requireActual('react-router-dom'),
//   useHistory: () => ({
//     push: mockHistoryPush,
//   }),
// }));

// test('should render', async () => {
//   const { container } = await waitForRender();
//   expect(container).toBeInTheDocument();
// });

// test('should render fallback menu', async () => {
//   await waitForRender();
//   console.log(screen.queryAllByText('Drill to detail'));
//   expect(screen.queryAllByTestId('menu-item-content')).toBeInTheDocument();
// });

// test('should render the title', async () => {
//   await waitForRender();
//   expect(
//     screen.getByText(`Drill to detail: ${chart.form_data.slice_name}`),
//   ).toBeInTheDocument();
// });

// test('should render the modal', async () => {
//   await waitForRender();
//   expect(screen.getByRole('dialog')).toBeInTheDocument();
// });

// test('should not render the modal', async () => {
//   await waitForRender({
//     initialFilters: undefined,
//   });
//   expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
// });

// test('should render the button', async () => {
//   await waitForRender();
//   expect(
//     screen.getByRole('button', { name: 'Edit chart' }),
//   ).toBeInTheDocument();
//   expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
// });

// test('should close the modal', async () => {
//   await waitForRender();
//   expect(screen.getByRole('dialog')).toBeInTheDocument();
//   userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
//   expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
// });

// test('should forward to Explore', async () => {
//   await waitForRender();
//   userEvent.click(screen.getByRole('button', { name: 'Edit chart' }));
//   expect(mockHistoryPush).toHaveBeenCalledWith(
//     `/explore/?dashboard_page_id=&slice_id=${sliceId}`,
//   );
// });
