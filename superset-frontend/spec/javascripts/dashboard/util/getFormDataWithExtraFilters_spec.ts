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
import getFormDataWithExtraFilters, {
  GetFormDataWithExtraFiltersArguments,
} from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { Filter } from 'src/dashboard/components/nativeFilters/types';
import { LayoutItem } from 'src/dashboard/types';
import { dashboardLayout } from '../../../fixtures/mockDashboardLayout';
import { sliceId as chartId } from '../../../fixtures/mockChartQueries';

describe('getFormDataWithExtraFilters', () => {
  const filterId = 'native-filter-1';
  const mockArgs: GetFormDataWithExtraFiltersArguments = {
    chart: {
      id: chartId,
      formData: {
        filters: [
          {
            col: 'country_name',
            op: 'IN',
            val: ['United States'],
          },
        ],
      },
    },
    filters: {
      region: ['Spain'],
      color: ['pink', 'purple'],
    },
    sliceId: chartId,
    nativeFilters: {
      filters: {
        [filterId]: ({
          id: filterId,
          scope: {
            rootPath: [DASHBOARD_ROOT_ID],
            excluded: [],
          },
        } as unknown) as Filter,
      },
      filtersState: {
        [filterId]: {
          id: filterId,
          extraFormData: {},
        },
      },
    },
    layout: (dashboardLayout.present as unknown) as {
      [key: string]: LayoutItem;
    },
  };

  it('should include filters from the passed filters', () => {
    const result = getFormDataWithExtraFilters(mockArgs);
    expect(result.extra_filters).toHaveLength(2);
    expect(result.extra_filters[0]).toEqual({
      col: 'region',
      op: 'IN',
      val: ['Spain'],
    });
    expect(result.extra_filters[1]).toEqual({
      col: 'color',
      op: 'IN',
      val: ['pink', 'purple'],
    });
  });
});
