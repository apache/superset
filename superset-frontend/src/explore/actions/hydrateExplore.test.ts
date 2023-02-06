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
      data: {
        charts: {
          371: {
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: {
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: 'table',
            },
            sliceFormData: {
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: 'table',
            },
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          },
        },
        datasources: {
          '8__table': exploreInitialData.dataset,
        },
        saveModal: {
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        },
        explore: {
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: exploreInitialData.dataset,
          controls: expect.any(Object),
          form_data: exploreInitialData.form_data,
          slice: exploreInitialData.slice,
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        },
      },
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
      data: {
        charts: {
          371: {
            id: 371,
            chartAlert: null,
            chartStatus: null,
            chartStackTrace: null,
            chartUpdateEndTime: null,
            chartUpdateStartTime: 0,
            latestQueryFormData: {
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: 'table',
            },
            sliceFormData: {
              cache_timeout: undefined,
              datasource: '8__table',
              slice_id: 371,
              url_params: undefined,
              viz_type: 'table',
            },
            queryController: null,
            queriesResponse: null,
            triggerQuery: false,
            lastRendered: 0,
          },
        },
        datasources: {
          '8__table': exploreInitialData.dataset,
        },
        saveModal: {
          dashboards: [],
          saveModalAlert: null,
          isVisible: false,
        },
        explore: {
          can_add: false,
          can_download: false,
          can_overwrite: false,
          isDatasourceMetaLoading: false,
          isStarred: false,
          triggerRender: false,
          datasource: exploreInitialData.dataset,
          controls: expect.any(Object),
          controlsTransferred: ['all_columns'],
          form_data: exploreInitialData.form_data,
          slice: exploreInitialData.slice,
          standalone: null,
          force: null,
          saveAction: null,
          common: {},
        },
      },
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
