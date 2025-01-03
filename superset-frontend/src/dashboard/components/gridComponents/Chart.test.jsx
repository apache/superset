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
import { fireEvent, render } from 'spec/helpers/testing-library';
import { FeatureFlag, VizType } from '@superset-ui/core';
import * as redux from 'redux';

import Chart from 'src/dashboard/components/gridComponents/Chart';
import * as exploreUtils from 'src/explore/exploreUtils';
import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import mockDatasource from 'spec/fixtures/mockDatasource';
import chartQueries, {
  sliceId as queryId,
} from 'spec/fixtures/mockChartQueries';

const props = {
  id: queryId,
  width: 100,
  height: 100,
  updateSliceName() {},
  // from redux
  maxRows: 666,
  formData: chartQueries[queryId].form_data,
  datasource: mockDatasource[sliceEntities.slices[queryId].datasource],
  sliceName: sliceEntities.slices[queryId].slice_name,
  timeout: 60,
  filters: {},
  refreshChart() {},
  toggleExpandSlice() {},
  addFilter() {},
  logEvent() {},
  handleToggleFullSize() {},
  changeFilter() {},
  setFocusedFilterField() {},
  unsetFocusedFilterField() {},
  addSuccessToast() {},
  addDangerToast() {},
  exportCSV() {},
  exportFullCSV() {},
  exportXLSX() {},
  exportFullXLSX() {},
  componentId: 'test',
  dashboardId: 111,
};

const defaultState = {
  charts: chartQueries,
  sliceEntities: {
    ...sliceEntities,
    slices: {
      [queryId]: {
        ...sliceEntities.slices[queryId],
        description_markeddown: 'markdown',
        owners: [],
        viz_type: VizType.Table,
      },
    },
  },
  datasources: mockDatasource,
  dashboardState: { editMode: false, expandedSlices: {} },
  dashboardInfo: {
    superset_can_explore: false,
    superset_can_share: false,
    superset_can_csv: false,
    common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 0 } },
  },
};

function setup(overrideProps, overrideState) {
  return render(<Chart {...props} {...overrideProps} />, {
    useRedux: true,
    useRouter: true,
    initialState: { ...defaultState, ...overrideState },
  });
}

const refreshChart = jest.fn();
const logEvent = jest.fn();
const changeFilter = jest.fn();
const addSuccessToast = jest.fn();
const addDangerToast = jest.fn();
const toggleExpandSlice = jest.fn();
const setFocusedFilterField = jest.fn();
const unsetFocusedFilterField = jest.fn();
beforeAll(() => {
  jest.spyOn(redux, 'bindActionCreators').mockImplementation(() => ({
    refreshChart,
    logEvent,
    changeFilter,
    addSuccessToast,
    addDangerToast,
    toggleExpandSlice,
    setFocusedFilterField,
    unsetFocusedFilterField,
  }));
});

test('should render a SliceHeader', () => {
  const { getByTestId, container } = setup();
  expect(getByTestId('slice-header')).toBeInTheDocument();
  expect(container.querySelector('.slice_description')).not.toBeInTheDocument();
});

test('should render a ChartContainer', () => {
  const { getByTestId } = setup();
  expect(getByTestId('chart-container')).toBeInTheDocument();
});

test('should render a description if it has one and isExpanded=true', () => {
  const { container } = setup(
    {},
    {
      dashboardState: {
        ...defaultState.dashboardState,
        expandedSlices: { [props.id]: true },
      },
    },
  );
  expect(container.querySelector('.slice_description')).toBeInTheDocument();
});

test('should call refreshChart when SliceHeader calls forceRefresh', () => {
  const { getByText, getByRole } = setup({});
  fireEvent.click(getByRole('button', { name: 'More Options' }));
  fireEvent.click(getByText('Force refresh'));
  expect(refreshChart).toHaveBeenCalled();
});

test.skip('should call changeFilter when ChartContainer calls changeFilter', () => {
  const changeFilter = jest.fn();
  const wrapper = setup({ changeFilter });
  wrapper.instance().changeFilter();
  expect(changeFilter.callCount).toBe(1);
});

