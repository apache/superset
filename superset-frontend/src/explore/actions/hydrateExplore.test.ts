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

import { VizType } from '@superset-ui/core';
import { hydrateExplore, HYDRATE_EXPLORE } from './hydrateExplore';
import { exploreInitialData } from '../fixtures';

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
  // @ts-ignore
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
  // @ts-ignore
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
  // @ts-ignore
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
  // @ts-ignore
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

  // @ts-ignore
  hydrateExplore({ ...exploreInitialData, dataset: datasetWithMetrics })(
    dispatch,
    // @ts-ignore
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
