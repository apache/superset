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
import getDashboardUrl from 'src/dashboard/util/getDashboardUrl';
import { DASHBOARD_FILTER_SCOPE_GLOBAL } from 'src/dashboard/reducers/dashboardFilters';
import { DashboardStandaloneMode } from '../../../../src/dashboard/util/constants';

describe('getChartIdsFromLayout', () => {
  const filters = {
    '35_key': {
      values: ['value'],
      scope: DASHBOARD_FILTER_SCOPE_GLOBAL,
    },
  };

  const globalLocation = window.location;
  afterEach(() => {
    window.location = globalLocation;
  });

  it('should encode filters', () => {
    const url = getDashboardUrl('path', filters);
    expect(url).toBe(
      'path?preselect_filters=%7B%2235%22%3A%7B%22key%22%3A%5B%22value%22%5D%7D%7D',
    );
  });

  it('should encode filters with hash', () => {
    const urlWithHash = getDashboardUrl('path', filters, 'iamhashtag');
    expect(urlWithHash).toBe(
      'path?preselect_filters=%7B%2235%22%3A%7B%22key%22%3A%5B%22value%22%5D%7D%7D#iamhashtag',
    );
  });

  it('should encode filters with standalone', () => {
    const urlWithStandalone = getDashboardUrl(
      'path',
      filters,
      '',
      DashboardStandaloneMode.HIDE_NAV,
    );
    expect(urlWithStandalone).toBe(
      `path?preselect_filters=%7B%2235%22%3A%7B%22key%22%3A%5B%22value%22%5D%7D%7D&standalone=${DashboardStandaloneMode.HIDE_NAV}`,
    );
  });

  it('should encode filters with missing standalone', () => {
    const urlWithStandalone = getDashboardUrl('path', filters, '', null);
    expect(urlWithStandalone).toBe(
      'path?preselect_filters=%7B%2235%22%3A%7B%22key%22%3A%5B%22value%22%5D%7D%7D',
    );
  });
});