test('should call exportChart when exportCSV is clicked', async () => {
  const stubbedExportCSV = jest
    .spyOn(exploreUtils, 'exportChart')
    .mockImplementation(() => {});
  const { findByText, getByRole } = setup(
    {},
    {
      dashboardInfo: { ...defaultState.dashboardInfo, superset_can_csv: true },
    },
  );
  fireEvent.click(getByRole('button', { name: 'More Options' }));
  fireEvent.mouseOver(getByRole('menuitem', { name: 'Download right' }));
  const exportAction = await findByText('Export to .CSV');
  fireEvent.click(exportAction);
  expect(stubbedExportCSV).toHaveBeenCalledTimes(1);
  expect(stubbedExportCSV).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.anything(),
      resultType: 'full',
      resultFormat: 'csv',
    }),
  );
  stubbedExportCSV.mockRestore();
});

test('should call exportChart with row_limit props.maxRows when exportFullCSV is clicked', async () => {
  global.featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  const stubbedExportCSV = jest
    .spyOn(exploreUtils, 'exportChart')
    .mockImplementation(() => {});
  const { findByText, getByRole } = setup(
    {},
    {
      dashboardInfo: { ...defaultState.dashboardInfo, superset_can_csv: true },
    },
  );
  fireEvent.click(getByRole('button', { name: 'More Options' }));
  fireEvent.mouseOver(getByRole('menuitem', { name: 'Download right' }));
  const exportAction = await findByText('Export to full .CSV');
  fireEvent.click(exportAction);
  expect(stubbedExportCSV).toHaveBeenCalledTimes(1);
  expect(stubbedExportCSV).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({
        row_limit: 666,
      }),
      resultType: 'full',
      resultFormat: 'csv',
    }),
  );
  stubbedExportCSV.mockRestore();
});

test('should call exportChart when exportXLSX is clicked', async () => {
  const stubbedExportXLSX = jest
    .spyOn(exploreUtils, 'exportChart')
    .mockImplementation(() => {});
  const { findByText, getByRole } = setup(
    {},
    {
      dashboardInfo: { ...defaultState.dashboardInfo, superset_can_csv: true },
    },
  );
  fireEvent.click(getByRole('button', { name: 'More Options' }));
  fireEvent.mouseOver(getByRole('menuitem', { name: 'Download right' }));
  const exportAction = await findByText('Export to Excel');
  fireEvent.click(exportAction);
  expect(stubbedExportXLSX).toHaveBeenCalledTimes(1);
  expect(stubbedExportXLSX).toHaveBeenCalledWith(
    expect.objectContaining({
      resultType: 'full',
      resultFormat: 'xlsx',
    }),
  );
  stubbedExportXLSX.mockRestore();
});

test('should call exportChart with row_limit props.maxRows when exportFullXLSX is clicked', async () => {
  global.featureFlags = {
    [FeatureFlag.AllowFullCsvExport]: true,
  };
  const stubbedExportXLSX = jest
    .spyOn(exploreUtils, 'exportChart')
    .mockImplementation(() => {});
  const { findByText, getByRole } = setup(
    {},
    {
      dashboardInfo: { ...defaultState.dashboardInfo, superset_can_csv: true },
    },
  );
  fireEvent.click(getByRole('button', { name: 'More Options' }));
  fireEvent.mouseOver(getByRole('menuitem', { name: 'Download right' }));
  const exportAction = await findByText('Export to full Excel');
  fireEvent.click(exportAction);
  expect(stubbedExportXLSX).toHaveBeenCalledTimes(1);
  expect(stubbedExportXLSX).toHaveBeenCalledWith(
    expect.objectContaining({
      formData: expect.objectContaining({
        row_limit: 666,
      }),
      resultType: 'full',
      resultFormat: 'xlsx',
    }),
  );

  stubbedExportXLSX.mockRestore();
});
