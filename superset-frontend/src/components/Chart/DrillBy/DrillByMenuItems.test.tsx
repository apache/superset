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
import {
  Behavior,
  ChartMetadata,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import { render, screen, within, waitFor } from 'spec/helpers/testing-library';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { Menu } from 'src/components/Menu';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import { DrillByMenuItems, DrillByMenuItemsProps } from './DrillByMenuItems';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

const datasetEndpointMatcher = 'glob:*/api/v1/dataset/7';
const { form_data: defaultFormData } = chartQueries[sliceId];

const defaultColumns = [
  { column_name: 'col1', groupby: true },
  { column_name: 'col2', groupby: true },
  { column_name: 'col3', groupby: true },
  { column_name: 'col4', groupby: true },
  { column_name: 'col5', groupby: true },
  { column_name: 'col6', groupby: true },
  { column_name: 'col7', groupby: true },
  { column_name: 'col8', groupby: true },
  { column_name: 'col9', groupby: true },
  { column_name: 'col10', groupby: true },
  { column_name: 'col11', groupby: true },
];

const defaultFilters = [
  {
    col: 'filter_col',
    op: '==' as const,
    val: 'val',
  },
];

const renderMenu = ({
  formData = defaultFormData,
  filters = defaultFilters,
}: Partial<DrillByMenuItemsProps>) =>
  render(
    <Menu>
      <DrillByMenuItems
        formData={formData ?? defaultFormData}
        filters={filters}
        groupbyFieldName="groupby"
      />
    </Menu>,
    { useRouter: true, useRedux: true },
  );

const expectDrillByDisabled = async (tooltipContent: string) => {
  const drillByMenuItem = screen.getByRole('menuitem', {
    name: 'Drill by',
  });

  expect(drillByMenuItem).toBeVisible();
  expect(drillByMenuItem).toHaveAttribute('aria-disabled', 'true');
  const tooltipTrigger = within(drillByMenuItem).getByTestId('tooltip-trigger');
  userEvent.hover(tooltipTrigger as HTMLElement);
  const tooltip = await screen.findByRole('tooltip', { name: tooltipContent });

  expect(tooltip).toBeInTheDocument();
};

const expectDrillByEnabled = async () => {
  const drillByMenuItem = screen.getByRole('menuitem', {
    name: 'Drill by',
  });
  expect(drillByMenuItem).toBeInTheDocument();
  await waitFor(() =>
    expect(drillByMenuItem).not.toHaveAttribute('aria-disabled'),
  );
  const tooltipTrigger =
    within(drillByMenuItem).queryByTestId('tooltip-trigger');
  expect(tooltipTrigger).not.toBeInTheDocument();

  userEvent.hover(
    within(drillByMenuItem).getByRole('button', { name: 'Drill by' }),
  );
  expect(await screen.findByTestId('drill-by-submenu')).toBeInTheDocument();
};

getChartMetadataRegistry().registerValue(
  'pie',
  new ChartMetadata({
    name: 'fake pie',
    thumbnail: '.png',
    useLegacyApi: false,
    behaviors: [Behavior.DRILL_BY],
  }),
);

afterEach(() => {
  supersetGetCache.clear();
  fetchMock.restore();
});

test('render disabled menu item for unsupported chart', async () => {
  renderMenu({
    formData: { ...defaultFormData, viz_type: 'unsupported_viz' },
  });
  await expectDrillByDisabled(
    'Drill by is not yet supported for this chart type',
  );
});

test('render disabled menu item for supported chart, no filters', async () => {
  renderMenu({ filters: [] });
  await expectDrillByDisabled('Drill by is not available for this data point');
});

test('render disabled menu item for supported chart, no columns', async () => {
  fetchMock.get(datasetEndpointMatcher, { result: { columns: [] } });
  renderMenu({});
  await waitFor(() => fetchMock.called(datasetEndpointMatcher));
  await expectDrillByDisabled('No dimensions available for drill by');
});

test('render menu item with submenu without searchbox', async () => {
  const slicedColumns = defaultColumns.slice(0, 9);
  fetchMock.get(datasetEndpointMatcher, {
    result: { columns: slicedColumns },
  });
  renderMenu({});
  await waitFor(() => fetchMock.called(datasetEndpointMatcher));
  await expectDrillByEnabled();
  slicedColumns.forEach(column => {
    expect(screen.getByText(column.column_name)).toBeInTheDocument();
  });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('render menu item with submenu and searchbox', async () => {
  fetchMock.get(datasetEndpointMatcher, {
    result: { columns: defaultColumns },
  });
  renderMenu({});
  await waitFor(() => fetchMock.called(datasetEndpointMatcher));
  await expectDrillByEnabled();
  defaultColumns.forEach(column => {
    expect(screen.getByText(column.column_name)).toBeInTheDocument();
  });

  const searchbox = screen.getByRole('textbox');
  expect(searchbox).toBeInTheDocument();

  userEvent.type(searchbox, 'col1');

  await screen.findByText('col1');

  const expectedFilteredColumnNames = ['col1', 'col10', 'col11'];

  defaultColumns
    .filter(col => !expectedFilteredColumnNames.includes(col.column_name))
    .forEach(col => {
      expect(screen.queryByText(col.column_name)).not.toBeInTheDocument();
    });

  expectedFilteredColumnNames.forEach(colName => {
    expect(screen.getByText(colName)).toBeInTheDocument();
  });
});
