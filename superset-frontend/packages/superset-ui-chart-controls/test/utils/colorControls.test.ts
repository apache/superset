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
import { getColorControlsProps } from '../../src';

describe('getColorControlsProps', () => {
  it('should return default values when state is empty', () => {
    const state = {};
    const result = getColorControlsProps(state);
    expect(result).toEqual({
      chartId: undefined,
      dashboardId: undefined,
      hasDashboardColorScheme: false,
      hasCustomLabelsColor: false,
      colorNamespace: undefined,
      mapLabelsColors: {},
      sharedLabelsColors: [],
    });
  });

  it('should return correct values when state has form_data with dashboardId and color scheme', () => {
    const state = {
      form_data: {
        dashboardId: 123,
        dashboard_color_scheme: 'blueScheme',
        label_colors: {},
      },
      slice: { slice_id: 456 },
    };
    const result = getColorControlsProps(state);
    expect(result).toEqual({
      chartId: 456,
      dashboardId: 123,
      hasDashboardColorScheme: true,
      hasCustomLabelsColor: false,
      colorNamespace: undefined,
      mapLabelsColors: {},
      sharedLabelsColors: [],
    });
  });

  it('should detect custom label colors correctly', () => {
    const state = {
      form_data: {
        dashboardId: 123,
        label_colors: { label1: '#000000' },
      },
      slice: { slice_id: 456 },
    };
    const result = getColorControlsProps(state);
    expect(result).toEqual({
      chartId: 456,
      dashboardId: 123,
      hasDashboardColorScheme: false,
      hasCustomLabelsColor: true,
      colorNamespace: undefined,
      mapLabelsColors: {},
      sharedLabelsColors: [],
    });
  });

  it('should return shared label colors when available', () => {
    const state = {
      form_data: {
        shared_label_colors: ['#FF5733', '#33FF57'],
      },
    };
    const result = getColorControlsProps(state);
    expect(result).toEqual({
      chartId: undefined,
      dashboardId: undefined,
      hasDashboardColorScheme: false,
      hasCustomLabelsColor: false,
      sharedLabelsColors: ['#FF5733', '#33FF57'],
      colorNamespace: undefined,
      mapLabelsColors: {},
    });
  });

  it('should handle missing form_data and slice properties', () => {
    const state = {
      form_data: {
        dashboardId: 789,
      },
    };
    const result = getColorControlsProps(state);
    expect(result).toEqual({
      chartId: undefined,
      dashboardId: 789,
      hasDashboardColorScheme: false,
      hasCustomLabelsColor: false,
      colorNamespace: undefined,
      mapLabelsColors: {},
      sharedLabelsColors: [],
    });
  });
});
