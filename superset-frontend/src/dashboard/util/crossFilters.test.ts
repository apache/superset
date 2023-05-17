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
import sinon, { SinonStub } from 'sinon';
import { Behavior, FeatureFlag } from '@superset-ui/core';
import * as core from '@superset-ui/core';
import { getCrossFiltersConfiguration } from './crossFilters';
import { DEFAULT_CROSS_FILTER_SCOPING } from '../constants';

const DASHBOARD_LAYOUT = {
  'CHART-1': {
    children: [],
    id: 'CHART-1',
    meta: {
      chartId: 1,
      sliceName: 'Test chart 1',
      height: 1,
      width: 1,
      uuid: '1',
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-6XUMf1rV76'],
    type: 'CHART',
  },
  'CHART-2': {
    children: [],
    id: 'CHART-2',
    meta: {
      chartId: 2,
      sliceName: 'Test chart 2',
      height: 1,
      width: 1,
      uuid: '2',
    },
    parents: ['ROOT_ID', 'GRID_ID', 'ROW-6XUMf1rV76'],
    type: 'CHART',
  },
};

const CHARTS = {
  '1': {
    id: 1,
    form_data: {
      datasource: '2__table',
      viz_type: 'echarts_timeseries_line',
      slice_id: 1,
    },
    chartAlert: null,
    chartStatus: 'rendered' as const,
    chartUpdateEndTime: 0,
    chartUpdateStartTime: 0,
    lastRendered: 0,
    latestQueryFormData: {},
    sliceFormData: {
      datasource: '2__table',
      viz_type: 'echarts_timeseries_line',
    },
    queryController: null,
    queriesResponse: [{}],
    triggerQuery: false,
  },
  '2': {
    id: 2,
    form_data: {
      datasource: '2__table',
      viz_type: 'echarts_timeseries_line',
      slice_id: 2,
    },
    chartAlert: null,
    chartStatus: 'rendered' as const,
    chartUpdateEndTime: 0,
    chartUpdateStartTime: 0,
    lastRendered: 0,
    latestQueryFormData: {},
    sliceFormData: {
      datasource: '2__table',
      viz_type: 'echarts_timeseries_line',
    },
    queryController: null,
    queriesResponse: [{}],
    triggerQuery: false,
  },
};

const INITIAL_CHART_CONFIG = {
  '1': {
    id: 1,
    crossFilters: {
      scope: {
        rootPath: ['ROOT_ID'],
        excluded: [1, 2],
      },
      chartsInScope: [],
    },
  },
  '2': {
    id: 2,
    crossFilters: {
      scope: 'global' as const,
      chartsInScope: [1],
    },
  },
};

const GLOBAL_CHART_CONFIG = {
  scope: DEFAULT_CROSS_FILTER_SCOPING,
  chartsInScope: [1, 2],
};

const CHART_CONFIG_METADATA = {
  chart_configuration: INITIAL_CHART_CONFIG,
  global_chart_configuration: GLOBAL_CHART_CONFIG,
};

let metadataRegistryStub: SinonStub;

beforeEach(() => {
  metadataRegistryStub = sinon
    .stub(core, 'getChartMetadataRegistry')
    .callsFake(() => ({
      // @ts-ignore
      get: () => ({
        behaviors: [Behavior.INTERACTIVE_CHART],
      }),
    }));
});

afterEach(() => {
  metadataRegistryStub.restore();
});

test('Generate correct cross filters configuration without initial configuration', () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.DASHBOARD_CROSS_FILTERS]: true,
  };

  // @ts-ignore
  expect(getCrossFiltersConfiguration(DASHBOARD_LAYOUT, {}, CHARTS)).toEqual({
    chartConfiguration: {
      '1': {
        id: 1,
        crossFilters: {
          scope: 'global',
          chartsInScope: [2],
        },
      },
      '2': {
        id: 2,
        crossFilters: {
          scope: 'global',
          chartsInScope: [1],
        },
      },
    },
    globalChartConfiguration: {
      scope: {
        excluded: [],
        rootPath: ['ROOT_ID'],
      },
      chartsInScope: [1, 2],
    },
  });
  metadataRegistryStub.restore();
});

test('Generate correct cross filters configuration with initial configuration', () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.DASHBOARD_CROSS_FILTERS]: true,
  };

  expect(
    getCrossFiltersConfiguration(
      DASHBOARD_LAYOUT,
      CHART_CONFIG_METADATA,
      CHARTS,
    ),
  ).toEqual({
    chartConfiguration: {
      '1': {
        id: 1,
        crossFilters: {
          scope: {
            rootPath: ['ROOT_ID'],
            excluded: [1, 2],
          },
          chartsInScope: [],
        },
      },
      '2': {
        id: 2,
        crossFilters: {
          scope: 'global',
          chartsInScope: [1],
        },
      },
    },
    globalChartConfiguration: {
      scope: {
        excluded: [],
        rootPath: ['ROOT_ID'],
      },
      chartsInScope: [1, 2],
    },
  });
  metadataRegistryStub.restore();
});

test('Return undefined if DASHBOARD_CROSS_FILTERS feature flag is disabled', () => {
  // @ts-ignore
  global.featureFlags = {
    [FeatureFlag.DASHBOARD_CROSS_FILTERS]: false,
  };
  expect(
    getCrossFiltersConfiguration(
      DASHBOARD_LAYOUT,
      CHART_CONFIG_METADATA,
      CHARTS,
    ),
  ).toEqual(undefined);
});
