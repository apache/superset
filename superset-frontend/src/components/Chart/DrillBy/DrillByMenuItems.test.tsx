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
import { Menu } from 'src/components/Menu';
import { supersetGetCache } from 'src/utils/cachedSupersetGet';
import { DrillByMenuItems, DrillByMenuItemsProps } from './DrillByMenuItems';

/* eslint jest/expect-expect: ["warn", { "assertFunctionNames": ["expect*"] }] */

const DATASET_ENDPOINT = 'glob:*/api/v1/dataset/7*';
const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data*';
const FORM_DATA_KEY_ENDPOINT = 'glob:*/api/v1/explore/form_data';
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

const defaultFilters = [
  {
    col: 'filter_col',
    op: '==' as const,
    val: 'val',
  },
];

const renderMenu = ({
  formData = defaultFormData,
  drillByConfig = { filters: defaultFilters, groupbyFieldName: 'groupby' },
  ...rest
}: Partial<DrillByMenuItemsProps>) =>
  render(
    <Menu forceSubMenuRender>
      <DrillByMenuItems
        formData={formData ?? defaultFormData}
        drillByConfig={drillByConfig}
        open
        {...rest}
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

  userEvent.hover(within(drillByMenuItem).getByText('Drill by'));
  const drillBySubmenus = await screen.findAllByTestId('drill-by-submenu');
  expect(drillBySubmenus[0]).toBeInTheDocument();
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
  renderMenu({
    formData: { ...defaultFormData, viz_type: 'unsupported_viz' },
  });
  await expectDrillByDisabled(
    'Drill by is not yet supported for this chart type',
  );
});

test('render enabled menu item for supported chart, no filters', async () => {
  renderMenu({ drillByConfig: { filters: [], groupbyFieldName: 'groupby' } });
  await expectDrillByEnabled();
});

test('render disabled menu item for supported chart, no columns', async () => {
  fetchMock.get(DATASET_ENDPOINT, { result: { columns: [] } });
  renderMenu({});
  await waitFor(() => fetchMock.called(DATASET_ENDPOINT));
  await expectDrillByEnabled();
  screen.getByText('No columns found');
});

test('render menu item with submenu without searchbox', async () => {
  const slicedColumns = defaultColumns.slice(0, 9);
  fetchMock.get(DATASET_ENDPOINT, {
    result: { columns: slicedColumns },
  });
  renderMenu({});
  await waitFor(() => fetchMock.called(DATASET_ENDPOINT));
  await expectDrillByEnabled();
  slicedColumns.forEach(column => {
    expect(screen.getByText(column.column_name)).toBeInTheDocument();
  });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

// Add global timeout for all tests
jest.setTimeout(20000);

test('render menu item with submenu and searchbox', async () => {
  fetchMock.get(DATASET_ENDPOINT, {
    result: { columns: defaultColumns },
  });
  renderMenu({});
  await waitFor(() => fetchMock.called(DATASET_ENDPOINT));
  await expectDrillByEnabled();

  // Wait for all columns to be visible
  await waitFor(
    () => {
      defaultColumns.forEach(column => {
        expect(screen.getByText(column.column_name)).toBeInTheDocument();
      });
    },
    { timeout: 10000 },
  );

  const searchbox = await waitFor(
    () => screen.getAllByPlaceholderText('Search columns')[1],
  );
  expect(searchbox).toBeInTheDocument();

  userEvent.type(searchbox, 'col1');

  const expectedFilteredColumnNames = ['col1', 'col10', 'col11'];

  // Wait for filtered results
  await waitFor(() => {
    expectedFilteredColumnNames.forEach(colName => {
      expect(screen.getByText(colName)).toBeInTheDocument();
    });
  });

  defaultColumns
    .filter(col => !expectedFilteredColumnNames.includes(col.column_name))
    .forEach(col => {
      expect(screen.queryByText(col.column_name)).not.toBeInTheDocument();
    });

  expectedFilteredColumnNames.forEach(colName => {
    expect(screen.getByText(colName)).toBeInTheDocument();
  });
});

test('Do not display excluded column in the menu', async () => {
  fetchMock.get(DATASET_ENDPOINT, {
    result: { columns: defaultColumns },
  });

  const excludedColNames = ['col3', 'col5'];
  renderMenu({
    excludedColumns: excludedColNames.map(colName => ({
      column_name: colName,
    })),
  });

  await waitFor(() => fetchMock.called(DATASET_ENDPOINT));
  await expectDrillByEnabled();

  // Wait for menu items to be loaded
  await waitFor(
    () => {
      defaultColumns
        .filter(column => !excludedColNames.includes(column.column_name))
        .forEach(column => {
          expect(screen.getByText(column.column_name)).toBeInTheDocument();
        });
    },
    { timeout: 10000 },
  );

  excludedColNames.forEach(colName => {
    expect(screen.queryByText(colName)).not.toBeInTheDocument();
  });
});

test('When menu item is clicked, call onSelection with clicked column and drill by filters', async () => {
  fetchMock
    .get(DATASET_ENDPOINT, {
      result: { columns: defaultColumns },
    })
    .post(FORM_DATA_KEY_ENDPOINT, {})
    .post(CHART_DATA_ENDPOINT, {});

  const onSelectionMock = jest.fn();
  renderMenu({
    onSelection: onSelectionMock,
  });

  await waitFor(() => fetchMock.called(DATASET_ENDPOINT));
  await expectDrillByEnabled();

  // Wait for col1 to be visible before clicking
  const col1Element = await waitFor(() => screen.getByText('col1'));
  userEvent.click(col1Element);

  expect(onSelectionMock).toHaveBeenCalledWith(
    {
      column_name: 'col1',
      groupby: true,
    },
    { filters: defaultFilters, groupbyFieldName: 'groupby' },
  );
});
