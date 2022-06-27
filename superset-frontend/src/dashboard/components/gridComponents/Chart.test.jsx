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

import Chart from 'src/dashboard/components/gridComponents/Chart';
import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import mockDatasource from 'spec/fixtures/mockDatasource';
import chartQueries, {
  sliceId as queryId,
} from 'spec/fixtures/mockChartQueries';

describe('Chart', () => {
  const defaultProps = {
    id: queryId,
    width: 100,
    height: 100,
    updateSliceName() {},

    // from redux
    maxRows: 666,
    chart: chartQueries[queryId],
    formData: chartQueries[queryId].formData,
    datasource: mockDatasource[sliceEntities.slices[queryId].datasource],
    slice: {
      ...sliceEntities.slices[queryId],
      description_markeddown: 'markdown',
      owners: [],
    },
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
    componentId: 'test',
    dashboardId: 111,
    editMode: false,
    isExpanded: false,
    supersetCanExplore: false,
    supersetCanCSV: false,
    sliceCanEdit: false,
    isComponentVisible: true,
  };

  const props = { ...defaultProps };

  function setup(overrideProps) {
    render(<Chart {...props} {...overrideProps} />, { useRedux: true });
  }

  it('should render a SliceHeader', async () => {
    setup();
    expect(await screen.findByTestId('slice-header')).toBeInTheDocument();
  });

  it('should render a ChartContainer', async () => {
    setup();
    expect(await screen.findByTestId('chart-container')).toBeInTheDocument();
  });

  it('should render a description if it has one and isExpanded=true', async () => {
    setup();
    expect(screen.queryByTestId('slice-description')).not.toBeInTheDocument();
    setup({ ...props, isExpanded: true });
    expect(await screen.findByTestId('slice-description')).toBeInTheDocument();
  });

  it('should calculate the description height if it has one and isExpanded=true', async () => {
    jest.spyOn(React, 'useEffect').mockImplementation(f => f());
    jest.spyOn(React, 'useRef').mockReturnValue({
      current: { offsetHeight: 100 },
    });

    setup({ isExpanded: true });
    expect(await screen.findByTestId('slice-description')).toBeInTheDocument();
  });

  it('should call refreshChart when SliceHeader calls forceRefresh', () => {
    const mockRefreshChart = jest.fn();
    mockRefreshChart.mockImplementation(props.refreshChart);

    setup({ refreshChart: mockRefreshChart });

    const menuControls = screen.getByTestId(`slice_${queryId}-controls`);
    expect(menuControls).toBeInTheDocument();
    userEvent.click(menuControls);

    const forceRefreshBtn = screen.getByTestId('refresh-chart-menu-item');
    expect(forceRefreshBtn).toBeInTheDocument();
    userEvent.click(forceRefreshBtn);
    expect(mockRefreshChart).toHaveBeenCalled();
  });

  it('should call changeFilter when ChartContainer calls changeFilter', () => {});

  it('should call exportChart when exportCSV is clicked', () => {});

  it('should call exportChart with row_limit props.maxRows when exportFullCSV is clicked', () => {});
});
