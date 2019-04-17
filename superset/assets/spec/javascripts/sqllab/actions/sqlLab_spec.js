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
/* eslint no-unused-expressions: 0 */
import sinon from 'sinon';
import fetchMock from 'fetch-mock';

import * as actions from '../../../../src/SqlLab/actions/sqlLab';
import { query } from '../fixtures';

describe('async actions', () => {
  const mockBigNumber = '9223372036854775807';

  let dispatch;

  beforeEach(() => {
    dispatch = sinon.spy();
  });

  afterEach(fetchMock.resetHistory);

  describe('saveQuery', () => {
    const saveQueryEndpoint = 'glob:*/savedqueryviewapi/api/create';
    fetchMock.post(saveQueryEndpoint, 'ok');

    it('posts to the correct url', () => {
      expect.assertions(1);
      const thunk = actions.saveQuery(query);

      return thunk((/* mockDispatch */) => ({})).then(() => {
        expect(fetchMock.calls(saveQueryEndpoint)).toHaveLength(1);
      });
    });

    it('posts the correct query object', () => {
      const thunk = actions.saveQuery(query);

      return thunk((/* mockDispatch */) => ({})).then(() => {
        const call = fetchMock.calls(saveQueryEndpoint)[0];
        const formData = call[1].body;
        Object.keys(query).forEach((key) => {
          expect(formData.get(key)).toBeDefined();
        });
      });
    });
  });

  describe('fetchQueryResults', () => {
    const fetchQueryEndpoint = 'glob:*/superset/results/*';
    fetchMock.get(fetchQueryEndpoint, '{ "data": ' + mockBigNumber + ' }');

    const makeRequest = () => {
      const actionThunk = actions.fetchQueryResults(query);
      return actionThunk(dispatch);
    };

    it('makes the fetch request', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(fetchMock.calls(fetchQueryEndpoint)).toHaveLength(1);
      });
    });

    it('calls requestQueryResults', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(dispatch.args[0][0].type).toBe(actions.REQUEST_QUERY_RESULTS);
      });
    });

    xit('parses large number result without losing precision', () =>
      makeRequest().then(() => {
        expect(fetchMock.calls(fetchQueryEndpoint)).toHaveLength(1);
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).lastArg.results.data.toString()).toBe(mockBigNumber);
      }));

    it('calls querySuccess on fetch success', () =>
      makeRequest().then(() => {
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_SUCCESS);
      }));

    it('calls queryFailed on fetch error', () => {
      expect.assertions(2);
      fetchMock.get(
        fetchQueryEndpoint,
        { throws: { error: 'error text' } },
        { overwriteRoutes: true },
      );

      return makeRequest().then(() => {
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_FAILED);
      });
    });
  });

  describe('runQuery', () => {
    const runQueryEndpoint = 'glob:*/superset/sql_json/*';
    fetchMock.post(runQueryEndpoint, '{ "data": ' + mockBigNumber + ' }');

    const makeRequest = () => {
      const request = actions.runQuery(query);
      return request(dispatch);
    };

    it('makes the fetch request', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(fetchMock.calls(runQueryEndpoint)).toHaveLength(1);
      });
    });

    it('calls startQuery', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(dispatch.args[0][0].type).toBe(actions.START_QUERY);
      });
    });

    xit('parses large number result without losing precision', () =>
      makeRequest().then(() => {
        expect(fetchMock.calls(runQueryEndpoint)).toHaveLength(1);
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).lastArg.results.data.toString()).toBe(mockBigNumber);
      }));

    it('calls querySuccess on fetch success', () => {
      expect.assertions(3);

      return makeRequest().then(() => {
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(0).args[0].type).toBe(actions.START_QUERY);
        expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_SUCCESS);
      });
    });

    it('calls queryFailed on fetch error', () => {
      expect.assertions(2);

      fetchMock.post(
        runQueryEndpoint,
        { throws: { error: 'error text' } },
        { overwriteRoutes: true },
      );

      return makeRequest().then(() => {
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).args[0].type).toBe(actions.QUERY_FAILED);
      });
    });
  });

  describe('postStopQuery', () => {
    const stopQueryEndpoint = 'glob:*/superset/stop_query/*';
    fetchMock.post(stopQueryEndpoint, {});

    const makeRequest = () => {
      const request = actions.postStopQuery(query);
      return request(dispatch);
    };

    it('makes the fetch request', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(fetchMock.calls(stopQueryEndpoint)).toHaveLength(1);
      });
    });


    it('calls stopQuery', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(dispatch.getCall(0).args[0].type).toBe(actions.STOP_QUERY);
      });
    });

    it('sends the correct data', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        const call = fetchMock.calls(stopQueryEndpoint)[0];
        expect(call[1].body.get('client_id')).toBe(query.id);
      });
    });
  });
});
