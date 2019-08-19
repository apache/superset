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
/* eslint-disable camelcase */
import {
  ADD_FILTER,
  REMOVE_FILTER,
  CHANGE_FILTER,
} from '../../../../src/dashboard/actions/dashboardFilters';
import dashboardFiltersReducer from '../../../../src/dashboard/reducers/dashboardFilters';
import {
  emptyFilters,
  dashboardFilters,
} from '../fixtures/mockDashboardFilters';
import {
  sliceEntitiesForDashboard,
  filterId,
  column,
} from '../fixtures/mockSliceEntities';
import { filterComponent } from '../fixtures/mockDashboardLayout';
import { DASHBOARD_ROOT_ID } from '../../../../src/dashboard/util/constants';

describe('dashboardFilters reducer', () => {
  const form_data = sliceEntitiesForDashboard.slices[filterId].form_data;
  const component = filterComponent;
  const directPathToFilter = (component.parents || []).slice();
  directPathToFilter.push(component.id);

  it('should add a new filter if it does not exist', () => {
    expect(
      dashboardFiltersReducer(emptyFilters, {
        type: ADD_FILTER,
        chartId: filterId,
        component,
        form_data,
      }),
    ).toEqual({
      [filterId]: {
        chartId: filterId,
        componentId: component.id,
        directPathToFilter,
        scope: DASHBOARD_ROOT_ID,
        isDateFilter: false,
        isInstantFilter: !!form_data.instant_filtering,
        columns: {
          [column]: undefined,
        },
        labels: {
          [column]: column,
        },
      },
    });
  });

  it('should overwrite a filter if merge is false', () => {
    expect(
      dashboardFiltersReducer(dashboardFilters, {
        type: CHANGE_FILTER,
        chartId: filterId,
        newSelectedValues: {
          region: ['c'],
          gender: ['body', 'girl'],
        },
        merge: false,
      }),
    ).toEqual({
      [filterId]: {
        chartId: filterId,
        componentId: component.id,
        directPathToFilter,
        scope: DASHBOARD_ROOT_ID,
        isDateFilter: false,
        isInstantFilter: !!form_data.instant_filtering,
        columns: {
          region: ['c'],
          gender: ['body', 'girl'],
        },
        labels: {
          [column]: column,
        },
      },
    });
  });

  it('should merge a filter if merge is true', () => {
    expect(
      dashboardFiltersReducer(dashboardFilters, {
        type: CHANGE_FILTER,
        chartId: filterId,
        newSelectedValues: {
          region: ['c'],
          gender: ['body', 'girl'],
        },
        merge: true,
      }),
    ).toEqual({
      [filterId]: {
        chartId: filterId,
        componentId: component.id,
        directPathToFilter,
        scope: DASHBOARD_ROOT_ID,
        isDateFilter: false,
        isInstantFilter: !!form_data.instant_filtering,
        columns: {
          region: ['a', 'b', 'c'],
          gender: ['body', 'girl'],
        },
        labels: {
          [column]: column,
        },
      },
    });
  });

  it('should remove the filter if values are empty', () => {
    expect(
      dashboardFiltersReducer(dashboardFilters, {
        type: REMOVE_FILTER,
        chartId: filterId,
      }),
    ).toEqual({});
  });
});
