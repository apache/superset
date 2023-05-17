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
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import shortid from 'shortid';
import * as featureFlags from 'src/featureFlags';
import * as actions from 'src/SqlLab/actions/sqlLab';
import { LOG_EVENT } from 'src/logger/actions';
import {
  defaultQueryEditor,
  query,
  initialState,
  queryId,
} from 'src/SqlLab/fixtures';
import { QueryState } from '@superset-ui/core';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('async actions', () => {
  const mockBigNumber = '9223372036854775807';
  const queryEditor = {
    ...defaultQueryEditor,
    id: 'abcd',
    autorun: false,
    latestQueryId: null,
    sql: 'SELECT *\nFROM\nWHERE',
    name: 'Untitled Query 1',
  };

  let dispatch;

  beforeEach(() => {
    dispatch = sinon.spy();
  });

  afterEach(fetchMock.resetHistory);

  const fetchQueryEndpoint = 'glob:*/api/v1/sqllab/results/*';
  fetchMock.get(
    fetchQueryEndpoint,
    JSON.stringify({ data: mockBigNumber, query: { sqlEditorId: 'dfsadfs' } }),
  );

  const runQueryEndpoint = 'glob:*/api/v1/sqllab/execute/';
  fetchMock.post(runQueryEndpoint, `{ "data": ${mockBigNumber} }`);

  describe('saveQuery', () => {
    const saveQueryEndpoint = 'glob:*/api/v1/saved_query/';
    fetchMock.post(saveQueryEndpoint, { results: { json: {} } });

    const makeRequest = () => {
      const request = actions.saveQuery(query, queryId);
      return request(dispatch, () => initialState);
    };

    it('posts to the correct url', () => {
      expect.assertions(1);

      const store = mockStore(initialState);
      return store.dispatch(actions.saveQuery(query, queryId)).then(() => {
        expect(fetchMock.calls(saveQueryEndpoint)).toHaveLength(1);
      });
    });

    it('posts the correct query object', () => {
      const store = mockStore(initialState);
      return store.dispatch(actions.saveQuery(query, queryId)).then(() => {
        const call = fetchMock.calls(saveQueryEndpoint)[0];
        const formData = JSON.parse(call[1].body);
        const mappedQueryToServer = actions.convertQueryToServer(query);

        Object.keys(mappedQueryToServer).forEach(key => {
          expect(formData[key]).toBeDefined();
        });
      });
    });

    it('calls 3 dispatch actions', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(dispatch.callCount).toBe(2);
      });
    });

    it('calls QUERY_EDITOR_SAVED after making a request', () => {
      expect.assertions(1);

      return makeRequest().then(() => {
        expect(dispatch.args[0][0].type).toBe(actions.QUERY_EDITOR_SAVED);
      });
    });

    it('onSave calls QUERY_EDITOR_SAVED and QUERY_EDITOR_SET_TITLE', () => {
      expect.assertions(1);

      const store = mockStore(initialState);
      const expectedActionTypes = [
        actions.QUERY_EDITOR_SAVED,
        actions.QUERY_EDITOR_SET_TITLE,
      ];
      return store.dispatch(actions.saveQuery(query)).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
      });
    });
  });

  describe('fetchQueryResults', () => {
    const makeRequest = () => {
      const request = actions.fetchQueryResults(query);
      return request(dispatch);
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

    it.skip('parses large number result without losing precision', () =>
      makeRequest().then(() => {
        expect(fetchMock.calls(fetchQueryEndpoint)).toHaveLength(1);
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).lastArg.results.data.toString()).toBe(
          mockBigNumber,
        );
      }));

    it('calls querySuccess on fetch success', () => {
      expect.assertions(1);

      const store = mockStore({});
      const expectedActionTypes = [
        actions.REQUEST_QUERY_RESULTS,
        actions.QUERY_SUCCESS,
      ];
      return store.dispatch(actions.fetchQueryResults(query)).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
      });
    });

    it('calls queryFailed on fetch error', () => {
      expect.assertions(1);

      fetchMock.get(
        fetchQueryEndpoint,
        { throws: { message: 'error text' } },
        { overwriteRoutes: true },
      );

      const store = mockStore({});
      const expectedActionTypes = [
        actions.REQUEST_QUERY_RESULTS,
        actions.QUERY_FAILED,
      ];
      return store.dispatch(actions.fetchQueryResults(query)).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
      });
    });
  });

  describe('runQuery without query params', () => {
    const makeRequest = () => {
      const request = actions.runQuery(query);
      return request(dispatch, () => initialState);
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

    it.skip('parses large number result without losing precision', () =>
      makeRequest().then(() => {
        expect(fetchMock.calls(runQueryEndpoint)).toHaveLength(1);
        expect(dispatch.callCount).toBe(2);
        expect(dispatch.getCall(1).lastArg.results.data.toString()).toBe(
          mockBigNumber,
        );
      }));

    it('calls querySuccess on fetch success', () => {
      expect.assertions(1);

      const store = mockStore({});
      const expectedActionTypes = [actions.START_QUERY, actions.QUERY_SUCCESS];
      const { dispatch } = store;
      const request = actions.runQuery(query);
      return request(dispatch, () => initialState).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
      });
    });

    it('calls queryFailed on fetch error and logs the error details', () => {
      expect.assertions(3);

      fetchMock.post(
        runQueryEndpoint,
        {
          throws: {
            message: 'error text',
            timeout: true,
            statusText: 'timeout',
          },
        },
        { overwriteRoutes: true },
      );

      const store = mockStore({});
      const expectedActionTypes = [
        actions.START_QUERY,
        LOG_EVENT,
        LOG_EVENT,
        actions.QUERY_FAILED,
      ];
      const { dispatch } = store;
      const request = actions.runQuery(query);
      return request(dispatch, () => initialState).then(() => {
        const actions = store.getActions();
        expect(actions.map(a => a.type)).toEqual(expectedActionTypes);
        expect(actions[1].payload.eventData.error_details).toContain(
          'Issue 1000',
        );
        expect(actions[2].payload.eventData.error_details).toContain(
          'Issue 1001',
        );
      });
    });
  });

  describe('runQuery with query params', () => {
    const { location } = window;

    beforeAll(() => {
      delete window.location;
      window.location = new URL('http://localhost/sqllab/?foo=bar');
    });

    afterAll(() => {
      delete window.location;
      window.location = location;
    });

    const makeRequest = () => {
      const request = actions.runQuery(query);
      return request(dispatch, () => initialState);
    };

    it('makes the fetch request', async () => {
      const runQueryEndpointWithParams =
        'glob:*/api/v1/sqllab/execute/?foo=bar';
      fetchMock.post(
        runQueryEndpointWithParams,
        `{ "data": ${mockBigNumber} }`,
      );
      await makeRequest().then(() => {
        expect(fetchMock.calls(runQueryEndpointWithParams)).toHaveLength(1);
      });
    });
  });

  describe('reRunQuery', () => {
    let stub;
    beforeEach(() => {
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('creates new query with a new id', () => {
      const id = 'id';
      const state = {
        sqlLab: {
          tabHistory: [id],
          queryEditors: [{ id, name: 'Dummy query editor' }],
          unsavedQueryEditor: {},
        },
      };
      const store = mockStore(state);
      const request = actions.reRunQuery(query);
      request(store.dispatch, store.getState);
      expect(store.getActions()[0].query.id).toEqual('abcd');
    });
  });

  describe('postStopQuery', () => {
    const stopQueryEndpoint = 'glob:*/api/v1/query/stop';
    fetchMock.post(stopQueryEndpoint, {});
    const baseQuery = {
      ...query,
      id: 'test_foo',
    };

    const makeRequest = () => {
      const request = actions.postStopQuery(baseQuery);
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
        const body = JSON.parse(call[1].body);
        expect(body.client_id).toBe(baseQuery.id);
      });
    });
  });

  describe('cloneQueryToNewTab', () => {
    let stub;
    beforeEach(() => {
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('creates new query editor', () => {
      expect.assertions(1);

      const id = 'id';
      const state = {
        sqlLab: {
          tabHistory: [id],
          queryEditors: [{ id, name: 'Dummy query editor' }],
          unsavedQueryEditor: {},
        },
      };
      const store = mockStore(state);
      const expectedActions = [
        {
          type: actions.ADD_QUERY_EDITOR,
          queryEditor: {
            name: 'Copy of Dummy query editor',
            dbId: 1,
            schema: query.schema,
            autorun: true,
            sql: 'SELECT * FROM something',
            queryLimit: undefined,
            maxRow: undefined,
            id: 'abcd',
            templateParams: undefined,
          },
        },
      ];
      const request = actions.cloneQueryToNewTab(query, true);
      return request(store.dispatch, store.getState).then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
    });
  });

  describe('addQueryEditor', () => {
    let stub;
    beforeEach(() => {
      stub = sinon.stub(shortid, 'generate').returns('abcd');
    });
    afterEach(() => {
      stub.restore();
    });

    it('creates new query editor', () => {
      expect.assertions(1);

      const store = mockStore(initialState);
      const expectedActions = [
        {
          type: actions.ADD_QUERY_EDITOR,
          queryEditor,
        },
      ];
      const request = actions.addQueryEditor(defaultQueryEditor);
      return request(store.dispatch, store.getState).then(() => {
        expect(store.getActions()).toEqual(expectedActions);
      });
    });

    describe('addNewQueryEditor', () => {
      it('creates new query editor with new tab name', () => {
        const store = mockStore(initialState);
        const expectedActions = [
          {
            type: actions.ADD_QUERY_EDITOR,
            queryEditor: {
              id: 'abcd',
              sql: expect.stringContaining('SELECT ...'),
              name: `Untitled Query ${
                store.getState().sqlLab.queryEditors.length + 1
              }`,
              dbId: defaultQueryEditor.dbId,
              schema: defaultQueryEditor.schema,
              autorun: false,
              queryLimit:
                defaultQueryEditor.queryLimit ||
                initialState.common.conf.DEFAULT_SQLLAB_LIMIT,
            },
          },
        ];
        const request = actions.addNewQueryEditor();
        return request(store.dispatch, store.getState).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
        });
      });
    });
  });

  describe('backend sync', () => {
    const updateTabStateEndpoint = 'glob:*/tabstateview/*';
    fetchMock.put(updateTabStateEndpoint, {});
    fetchMock.delete(updateTabStateEndpoint, {});
    fetchMock.post(updateTabStateEndpoint, JSON.stringify({ id: 1 }));

    const updateTableSchemaEndpoint = 'glob:*/tableschemaview/*';
    fetchMock.put(updateTableSchemaEndpoint, {});
    fetchMock.delete(updateTableSchemaEndpoint, {});
    fetchMock.post(updateTableSchemaEndpoint, JSON.stringify({ id: 1 }));

    const getTableMetadataEndpoint = 'glob:**/api/v1/database/*/table/*/*/';
    fetchMock.get(getTableMetadataEndpoint, {});
    const getExtraTableMetadataEndpoint =
      'glob:**/api/v1/database/*/table_extra/*/*/';
    fetchMock.get(getExtraTableMetadataEndpoint, {});

    let isFeatureEnabledMock;

    beforeEach(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(
          feature => feature === 'SQLLAB_BACKEND_PERSISTENCE',
        );
    });

    afterEach(() => {
      isFeatureEnabledMock.mockRestore();
    });

    afterEach(fetchMock.resetHistory);

    describe('querySuccess', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const store = mockStore({});
        const results = { query: { sqlEditorId: 'abcd' } };
        const expectedActions = [
          {
            type: actions.QUERY_SUCCESS,
            query,
            results,
          },
        ];
        return store.dispatch(actions.querySuccess(query, results)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
        });
      });
    });

    describe('fetchQueryResults', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const results = {
          data: mockBigNumber,
          query: { sqlEditorId: 'abcd' },
          status: QueryState.SUCCESS,
          query_id: 'efgh',
        };
        fetchMock.get(fetchQueryEndpoint, JSON.stringify(results), {
          overwriteRoutes: true,
        });
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REQUEST_QUERY_RESULTS,
            query,
          },
          // missing below
          {
            type: actions.QUERY_SUCCESS,
            query,
            results,
          },
        ];
        return store.dispatch(actions.fetchQueryResults(query)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
        });
      });

      it("doesn't update the tab state in the backend on stoppped query", () => {
        expect.assertions(2);

        const results = {
          status: QueryState.STOPPED,
          query_id: 'efgh',
        };
        fetchMock.get(fetchQueryEndpoint, JSON.stringify(results), {
          overwriteRoutes: true,
        });
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REQUEST_QUERY_RESULTS,
            query,
          },
          // missing below
          {
            type: actions.QUERY_SUCCESS,
            query,
            results,
          },
        ];
        return store.dispatch(actions.fetchQueryResults(query)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(0);
        });
      });
    });

    describe('addQueryEditor', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.ADD_QUERY_EDITOR,
            queryEditor: { ...queryEditor, id: '1' },
          },
        ];
        return store.dispatch(actions.addQueryEditor(queryEditor)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
        });
      });
    });

    describe('setActiveQueryEditor', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.SET_ACTIVE_QUERY_EDITOR,
            queryEditor,
          },
        ];
        return store
          .dispatch(actions.setActiveQueryEditor(queryEditor))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('removeQueryEditor', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REMOVE_QUERY_EDITOR,
            queryEditor,
          },
        ];
        return store
          .dispatch(actions.removeQueryEditor(queryEditor))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetDb', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const dbId = 42;
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SETDB,
            queryEditor,
            dbId,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetDb(queryEditor, dbId))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetSchema', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const schema = 'schema';
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_SCHEMA,
            queryEditor,
            schema,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetSchema(queryEditor, schema))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetAutorun', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const autorun = true;
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_AUTORUN,
            queryEditor,
            autorun,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetAutorun(queryEditor, autorun))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetTitle', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const name = 'name';
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_TITLE,
            queryEditor,
            name,
          },
        ];
        return store
          .dispatch(
            actions.queryEditorSetTitle(queryEditor, name, queryEditor.id),
          )
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetAndSaveSql', () => {
      const sql = 'SELECT * ';
      const expectedActions = [
        {
          type: actions.QUERY_EDITOR_SET_SQL,
          queryEditor,
          sql,
        },
      ];
      describe('with backend persistence flag on', () => {
        it('updates the tab state in the backend', () => {
          expect.assertions(2);

          const store = mockStore(initialState);
          const request = actions.queryEditorSetAndSaveSql(queryEditor, sql);
          return request(store.dispatch, store.getState).then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
        });
      });
      describe('with backend persistence flag off', () => {
        it('does not update the tab state in the backend', () => {
          const backendPersistenceOffMock = jest
            .spyOn(featureFlags, 'isFeatureEnabled')
            .mockImplementation(
              feature => !(feature === 'SQLLAB_BACKEND_PERSISTENCE'),
            );

          const store = mockStore(initialState);
          const request = actions.queryEditorSetAndSaveSql(queryEditor, sql);
          request(store.dispatch, store.getState);

          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(0);
          backendPersistenceOffMock.mockRestore();
        });
      });
    });

    describe('queryEditorSetQueryLimit', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const queryLimit = 10;
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_QUERY_LIMIT,
            queryEditor,
            queryLimit,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetQueryLimit(queryEditor, queryLimit))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetTemplateParams', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const templateParams = '{"foo": "bar"}';
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_TEMPLATE_PARAMS,
            queryEditor,
            templateParams,
          },
        ];
        return store
          .dispatch(
            actions.queryEditorSetTemplateParams(queryEditor, templateParams),
          )
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('addTable', () => {
      it('updates the table schema state in the backend', () => {
        expect.assertions(6);

        const database = { disable_data_preview: true };
        const tableName = 'table';
        const schemaName = 'schema';
        const store = mockStore(initialState);
        const expectedActionTypes = [
          actions.MERGE_TABLE, // addTable
          actions.MERGE_TABLE, // getTableMetadata
          actions.MERGE_TABLE, // getTableExtendedMetadata
          actions.MERGE_TABLE, // addTable
        ];
        const request = actions.addTable(
          query,
          database,
          tableName,
          schemaName,
        );
        return request(store.dispatch, store.getState).then(() => {
          expect(store.getActions().map(a => a.type)).toEqual(
            expectedActionTypes,
          );
          expect(store.getActions()[0].prepend).toBeTruthy();
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
          expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);
          expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(
            1,
          );

          // tab state is not updated, since no query was run
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(0);
        });
      });

      it('fetches table schema state from unsaved change', () => {
        const database = { disable_data_preview: true };
        const tableName = 'table';
        const schemaName = 'schema';
        const expectedDbId = 473892;
        const store = mockStore({
          ...initialState,
          sqlLab: {
            ...initialState.sqlLab,
            unsavedQueryEditor: {
              id: query.id,
              dbId: expectedDbId,
            },
          },
        });
        const request = actions.addTable(
          query,
          database,
          tableName,
          schemaName,
        );
        return request(store.dispatch, store.getState).then(() => {
          expect(
            fetchMock.calls(
              `glob:**/api/v1/database/${expectedDbId}/table/*/*/`,
            ),
          ).toHaveLength(1);
          expect(
            fetchMock.calls(
              `glob:**/api/v1/database/${expectedDbId}/table_extra/*/*/`,
            ),
          ).toHaveLength(1);

          // tab state is not updated, since no query was run
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(0);
        });
      });

      it('updates and runs data preview query when configured', () => {
        expect.assertions(5);

        const results = {
          data: mockBigNumber,
          query: { sqlEditorId: 'null', dbId: 1 },
          query_id: 'efgh',
        };
        fetchMock.post(runQueryEndpoint, JSON.stringify(results), {
          overwriteRoutes: true,
        });

        const database = { disable_data_preview: false, id: 1 };
        const tableName = 'table';
        const schemaName = 'schema';
        const store = mockStore(initialState);
        const expectedActionTypes = [
          actions.MERGE_TABLE, // addTable
          actions.MERGE_TABLE, // getTableMetadata
          actions.MERGE_TABLE, // getTableExtendedMetadata
          actions.MERGE_TABLE, // addTable (data preview)
          actions.START_QUERY, // runQuery (data preview)
          actions.MERGE_TABLE, // addTable
          actions.QUERY_SUCCESS, // querySuccess
        ];
        const request = actions.addTable(
          query,
          database,
          tableName,
          schemaName,
        );
        return request(store.dispatch, store.getState).then(() => {
          expect(store.getActions().map(a => a.type)).toEqual(
            expectedActionTypes,
          );
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
          expect(fetchMock.calls(getTableMetadataEndpoint)).toHaveLength(1);
          expect(fetchMock.calls(getExtraTableMetadataEndpoint)).toHaveLength(
            1,
          );
          // tab state is not updated, since the query is a data preview
          expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(0);
        });
      });
    });

    describe('expandTable', () => {
      it('updates the table schema state in the backend', () => {
        expect.assertions(2);

        const table = { id: 1 };
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.EXPAND_TABLE,
            table,
          },
        ];
        return store.dispatch(actions.expandTable(table)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
        });
      });
    });

    describe('collapseTable', () => {
      it('updates the table schema state in the backend', () => {
        expect.assertions(2);

        const table = { id: 1 };
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.COLLAPSE_TABLE,
            table,
          },
        ];
        return store.dispatch(actions.collapseTable(table)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
        });
      });
    });

    describe('removeTables', () => {
      it('updates the table schema state in the backend', () => {
        expect.assertions(2);

        const table = { id: 1 };
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REMOVE_TABLES,
            tables: [table],
          },
        ];
        return store.dispatch(actions.removeTables([table])).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
        });
      });

      it('deletes multiple tables and updates the table schema state in the backend', () => {
        expect.assertions(2);

        const tables = [{ id: 1 }, { id: 2 }];
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REMOVE_TABLES,
            tables,
          },
        ];
        return store.dispatch(actions.removeTables(tables)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(2);
        });
      });
    });

    describe('migrateQueryEditorFromLocalStorage', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(3);

        const results = {
          data: mockBigNumber,
          query: { sqlEditorId: 'null' },
          query_id: 'efgh',
        };
        fetchMock.post(runQueryEndpoint, JSON.stringify(results), {
          overwriteRoutes: true,
        });

        const tables = [
          { id: 'one', dataPreviewQueryId: 'previewOne' },
          { id: 'two', dataPreviewQueryId: 'previewTwo' },
        ];
        const queries = [
          { ...query, id: 'previewOne' },
          { ...query, id: 'previewTwo' },
        ];
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.MIGRATE_QUERY_EDITOR,
            oldQueryEditor: queryEditor,
            // new qe has a different id
            newQueryEditor: { ...queryEditor, id: '1' },
          },
          {
            type: actions.MIGRATE_TAB_HISTORY,
            newId: '1',
            oldId: 'abcd',
          },
          {
            type: actions.MIGRATE_TABLE,
            oldTable: tables[0],
            // new table has a different id and points to new query editor
            newTable: { ...tables[0], id: 1, queryEditorId: '1' },
          },
          {
            type: actions.MIGRATE_TABLE,
            oldTable: tables[1],
            // new table has a different id and points to new query editor
            newTable: { ...tables[1], id: 1, queryEditorId: '1' },
          },
          {
            type: actions.MIGRATE_QUERY,
            queryId: 'previewOne',
            queryEditorId: '1',
          },
          {
            type: actions.MIGRATE_QUERY,
            queryId: 'previewTwo',
            queryEditorId: '1',
          },
        ];
        return store
          .dispatch(
            actions.migrateQueryEditorFromLocalStorage(
              queryEditor,
              tables,
              queries,
            ),
          )
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(3);

            // query editor has 2 tables loaded in the schema viewer
            expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(2);
          });
      });
    });
  });
});
