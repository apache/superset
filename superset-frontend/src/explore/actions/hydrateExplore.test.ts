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

import { isFeatureEnabled, VizType } from '@superset-ui/core';
import { HYDRATE_CHART_NORMALIZATION } from 'src/features/versionHistory/reducer';
import { hydrateExplore, HYDRATE_EXPLORE } from './hydrateExplore';
import { exploreInitialData } from '../fixtures';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeEach(() => mockedIsFeatureEnabled.mockReturnValue(false));

afterEach(() => {
  window.history.pushState({}, '', '/');
});

test('creates hydrate action from initial data', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  // ignore type check - we dont need exact explore state for this test
  // @ts-expect-error
  hydrateExplore(exploreInitialData)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        charts: expect.objectContaining({
          371: expect.objectContaining({
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            sliceFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          }),
        }),
        datasources: expect.objectContaining({
          '8__table': expect.anything(),
        }),
        saveModal: expect.objectContaining({
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        }),
        explore: expect.objectContaining({
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: expect.anything(),
          controls: expect.any(Object),
          form_data: expect.anything(),
          slice: expect.anything(),
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        }),
      }),
    }),
  );
});

test('creates hydrate action with existing state', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: { controlsTransferred: ['all_columns'] },
  }));
  // ignore type check - we dont need exact explore state for this test
  // @ts-expect-error
  hydrateExplore(exploreInitialData)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        charts: expect.objectContaining({
          371: expect.objectContaining({
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            sliceFormData: expect.objectContaining({
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: VizType.Table,
            }),
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          }),
        }),
        datasources: expect.objectContaining({
          '8__table': expect.anything(),
        }),
        saveModal: expect.objectContaining({
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        }),
        explore: expect.objectContaining({
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: expect.anything(),
          controls: expect.any(Object),
          controlsTransferred: ['all_columns'],
          form_data: expect.anything(),
          slice: expect.anything(),
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        }),
      }),
    }),
  );
});

test('hydrates sliceName from preview form data before saved slice name', () => {
  window.history.pushState({}, '', '/explore/?form_data_key=preview-key');

  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  const previewSliceName = 'RENAMED - Bug Evidence';
  const savedSliceName = 'Most Populated Countries';
  const previewInitialData = {
    ...exploreInitialData,
    form_data: {
      ...exploreInitialData.form_data,
      slice_name: previewSliceName,
    },
    slice: {
      ...exploreInitialData.slice!,
      slice_name: savedSliceName,
    },
  };

  // @ts-expect-error we only need the fields consumed by hydrateExplore
  hydrateExplore(previewInitialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        explore: expect.objectContaining({
          sliceName: previewSliceName,
        }),
      }),
    }),
  );
});

test('hydrates sliceName from saved slice when regular form data has stale name', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));
  const staleFormDataSliceName = 'Stale Params Name';
  const savedSliceName = 'Current Saved Name';
  const savedChartInitialData = {
    ...exploreInitialData,
    form_data: {
      ...exploreInitialData.form_data,
      slice_name: staleFormDataSliceName,
    },
    slice: {
      ...exploreInitialData.slice!,
      slice_name: savedSliceName,
    },
  };

  // @ts-expect-error we only need the fields consumed by hydrateExplore
  hydrateExplore(savedChartInitialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_EXPLORE,
      data: expect.objectContaining({
        explore: expect.objectContaining({
          sliceName: savedSliceName,
        }),
      }),
    }),
  );
});

test('uses configured default time range if not set', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {
      conf: {
        DEFAULT_TIME_FILTER: 'Last year',
      },
    },
    explore: {},
  }));
  // @ts-expect-error
  hydrateExplore({ form_data: {}, slice: {}, dataset: {} })(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        explore: expect.objectContaining({
          form_data: expect.objectContaining({
            time_range: 'Last year',
          }),
        }),
      }),
    }),
  );
  const withTimeRangeSet = {
    form_data: { time_range: 'Last day' },
    slice: {},
    dataset: {},
  };
  // @ts-expect-error
  hydrateExplore(withTimeRangeSet)(dispatch, getState);
  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        explore: expect.objectContaining({
          form_data: expect.objectContaining({
            time_range: 'Last day',
          }),
        }),
      }),
    }),
  );
});

test('extracts currency formats from metrics in dataset', () => {
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));

  const datasetWithMetrics = {
    ...exploreInitialData.dataset,
    metrics: [
      {
        metric_name: 'count',
        currency: { symbol: 'GBP', symbolPosition: 'prefix' },
      },
      {
        metric_name: 'revenue',
        currency: { symbol: 'USD', symbolPosition: 'suffix' },
      },
      { metric_name: 'no_currency' },
    ],
  };

  // @ts-expect-error
  hydrateExplore({ ...exploreInitialData, dataset: datasetWithMetrics })(
    dispatch,
    // @ts-expect-error
    getState,
  );

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        datasources: expect.objectContaining({
          '8__table': expect.objectContaining({
            currency_formats: {
              count: { symbol: 'GBP', symbolPosition: 'prefix' },
              revenue: { symbol: 'USD', symbolPosition: 'suffix' },
            },
          }),
        }),
      }),
    }),
  );
});

test('seeds only guarded matching-input hydration transitions', () => {
  mockedIsFeatureEnabled.mockReturnValue(true);
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: { conf: { DEFAULT_TIME_FILTER: 'Last year' } },
    explore: {},
  }));
  const persisted = {
    ...exploreInitialData.form_data,
  };
  delete persisted.time_range;
  const initialData = {
    ...exploreInitialData,
    form_data: { ...persisted },
    slice: {
      ...exploreInitialData.slice!,
      form_data: { ...persisted },
    },
  };

  // @ts-expect-error focused hydration fixture
  hydrateExplore(initialData)(dispatch, getState);

  expect(dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: HYDRATE_CHART_NORMALIZATION,
      tracking: expect.objectContaining({
        chartId: 371,
        transitions: expect.objectContaining({
          time_range: {
            control: 'time_range',
            from_present: false,
            to_present: true,
            to_value: 'Last year',
          },
        }),
      }),
    }),
  );
});

test('does not seed normalization metadata for dashboard overrides', () => {
  mockedIsFeatureEnabled.mockReturnValue(true);
  window.history.pushState({}, '', '/explore/?dashboard_id=12');
  const dispatch = jest.fn();
  const getState = jest.fn(() => ({
    user: {},
    charts: {},
    datasources: {},
    common: {},
    explore: {},
  }));

  // @ts-expect-error focused hydration fixture
  hydrateExplore(exploreInitialData)(dispatch, getState);

  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: HYDRATE_CHART_NORMALIZATION }),
  );
});
