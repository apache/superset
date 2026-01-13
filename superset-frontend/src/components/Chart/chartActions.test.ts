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
import sinon, { SinonSpy, SinonStub } from 'sinon';

import {
  FeatureFlag,
  SupersetClient,
  getChartMetadataRegistry,
  getChartBuildQueryRegistry,
  QueryFormData,
  JsonObject,
  AnnotationLayer,
} from '@superset-ui/core';
import { LOG_EVENT } from 'src/logger/actions';
import * as exploreUtils from 'src/explore/exploreUtils';
import * as actions from 'src/components/Chart/chartAction';
import * as asyncEvent from 'src/middleware/asyncEvent';
import { handleChartDataResponse } from 'src/components/Chart/chartAction';
import * as dataMaskActions from 'src/dataMask/actions';

import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { initialState } from 'src/SqlLab/fixtures';

interface MockState {
  charts: {
    [key: string]: {
      latestQueryFormData?: {
        time_grain_sqla?: string;
        granularity_sqla?: string;
      };
      queryController?: AbortController;
    };
  };
  common: {
    conf: {
      SUPERSET_WEBSERVER_TIMEOUT?: number;
    };
  };
}

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const mockGetState = (): MockState => ({
  charts: {
    chartKey: {
      latestQueryFormData: {
        time_grain_sqla: 'P1D',
        granularity_sqla: 'Date',
      },
    },
  },
  common: {
    conf: {},
  },
});

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: jest.fn(),
  getChartBuildQueryRegistry: jest.fn(),
}));

const mockedGetChartMetadataRegistry =
  getChartMetadataRegistry as jest.MockedFunction<
    typeof getChartMetadataRegistry
  >;
