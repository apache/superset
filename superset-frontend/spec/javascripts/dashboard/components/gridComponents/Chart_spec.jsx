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
import { shallow } from 'enzyme';
import sinon from 'sinon';

import Chart from 'src/dashboard/components/gridComponents/Chart';
import SliceHeader from 'src/dashboard/components/SliceHeader';
import ChartContainer from 'src/chart/ChartContainer';
import * as exploreUtils from 'src/explore/exploreUtils';
import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import mockDatasource from 'spec/fixtures/mockDatasource';
import chartQueries, {
  sliceId as queryId,
} from 'spec/fixtures/mockChartQueries';

describe('Chart', () => {
  const props = {
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
  };

  function setup(overrideProps) {
    const wrapper = shallow(<Chart {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render a SliceHeader', () => {
    const wrapper = setup();
    expect(wrapper.find(SliceHeader)).toExist();
  });

  it('should render a ChartContainer', () => {
    const wrapper = setup();
    expect(wrapper.find(ChartContainer)).toExist();
  });

  it('should render a description if it has one and isExpanded=true', () => {
    const wrapper = setup();
    expect(wrapper.find('.slice_description')).not.toExist();
    wrapper.setProps({ ...props, isExpanded: true });
    expect(wrapper.find('.slice_description')).toExist();
  });

  it('should call refreshChart when SliceHeader calls forceRefresh', () => {
    const refreshChart = sinon.spy();
    const wrapper = setup({ refreshChart });
    wrapper.instance().forceRefresh();
    expect(refreshChart.callCount).toBe(1);
  });

  it('should call changeFilter when ChartContainer calls changeFilter', () => {
    const changeFilter = sinon.spy();
    const wrapper = setup({ changeFilter });
    wrapper.instance().changeFilter();
    expect(changeFilter.callCount).toBe(1);
  });
  it('should call exportChart when exportCSV is clicked', () => {
    const stubbedExportCSV = sinon
      .stub(exploreUtils, 'exportChart')
      .returns(() => {});
    const wrapper = setup();
    wrapper.instance().exportCSV(props.slice.sliceId);
    expect(stubbedExportCSV.calledOnce).toBe(true);
    expect(stubbedExportCSV.lastCall.args[0]).toEqual(
      expect.objectContaining({
        formData: expect.anything(),
        resultType: 'results',
        resultFormat: 'csv',
      }),
    );
    exploreUtils.exportChart.restore();
  });
  it('should call exportChart with row_limit props.maxRows when exportFullCSV is clicked', () => {
    const stubbedExportCSV = sinon
      .stub(exploreUtils, 'exportChart')
      .returns(() => {});
    const wrapper = setup();
    wrapper.instance().exportFullCSV(props.slice.sliceId);
    expect(stubbedExportCSV.calledOnce).toBe(true);
    expect(stubbedExportCSV.lastCall.args[0].formData.row_limit).toEqual(666);
    exploreUtils.exportChart.restore();
  });
});
