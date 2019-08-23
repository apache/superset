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

import { dashboardFilters } from '../fixtures/mockDashboardFilters';
import { filterId, column } from '../fixtures/mockSliceEntities';
import FilterIndicatorsContainer from '../../../../src/dashboard/components/FilterIndicatorsContainer';
import FilterIndicator from '../../../../src/dashboard/components/FilterIndicator';
import * as colorMap from '../../../../src/dashboard/util/dashboardFiltersColorMap';

describe('FilterIndicatorsContainer', () => {
  const chartId = 1;
  const mockedProps = {
    dashboardFilters,
    chartId,
    chartStatus: 'success',
    filterImmuneSlices: [],
    filterImmuneSliceFields: {},
    setDirectPathToChild: () => {},
  };

  colorMap.getFilterColorKey = jest.fn(() => 'id_column');
  colorMap.getFilterColorMap = jest.fn(() => ({
    id_column: 'badge-1',
  }));

  function setup(overrideProps) {
    return shallow(
      <FilterIndicatorsContainer {...mockedProps} {...overrideProps} />,
    );
  }

  it('should not show indicator when chart is loading', () => {
    const wrapper = setup({ chartStatus: 'loading' });
    expect(wrapper.find(FilterIndicator)).toHaveLength(0);
  });

  it('should not show indicator for filter_box itself', () => {
    const wrapper = setup({ chartId: filterId });
    expect(wrapper.find(FilterIndicator)).toHaveLength(0);
  });

  it('should not show indicator when chart is immune', () => {
    const wrapper = setup({ filterImmuneSlices: [chartId] });
    expect(wrapper.find(FilterIndicator)).toHaveLength(0);
  });

  it('should not show indicator when chart field is immune', () => {
    const wrapper = setup({ filterImmuneSliceFields: { [chartId]: [column] } });
    expect(wrapper.find(FilterIndicator)).toHaveLength(0);
  });

  it('should show indicator', () => {
    const wrapper = setup();
    expect(wrapper.find(FilterIndicator)).toHaveLength(1);
  });
});
