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
import URI from 'urijs';
import fetchMock from 'fetch-mock';
import sinon from 'sinon';

import * as chartlib from '@superset-ui/core';
import { FeatureFlag, SupersetClient } from '@superset-ui/core';
import { LOG_EVENT } from 'src/logger/actions';
import * as exploreUtils from 'src/explore/exploreUtils';
import * as actions from 'src/components/Chart/chartAction';
import * as asyncEvent from 'src/middleware/asyncEvent';
import { handleChartDataResponse } from 'src/components/Chart/chartAction';

describe('chart actions', () => {
  const MOCK_URL = '/mockURL';
  let dispatch;
  let getExploreUrlStub;
  let getChartDataUriStub;
  let metadataRegistryStub;
  let buildQueryRegistryStub;
  let waitForAsyncDataStub;
  let fakeMetadata;

  const setupDefaultFetchMock = () => {
    fetchMock.post(MOCK_URL, { json: {} }, { overwriteRoutes: true });
  };

  beforeAll(() => {
    setupDefaultFetchMock();
  });

  afterAll(fetchMock.restore);

  beforeEach(() => {
    dispatch = sinon.spy();
    getExploreUrlStub = sinon
      .stub(exploreUtils, 'getExploreUrl')
      .callsFake(() => MOCK_URL);
    getChartDataUriStub = sinon
      .stub(exploreUtils, 'getChartDataUri')
      .callsFake(({ qs }) => URI(MOCK_URL).query(qs));
    fakeMetadata = { useLegacyApi: true };
    metadataRegistryStub = sinon
      .stub(chartlib, 'getChartMetadataRegistry')
      .callsFake(() => ({ get: () => fakeMetadata }));
    buildQueryRegistryStub = sinon
      .stub(chartlib, 'getChartBuildQueryRegistry')
      .callsFake(() => ({
        get: () => () => ({
          some_param: 'fake query!',
          result_type: 'full',
          result_format: 'json',
        }),
      }));
    waitForAsyncDataStub = sinon
      .stub(asyncEvent, 'waitForAsyncData')
      .callsFake(data => Promise.resolve(data));
  });

  afterEach(() => {
    getExploreUrlStub.restore();
    getChartDataUriStub.restore();
    fetchMock.resetHistory();
    metadataRegistryStub.restore();
    buildQueryRegistryStub.restore();
    waitForAsyncDataStub.restore();

    global.featureFlags = {
      [FeatureFlag.GlobalAsyncQueries]: false,
    };
  });

  describe('v1 API', () => {
    beforeEach(() => {
      fakeMetadata = { viz_type: 'my_viz', useLegacyApi: false };
    });

    it('should query with the built query', async () => {
      const actionThunk = actions.postChartFormData({}, null);
      await actionThunk(dispatch);

      expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
      expect(fetchMock.calls(MOCK_URL)[0][1].body).toBe(
        JSON.stringify({
          some_param: 'fake query!',
          result_type: 'full',
          result_format: 'json',
        }),
      );
      expect(dispatch.args[0][0].type).toBe(actions.CHART_UPDATE_STARTED);
    });

    it('should handle the bigint without regression', async () => {
      getChartDataUriStub.restore();
      const mockBigIntUrl = '/mock/chart/data/bigint';
      const expectedBigNumber = '9223372036854775807';
      fetchMock.post(mockBigIntUrl, `{ "value": ${expectedBigNumber} }`, {
        overwriteRoutes: true,
      });
      getChartDataUriStub = sinon
        .stub(exploreUtils, 'getChartDataUri')
        .callsFake(() => URI(mockBigIntUrl));

      const { json } = await actions.getChartDataRequest({
        formData: fakeMetadata,
      });

      expect(fetchMock.calls(mockBigIntUrl)).toHaveLength(1);
      expect(json.value.toString()).toEqual(expectedBigNumber);
    });

    it('handleChartDataResponse should return result if GlobalAsyncQueries flag is disabled', async () => {
      const result = await handleChartDataResponse(
        { status: 200 },
        { result: [1, 2, 3] },
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('handleChartDataResponse should handle responses when GlobalAsyncQueries flag is enabled and results are returned synchronously', async () => {
      global.featureFlags = {
        [FeatureFlag.GlobalAsyncQueries]: true,
      };
      const result = await handleChartDataResponse(
        { status: 200 },
        { result: [1, 2, 3] },
      );
      expect(result).toEqual([1, 2, 3]);
    });

    it('handleChartDataResponse should handle responses when GlobalAsyncQueries flag is enabled and query is running asynchronously', async () => {
      global.featureFlags = {
        [FeatureFlag.GlobalAsyncQueries]: true,
      };
      const result = await handleChartDataResponse(
        { status: 202 },
        { result: [1, 2, 3] },
      );
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('legacy API', () => {
    beforeEach(() => {
      fakeMetadata = { useLegacyApi: true };
    });

    it('should dispatch CHART_UPDATE_STARTED action before the query', () => {
      const actionThunk = actions.postChartFormData({});

      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[0][0].type).toBe(actions.CHART_UPDATE_STARTED);
      });
    });

    it('should dispatch TRIGGER_QUERY action with the query', () => {
      const actionThunk = actions.postChartFormData({});
      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[1][0].type).toBe(actions.TRIGGER_QUERY);
      });
    });

    it('should dispatch UPDATE_QUERY_FORM_DATA action with the query', () => {
      const actionThunk = actions.postChartFormData({});
      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[2][0].type).toBe(actions.UPDATE_QUERY_FORM_DATA);
      });
    });

    it('should dispatch logEvent async action', () => {
      const actionThunk = actions.postChartFormData({});
      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(typeof dispatch.args[3][0]).toBe('function');

        dispatch.args[3][0](dispatch);
        expect(dispatch.callCount).toBe(6);
        expect(dispatch.args[5][0].type).toBe(LOG_EVENT);
      });
    });

    it('should dispatch CHART_UPDATE_SUCCEEDED action upon success', () => {
      const actionThunk = actions.postChartFormData({});
      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[4][0].type).toBe(actions.CHART_UPDATE_SUCCEEDED);
      });
    });

    it('should dispatch CHART_UPDATE_FAILED action upon query timeout', () => {
      const unresolvingPromise = new Promise(() => {});
      fetchMock.post(MOCK_URL, () => unresolvingPromise, {
        overwriteRoutes: true,
      });

      const timeoutInSec = 1 / 1000;
      const actionThunk = actions.postChartFormData({}, false, timeoutInSec);

      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, fail
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.callCount).toBe(5);
        expect(dispatch.args[4][0].type).toBe(actions.CHART_UPDATE_FAILED);
        setupDefaultFetchMock();
      });
    });

    it('should dispatch CHART_UPDATE_FAILED action upon non-timeout non-abort failure', () => {
      fetchMock.post(
        MOCK_URL,
        { throws: { statusText: 'misc error' } },
        { overwriteRoutes: true },
      );

      const timeoutInSec = 100; // Set to a time that is longer than the time this will take to fail
      const actionThunk = actions.postChartFormData({}, false, timeoutInSec);

      return actionThunk(dispatch).then(() => {
        // chart update, trigger query, update form data, fail
        expect(dispatch.callCount).toBe(5);
        const updateFailedAction = dispatch.args[4][0];
        expect(updateFailedAction.type).toBe(actions.CHART_UPDATE_FAILED);
        expect(updateFailedAction.queriesResponse[0].error).toBe('misc error');

        setupDefaultFetchMock();
      });
    });

    it('should handle the bigint without regression', async () => {
      getExploreUrlStub.restore();
      const mockBigIntUrl = '/mock/chart/data/bigint';
      const expectedBigNumber = '9223372036854775807';
      fetchMock.post(mockBigIntUrl, `{ "value": ${expectedBigNumber} }`, {
        overwriteRoutes: true,
      });
      getExploreUrlStub = sinon
        .stub(exploreUtils, 'getExploreUrl')
        .callsFake(() => mockBigIntUrl);

      const { json } = await actions.getChartDataRequest({
        formData: fakeMetadata,
      });

      expect(fetchMock.calls(mockBigIntUrl)).toHaveLength(1);
      expect(json.result[0].value.toString()).toEqual(expectedBigNumber);
    });
  });

  describe('runAnnotationQuery', () => {
    const mockDispatch = jest.fn();
    const mockGetState = () => ({
      charts: {
        chartKey: {
          latestQueryFormData: {
            time_grain_sqla: 'P1D',
            granularity_sqla: 'Date',
          },
        },
      },
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should dispatch annotationQueryStarted and annotationQuerySuccess on successful query', async () => {
      const annotation = {
        name: 'Holidays',
        annotationType: 'EVENT',
        sourceType: 'NATIVE',
        color: null,
        opacity: '',
        style: 'solid',
        width: 1,
        showMarkers: false,
        hideLine: false,
        value: 1,
        overrides: {
          time_range: null,
        },
        show: true,
        showLabel: false,
        titleColumn: '',
        descriptionColumns: [],
        timeColumn: '',
        intervalEndColumn: '',
      };
      const key = undefined;

      const postSpy = jest.spyOn(SupersetClient, 'post');
      postSpy.mockImplementation(() =>
        Promise.resolve({ json: { result: [] } }),
      );
      const buildV1ChartDataPayloadSpy = jest.spyOn(
        exploreUtils,
        'buildV1ChartDataPayload',
      );

      const queryFunc = actions.runAnnotationQuery({ annotation, key });
      await queryFunc(mockDispatch, mockGetState);

      expect(buildV1ChartDataPayloadSpy).toHaveBeenCalledWith({
        formData: {
          granularity: 'Date',
          granularity_sqla: 'Date',
          time_grain_sqla: 'P1D',
        },
        force: false,
        resultFormat: 'json',
        resultType: 'full',
      });
    });
  });
});
