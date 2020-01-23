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

import * as actions from '../../../../src/SqlLab/actions/sqlLab';
import { defaultQueryEditor, query } from '../fixtures';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('async actions', () => {
  const mockBigNumber = '9223372036854775807';
  const queryEditor = {
    id: 'abcd',
    autorun: false,
    dbId: null,
    latestQueryId: null,
    selectedText: null,
    sql: 'SELECT *\nFROM\nWHERE',
    title: 'Untitled Query',
    schemaOptions: [{ value: 'main', label: 'main', title: 'main' }],
  };

  let dispatch;

  beforeEach(() => {
    dispatch = sinon.spy();
  });

  afterEach(fetchMock.resetHistory);

  const fetchQueryEndpoint = 'glob:*/superset/results/*';
  fetchMock.get(
    fetchQueryEndpoint,
    JSON.stringify({ data: mockBigNumber, query: { sqlEditorId: 'dfsadfs' } }),
  );

  const runQueryEndpoint = 'glob:*/superset/sql_json/*';
  fetchMock.post(runQueryEndpoint, '{ "data": ' + mockBigNumber + ' }');

  describe('saveQuery', () => {
    const saveQueryEndpoint = 'glob:*/savedqueryviewapi/api/create';
    fetchMock.post(saveQueryEndpoint, 'ok');

    it('posts to the correct url', () => {
      expect.assertions(1);

      const store = mockStore({});
      return store.dispatch(actions.saveQuery(query)).then(() => {
        expect(fetchMock.calls(saveQueryEndpoint)).toHaveLength(1);
      });
    });

    it('posts the correct query object', () => {
      const store = mockStore({});
      return store.dispatch(actions.saveQuery(query)).then(() => {
        const call = fetchMock.calls(saveQueryEndpoint)[0];
        const formData = call[1].body;
        Object.keys(query).forEach(key => {
          expect(formData.get(key)).toBeDefined();
        });
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

    xit('parses large number result without losing precision', () =>
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
        { throws: { error: 'error text' } },
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

  describe('runQuery', () => {
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
        expect(dispatch.getCall(1).lastArg.results.data.toString()).toBe(
          mockBigNumber,
        );
      }));

    it('calls querySuccess on fetch success', () => {
      expect.assertions(1);

      const store = mockStore({});
      const expectedActionTypes = [actions.START_QUERY, actions.QUERY_SUCCESS];
      return store.dispatch(actions.runQuery(query)).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
      });
    });

    it('calls queryFailed on fetch error', () => {
      expect.assertions(1);

      fetchMock.post(
        runQueryEndpoint,
        { throws: { error: 'error text' } },
        { overwriteRoutes: true },
      );

      const store = mockStore({});
      const expectedActionTypes = [actions.START_QUERY, actions.QUERY_FAILED];
      return store.dispatch(actions.runQuery(query)).then(() => {
        expect(store.getActions().map(a => a.type)).toEqual(
          expectedActionTypes,
        );
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
          queryEditors: [{ id, title: 'Dummy query editor' }],
        },
      };
      const store = mockStore(state);
      const expectedActions = [
        {
          type: actions.ADD_QUERY_EDITOR,
          queryEditor: {
            title: 'Copy of Dummy query editor',
            dbId: 1,
            schema: null,
            autorun: true,
            sql: 'SELECT * FROM something',
            queryLimit: undefined,
            maxRow: undefined,
            id: 'abcd',
          },
        },
      ];
      return store
        .dispatch(actions.cloneQueryToNewTab(query, true))
        .then(() => {
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

      const store = mockStore({});
      const expectedActions = [
        {
          type: actions.ADD_QUERY_EDITOR,
          queryEditor,
        },
      ];
      return store
        .dispatch(actions.addQueryEditor(defaultQueryEditor))
        .then(() => {
          expect(store.getActions()).toEqual(expectedActions);
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

    const getTableMetadataEndpoint = 'glob:*/api/v1/database/*';
    fetchMock.get(getTableMetadataEndpoint, {});
    const getExtraTableMetadataEndpoint =
      'glob:*/superset/extra_table_metadata/*';
    fetchMock.get(getExtraTableMetadataEndpoint, {});

    let isFeatureEnabledMock;

    beforeAll(() => {
      isFeatureEnabledMock = jest
        .spyOn(featureFlags, 'isFeatureEnabled')
        .mockImplementation(
          feature => feature === 'SQLLAB_BACKEND_PERSISTENCE',
        );
    });

    afterAll(() => {
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

        const title = 'title';
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_TITLE,
            queryEditor,
            title,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetTitle(queryEditor, title))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
          });
      });
    });

    describe('queryEditorSetSql', () => {
      it('updates the tab state in the backend', () => {
        expect.assertions(2);

        const sql = 'SELECT * ';
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.QUERY_EDITOR_SET_SQL,
            queryEditor,
            sql,
          },
        ];
        return store
          .dispatch(actions.queryEditorSetSql(queryEditor, sql))
          .then(() => {
            expect(store.getActions()).toEqual(expectedActions);
            expect(fetchMock.calls(updateTabStateEndpoint)).toHaveLength(1);
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
        expect.assertions(5);

        const results = {
          data: mockBigNumber,
          query: { sqlEditorId: 'null' },
          query_id: 'efgh',
        };
        fetchMock.post(runQueryEndpoint, JSON.stringify(results), {
          overwriteRoutes: true,
        });

        const tableName = 'table';
        const schemaName = 'schema';
        const store = mockStore({});
        const expectedActionTypes = [
          actions.MERGE_TABLE, // addTable
          actions.MERGE_TABLE, // getTableMetadata
          actions.START_QUERY, // runQuery (data preview)
          actions.MERGE_TABLE, // getTableExtendedMetadata
          actions.QUERY_SUCCESS, // querySuccess
          actions.MERGE_TABLE, // addTable
        ];
        return store
          .dispatch(actions.addTable(query, tableName, schemaName))
          .then(() => {
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

    describe('removeTable', () => {
      it('updates the table schema state in the backend', () => {
        expect.assertions(2);

        const table = { id: 1 };
        const store = mockStore({});
        const expectedActions = [
          {
            type: actions.REMOVE_TABLE,
            table,
          },
        ];
        return store.dispatch(actions.removeTable(table)).then(() => {
          expect(store.getActions()).toEqual(expectedActions);
          expect(fetchMock.calls(updateTableSchemaEndpoint)).toHaveLength(1);
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