const mockedGetChartBuildQueryRegistry =
  getChartBuildQueryRegistry as jest.MockedFunction<
    typeof getChartBuildQueryRegistry
  >;

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('chart actions', () => {
  const MOCK_URL = '/mockURL';
  let dispatch: SinonSpy;
  let getExploreUrlStub: SinonStub;
  let getChartDataUriStub: SinonStub;
  let buildV1ChartDataPayloadStub: SinonStub;
  let waitForAsyncDataStub: SinonStub;
  let fakeMetadata: { useLegacyApi?: boolean; viz_type?: string };

  const setupDefaultFetchMock = (): void => {
    fetchMock.post(MOCK_URL, { json: {} }, { overwriteRoutes: true });
  };

  beforeAll(() => {
    setupDefaultFetchMock();
  });

  afterAll(() => fetchMock.restore());

  beforeEach(() => {
    dispatch = sinon.spy();
    getExploreUrlStub = sinon
      .stub(exploreUtils, 'getExploreUrl')
      .callsFake(() => MOCK_URL);
    getChartDataUriStub = sinon
      .stub(exploreUtils, 'getChartDataUri')
      .callsFake(({ qs }: { qs?: Record<string, unknown> }) =>
        URI(MOCK_URL).query(qs || {}),
      );
    buildV1ChartDataPayloadStub = sinon
      .stub(exploreUtils, 'buildV1ChartDataPayload')
      .resolves({
        some_param: 'fake query!',
        result_type: 'full',
        result_format: 'json',
      });
    fakeMetadata = { useLegacyApi: true };
    mockedGetChartMetadataRegistry.mockImplementation(
      () =>
        ({
          get: () => fakeMetadata,
        }) as ReturnType<typeof getChartMetadataRegistry>,
    );
    mockedGetChartBuildQueryRegistry.mockImplementation(
      () =>
        ({
          get: () => () => ({
            some_param: 'fake query!',
            result_type: 'full',
            result_format: 'json',
          }),
        }) as ReturnType<typeof getChartBuildQueryRegistry>,
    );
    waitForAsyncDataStub = sinon
      .stub(asyncEvent, 'waitForAsyncData')
      .callsFake((data: unknown) => Promise.resolve(data));
  });

  test('should defer abort of previous controller to avoid Redux state mutation', async () => {
    jest.useFakeTimers();
    const chartKey = 'defer_abort_test';
    const formData: Partial<QueryFormData> = {
      slice_id: 123,
      datasource: 'table__1',
      viz_type: 'table',
    };
    const oldController = new AbortController();
    const abortSpy = jest.spyOn(oldController, 'abort');
    const state: MockState = {
      charts: {
        [chartKey]: {
          queryController: oldController,
        },
      },
      common: {
        conf: {
          SUPERSET_WEBSERVER_TIMEOUT: 60,
        },
      },
    };
    const getState = jest.fn(() => state);
    const dispatchMock = jest.fn();
    const getChartDataRequestSpy = jest
      .spyOn(actions, 'getChartDataRequest')
      .mockResolvedValue({
        response: { status: 200 } as Response,
        json: { result: [] },
      });
    const handleChartDataResponseSpy = jest
      .spyOn(actions, 'handleChartDataResponse')
      .mockResolvedValue([]);
    const updateDataMaskSpy = jest
      .spyOn(dataMaskActions, 'updateDataMask')
      .mockReturnValue({ type: 'UPDATE_DATA_MASK' } as ReturnType<
        typeof dataMaskActions.updateDataMask
      >);
    const getQuerySettingsStub = sinon
      .stub(exploreUtils, 'getQuerySettings')
      .returns([false, () => {}]);

    try {
      const thunkAction = actions.exploreJSON(
        formData as QueryFormData,
        false,
        undefined,
        chartKey,
      );
      const promise = thunkAction(
        dispatchMock as unknown as actions.ChartThunkDispatch,
        getState as () => actions.RootState,
      );

      expect(abortSpy).not.toHaveBeenCalled();
      expect(oldController.signal.aborted).toBe(false);

      jest.runOnlyPendingTimers();

      expect(abortSpy).toHaveBeenCalledTimes(1);
      expect(oldController.signal.aborted).toBe(true);

      await promise;
    } finally {
      getChartDataRequestSpy.mockRestore();
      handleChartDataResponseSpy.mockRestore();
      updateDataMaskSpy.mockRestore();
      getQuerySettingsStub.restore();
      abortSpy.mockRestore();
      jest.useRealTimers();
    }
  });

  afterEach(() => {
    getExploreUrlStub.restore();
    getChartDataUriStub.restore();
    buildV1ChartDataPayloadStub.restore();
    fetchMock.resetHistory();
    waitForAsyncDataStub.restore();

    (
      global as unknown as { featureFlags: Record<string, boolean> }
    ).featureFlags = {
      [FeatureFlag.GlobalAsyncQueries]: false,
    };
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('v1 API', () => {
    beforeEach(() => {
      fakeMetadata = { viz_type: 'my_viz', useLegacyApi: false };
    });

    test('should query with the built query', async () => {
      const actionThunk = actions.postChartFormData(
        {} as QueryFormData,
        false,
        undefined,
        undefined,
      );
      await actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      );

      expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
      expect(fetchMock.calls(MOCK_URL)[0][1]?.body).toBe(
        JSON.stringify({
          some_param: 'fake query!',
          result_type: 'full',
          result_format: 'json',
        }),
      );
      expect(dispatch.args[0][0].type).toBe(actions.CHART_UPDATE_STARTED);
    });

    test('should handle the bigint without regression', async () => {
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
        formData: fakeMetadata as QueryFormData,
      });

      expect(fetchMock.calls(mockBigIntUrl)).toHaveLength(1);
      expect((json as JsonObject).value.toString()).toEqual(expectedBigNumber);
    });

    test('handleChartDataResponse should return result if GlobalAsyncQueries flag is disabled', async () => {
      const result = await handleChartDataResponse(
        { status: 200 } as Response,
        {
          result: [
            1, 2, 3,
          ] as unknown as actions.ChartDataRequestResponse['json']['result'],
        },
      );
      expect(result).toEqual([1, 2, 3]);
    });

    test('handleChartDataResponse should handle responses when GlobalAsyncQueries flag is enabled and results are returned synchronously', async () => {
      (
        global as unknown as { featureFlags: Record<string, boolean> }
      ).featureFlags = {
        [FeatureFlag.GlobalAsyncQueries]: true,
      };
      const result = await handleChartDataResponse(
        { status: 200 } as Response,
        {
          result: [
            1, 2, 3,
          ] as unknown as actions.ChartDataRequestResponse['json']['result'],
        },
      );
      expect(result).toEqual([1, 2, 3]);
    });

    test('handleChartDataResponse should handle responses when GlobalAsyncQueries flag is enabled and query is running asynchronously', async () => {
      (
        global as unknown as { featureFlags: Record<string, boolean> }
      ).featureFlags = {
        [FeatureFlag.GlobalAsyncQueries]: true,
      };
      const result = await handleChartDataResponse(
        { status: 202 } as Response,
        {
          result: [
            1, 2, 3,
          ] as unknown as actions.ChartDataRequestResponse['json']['result'],
        },
      );
      expect(result).toEqual([1, 2, 3]);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('legacy API', () => {
    beforeEach(() => {
      fakeMetadata = { useLegacyApi: true };
    });

    test('should dispatch CHART_UPDATE_STARTED action before the query', () => {
      const actionThunk = actions.postChartFormData({} as QueryFormData);

      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[0][0].type).toBe(actions.CHART_UPDATE_STARTED);
      });
    });

    test('should dispatch TRIGGER_QUERY action with the query', () => {
      const actionThunk = actions.postChartFormData({} as QueryFormData);
      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[1][0].type).toBe(actions.TRIGGER_QUERY);
      });
    });

    test('should dispatch UPDATE_QUERY_FORM_DATA action with the query', () => {
      const actionThunk = actions.postChartFormData({} as QueryFormData);
      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[2][0].type).toBe(actions.UPDATE_QUERY_FORM_DATA);
      });
    });

    test('should dispatch logEvent async action', () => {
      const actionThunk = actions.postChartFormData({} as QueryFormData);
      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(typeof dispatch.args[3][0]).toBe('function');

        dispatch.args[3][0](dispatch);
        expect(dispatch.callCount).toBe(6);
        expect(dispatch.args[5][0].type).toBe(LOG_EVENT);
      });
    });

    test('should dispatch CHART_UPDATE_SUCCEEDED action upon success', () => {
      const actionThunk = actions.postChartFormData({} as QueryFormData);
      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, success
        expect(dispatch.callCount).toBe(5);
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.args[4][0].type).toBe(actions.CHART_UPDATE_SUCCEEDED);
      });
    });

    test('should dispatch CHART_UPDATE_FAILED action upon query timeout', () => {
      const unresolvingPromise = new Promise(() => {});
      fetchMock.post(MOCK_URL, () => unresolvingPromise, {
        overwriteRoutes: true,
      });

      const timeoutInSec = 1 / 1000;
      const actionThunk = actions.postChartFormData(
        {} as QueryFormData,
        false,
        timeoutInSec,
      );

      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, fail
        expect(fetchMock.calls(MOCK_URL)).toHaveLength(1);
        expect(dispatch.callCount).toBe(5);
        expect(dispatch.args[4][0].type).toBe(actions.CHART_UPDATE_FAILED);
        setupDefaultFetchMock();
      });
    });

    test('should dispatch CHART_UPDATE_FAILED action upon non-timeout non-abort failure', () => {
      fetchMock.post(
        MOCK_URL,
        { throws: { statusText: 'misc error' } },
        { overwriteRoutes: true },
      );

      const timeoutInSec = 100; // Set to a time that is longer than the time this will take to fail
      const actionThunk = actions.postChartFormData(
        {} as QueryFormData,
        false,
        timeoutInSec,
      );

      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        // chart update, trigger query, update form data, fail
        expect(dispatch.callCount).toBe(5);
        const updateFailedAction = dispatch.args[4][0];
        expect(updateFailedAction.type).toBe(actions.CHART_UPDATE_FAILED);
        expect(updateFailedAction.queriesResponse[0].error).toBe('misc error');

        setupDefaultFetchMock();
      });
    });

    test('should dispatch CHART_UPDATE_STOPPED action upon abort', () => {
      fetchMock.post(
        MOCK_URL,
        { throws: { name: 'AbortError' } },
        { overwriteRoutes: true },
      );

      const timeoutInSec = 100;
      const actionThunk = actions.postChartFormData(
        {} as QueryFormData,
        false,
        timeoutInSec,
      );

      return actionThunk(
        dispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      ).then(() => {
        const types = dispatch.args
          .map((call: [{ type?: string }]) => call[0] && call[0].type)
          .filter(Boolean);

        expect(types).toContain(actions.CHART_UPDATE_STOPPED);
        expect(types).not.toContain(actions.CHART_UPDATE_FAILED);

        setupDefaultFetchMock();
      });
    });

    test('should handle the bigint without regression', async () => {
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
        formData: fakeMetadata as QueryFormData,
      });

      expect(fetchMock.calls(mockBigIntUrl)).toHaveLength(1);
      expect((json.result[0] as JsonObject).value.toString()).toEqual(
        expectedBigNumber,
      );
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('runAnnotationQuery', () => {
    const mockDispatch = jest.fn();
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should dispatch annotationQueryStarted and annotationQuerySuccess on successful query', async () => {
      const annotation: AnnotationLayer = {
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
        Promise.resolve({ json: { result: [] } } as { json: JsonObject }),
      );
      const buildV1ChartDataPayloadSpy = jest.spyOn(
        exploreUtils,
        'buildV1ChartDataPayload',
      );

      const queryFunc = actions.runAnnotationQuery({ annotation, key });
      await queryFunc(
        mockDispatch as unknown as actions.ChartThunkDispatch,
        mockGetState as () => actions.RootState,
      );

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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('chart actions timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should use the timeout from arguments when given', async () => {
    const postSpy = jest.spyOn(SupersetClient, 'post');
    postSpy.mockImplementation(() =>
      Promise.resolve({ json: { result: [] } } as { json: JsonObject }),
    );
    const timeout = 10; // Set the timeout value here
    const formData: Partial<QueryFormData> = { datasource: 'table__1' }; // Set the formData here
    const key = 'chartKey'; // Set the chart key here

    const store = mockStore(initialState);
    await store.dispatch(
      actions.runAnnotationQuery({
        annotation: {
          value: 'annotationValue',
          sourceType: 'Event',
          overrides: {},
        } as AnnotationLayer,
        timeout,
        formData: formData as QueryFormData,
        key,
      }),
    );

    const expectedPayload = {
      url: expect.any(String) as string,
      signal: expect.any(AbortSignal) as AbortSignal,
      timeout: timeout * 1000,
      headers: { 'Content-Type': 'application/json' },
      jsonPayload: expect.any(Object) as JsonObject,
    };

    expect(postSpy).toHaveBeenCalledWith(expectedPayload);
  });

  test('should use the timeout from common.conf when not passed as an argument', async () => {
    const postSpy = jest.spyOn(SupersetClient, 'post');
    postSpy.mockImplementation(() =>
      Promise.resolve({ json: { result: [] } } as { json: JsonObject }),
    );
    const formData: Partial<QueryFormData> = { datasource: 'table__1' }; // Set the formData here
    const key = 'chartKey'; // Set the chart key here

    const store = mockStore(initialState);
    await store.dispatch(
      actions.runAnnotationQuery({
        annotation: {
          value: 'annotationValue',
          sourceType: 'Event',
          overrides: {},
        } as AnnotationLayer,
        timeout: undefined,
        formData: formData as QueryFormData,
        key,
      }),
    );

    const expectedPayload = {
      url: expect.any(String) as string,
      signal: expect.any(AbortSignal) as AbortSignal,
      timeout:
        (initialState.common.conf as { SUPERSET_WEBSERVER_TIMEOUT: number })
          .SUPERSET_WEBSERVER_TIMEOUT * 1000,
      headers: { 'Content-Type': 'application/json' },
      jsonPayload: expect.any(Object) as JsonObject,
    };

    expect(postSpy).toHaveBeenCalledWith(expectedPayload);
  });
});
