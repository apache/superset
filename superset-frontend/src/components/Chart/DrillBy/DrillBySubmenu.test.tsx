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
  Behavior,
  ChartMetadata,
  getChartMetadataRegistry,
} from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import { DrillBySubmenu, DrillBySubmenuProps } from './DrillBySubmenu';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

const { form_data: defaultFormData } = chartQueries[sliceId];

jest.mock('lodash/debounce', () => (fn: Function & { debounce: Function }) => {
  // eslint-disable-next-line no-param-reassign
  fn.debounce = jest.fn();
  return fn;
});

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

const mockDataset = {
  id: 7,
  table_name: 'test_table',
  columns: defaultColumns,
  drillable_columns: defaultColumns,
  changed_on_humanized: '1 day ago',
  created_on_humanized: '2 days ago',
  description: 'Test dataset',
  owners: [],
  changed_by: { first_name: 'Test', last_name: 'User' },
  created_by: { first_name: 'Test', last_name: 'User' },
};

const defaultFilters = [
  {
    col: 'filter_col',
    op: '==' as const,
    val: 'val',
  },
];

const renderSubmenu = ({
  formData = defaultFormData,
  drillByConfig = { filters: defaultFilters, groupbyFieldName: 'groupby' },
  dataset = mockDataset,
  ...rest
}: Partial<DrillBySubmenuProps>) =>
  render(
    <DrillBySubmenu
      formData={formData ?? defaultFormData}
      drillByConfig={drillByConfig}
      dataset={dataset}
      {...rest}
    />,
    { useRouter: true, useRedux: true },
  );

const expectDrillByDisabled = async (tooltipContent: string) => {
  const drillByButton = screen.getByRole('button', { name: /drill by/i });
  expect(drillByButton).toBeInTheDocument();
  expect(drillByButton).toBeVisible();
  expect(drillByButton).toHaveAttribute('tabindex', '-1');

  const tooltipTrigger = within(drillByButton).getByTestId('tooltip-trigger');
  userEvent.hover(tooltipTrigger as HTMLElement);

  const tooltip = await screen.findByRole('tooltip', { name: tooltipContent });
  expect(tooltip).toBeInTheDocument();
};

const expectDrillByEnabled = async () => {
  const drillByButton = screen.getByRole('button', { name: /drill by/i });
  expect(drillByButton).toBeInTheDocument();
  expect(drillByButton).not.toHaveAttribute('tabindex', '-1');

  const tooltipTrigger = within(drillByButton).queryByTestId('tooltip-trigger');
  expect(tooltipTrigger).not.toBeInTheDocument();

  userEvent.hover(drillByButton);

  const popover = await screen.findByRole('menu');
  expect(popover).toBeInTheDocument();
};

getChartMetadataRegistry().registerValue(
  'pie',
  new ChartMetadata({
    name: 'fake pie',
    thumbnail: '.png',
    useLegacyApi: false,
    behaviors: [Behavior.DrillBy],
  }),
);

afterEach(() => {
  supersetGetCache.clear();
  fetchMock.restore();
});

test('render disabled menu item for unsupported chart', async () => {
  renderSubmenu({
    formData: { ...defaultFormData, viz_type: 'unsupported_viz' },
  });
  await expectDrillByDisabled(
    'Drill by is not yet supported for this chart type',
  );
});

test('render enabled menu item for supported chart, no filters', async () => {
  renderSubmenu({
    drillByConfig: { filters: [], groupbyFieldName: 'groupby' },
  });
  await expectDrillByEnabled();
});

test('render disabled menu item for supported chart, no columns', async () => {
  const emptyDataset = { ...mockDataset, columns: [], drillable_columns: [] };
  renderSubmenu({ dataset: emptyDataset });
  await expectDrillByEnabled();

  const noColumnsText = await screen.findByText('No columns found');
  expect(noColumnsText).toBeInTheDocument();
});

test('render menu item with submenu without searchbox', async () => {
  const slicedColumns = defaultColumns.slice(0, 1); // Use only 1 column to avoid search box
  const datasetWithSlicedColumns = {
    ...mockDataset,
    columns: slicedColumns,
    drillable_columns: slicedColumns,
  };
  renderSubmenu({ dataset: datasetWithSlicedColumns });
  await expectDrillByEnabled();

  // Check that the column appears in the popover
  const col1Element = await screen.findByText('col1');
  expect(col1Element).toBeInTheDocument();

  // Should not have search box for small number of columns
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

test('render menu item with submenu and searchbox', async () => {
  renderSubmenu({ dataset: mockDataset });
  await expectDrillByEnabled();

  // Wait for first column to ensure menu is loaded
  await screen.findByText('col1');

  // Then check all columns are visible
  defaultColumns.forEach(column => {
    expect(screen.getByText(column.column_name)).toBeInTheDocument();
  });

  const searchbox = screen.getByPlaceholderText('Search columns');
  expect(searchbox).toBeInTheDocument();

  userEvent.type(searchbox, 'col1');

  const expectedFilteredColumnNames = ['col1', 'col10', 'col11'];

  // Wait for filtering to take effect by checking for first filtered item
  await waitFor(() => {
    // Check that non-matching columns are not visible
    expect(screen.queryByText('col2')).not.toBeInTheDocument();
  });

  // Then verify all expected columns are visible
  expectedFilteredColumnNames.forEach(colName => {
    expect(screen.getByText(colName)).toBeInTheDocument();
  });

  // Check that non-matching columns are not visible
  defaultColumns
    .filter(col => !expectedFilteredColumnNames.includes(col.column_name))
    .forEach(col => {
      expect(screen.queryByText(col.column_name)).not.toBeInTheDocument();
    });
});

test('Do not display excluded column in the menu', async () => {
  const excludedColNames = ['col3', 'col5'];
  const filteredColumns = defaultColumns.filter(
    col => !excludedColNames.includes(col.column_name),
  );
  const datasetWithFilteredColumns = {
    ...mockDataset,
    drillable_columns: filteredColumns,
  };
  renderSubmenu({
    dataset: datasetWithFilteredColumns,
    excludedColumns: excludedColNames.map(colName => ({
      column_name: colName,
    })),
  });

  await expectDrillByEnabled();

  // Wait for first column to ensure menu is loaded
  await screen.findByText('col1');

  // Then check all non-excluded columns are visible
  defaultColumns
    .filter(column => !excludedColNames.includes(column.column_name))
    .forEach(column => {
      expect(screen.getByText(column.column_name)).toBeInTheDocument();
    });

  excludedColNames.forEach(colName => {
    expect(screen.queryByText(colName)).not.toBeInTheDocument();
  });
});

test('When menu item is clicked, call onSelection with clicked column and drill by filters', async () => {
  const onSelectionMock = jest.fn();
  renderSubmenu({
    dataset: mockDataset,
    onSelection: onSelectionMock,
  });

  await expectDrillByEnabled();

  // Wait for col1 to be visible before clicking
  const col1Element = await screen.findByText('col1');
  userEvent.click(col1Element);

  expect(onSelectionMock).toHaveBeenCalledWith(
    {
      column_name: 'col1',
      groupby: true,
    },
    { filters: defaultFilters, groupbyFieldName: 'groupby' },
  );
});

test('matrixify_enable_vertical_layout should not render component', () => {
  const { container } = renderSubmenu({
    formData: { ...defaultFormData, matrixify_enable_vertical_layout: true },
  });
  expect(container).toBeEmptyDOMElement();
});
