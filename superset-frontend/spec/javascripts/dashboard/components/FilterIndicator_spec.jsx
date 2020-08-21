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
import FilterIndicator from 'src/dashboard/components/FilterIndicator';
import FilterBadgeIcon from 'src/components/FilterBadgeIcon';

import { dashboardFilters } from '../fixtures/mockDashboardFilters';
import { filterId, column } from '../fixtures/mockSliceEntities';

describe('FilterIndicator', () => {
  const mockedProps = {
    indicator: {
      ...dashboardFilters[filterId],
      colorCode: 'badge-1',
      name: column,
      label: column,
      values: ['a', 'b', 'c'],
    },
    setDirectPathToChild: jest.fn(),
  };

  function setup(overrideProps) {
    return shallow(<FilterIndicator {...mockedProps} {...overrideProps} />);
  }

  it('should show indicator with badge', () => {
    const wrapper = setup();
    expect(wrapper.find(FilterBadgeIcon)).toExist();
  });

  it('should call setDirectPathToChild prop', () => {
    const wrapper = setup();
    const badge = wrapper.find('.filter-indicator');
    expect(badge).toHaveLength(1);

    badge.simulate('click');
    expect(mockedProps.setDirectPathToChild).toHaveBeenCalledWith(
      dashboardFilters[filterId].directPathToFilter,
    );
  });
});
