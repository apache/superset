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
import fetchMock from "fetch-mock";
import configureMockStore from "redux-mock-store";
import thunk from "redux-thunk";
import type { ThunkDispatch } from "redux-thunk";
import type { AnyAction } from "redux";
import { waitFor, defaultStore } from "spec/helpers/testing-library";
import * as actions from "src/SqlLab/actions/sqlLab";
import type { QueryEditor, Table, SqlLabRootState } from "src/SqlLab/types";
import { LOG_EVENT } from "src/logger/actions";
import {
  defaultQueryEditor,
  query as queryFixture,
  initialState,
  queryId,
} from "src/SqlLab/fixtures";
import { SupersetClient, isFeatureEnabled } from "@superset-ui/core";
import { ADD_TOAST } from "src/components/MessageToasts/actions";
import { EMPTY_STATE_QE_ID } from "src/SqlLab/hooks/useQueryEditor";
import { api } from "src/hooks/apiResources/queryApi";
import {
  queryHistoryApi,
  type QueryResult,
} from "src/hooks/apiResources/queries";
import { ToastType } from "../../components/MessageToasts/types";

const isFeatureEnabledMock = isFeatureEnabled as unknown as jest.Mock;
const query = { ...queryFixture, id: queryId } as any;
// Cast fixture to satisfy SqlLabRootState for getState callbacks in thunk tests
const typedInitialState = initialState as unknown as SqlLabRootState;

type DispatchExts = ThunkDispatch<SqlLabRootState, undefined, AnyAction>;

const middlewares = [thunk];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStore = configureMockStore<any, DispatchExts>(middlewares);

jest.mock("nanoid", () => ({
  nanoid: () => "abcd",
}));

afterAll(() => {
  jest.resetAllMocks();
});

jest.mock("@superset-ui/core", () => ({
  ...jest.requireActual("@superset-ui/core"),
  isFeatureEnabled: jest.fn(),
}));

test("should return the up to date query editor state", () => {
  const outOfUpdatedQueryEditor = {
    ...defaultQueryEditor,
    schema: null as unknown as string,
    sql: "SELECT ...",
  };
  const queryEditor = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table",
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditor],
      unsavedQueryEditor: {},
    },
  } as unknown as SqlLabRootState;
  expect(actions.getUpToDateQuery(state, outOfUpdatedQueryEditor)).toEqual(
    queryEditor,
  );
});

const mockBigNumber = "9223372036854775807";
const queryEditor = {
  ...defaultQueryEditor,
  id: "abcd",
  autorun: false,
  latestQueryId: null,
  sql: "SELECT *\nFROM\nWHERE",
  name: "Untitled Query 1",
};

let dispatch: jest.Mock;
const fetchQueryEndpoint = "glob:*/api/v1/sqllab/results/*";
const runQueryEndpoint = "glob:*/api/v1/sqllab/execute/";

function setupAsyncActions() {
  dispatch = jest.fn();
  fetchMock.removeRoute(fetchQueryEndpoint);
  fetchMock.get(
    fetchQueryEndpoint,
    JSON.stringify({
      data: mockBigNumber,
      query: { sqlEditorId: "dfsadfs" },
    }),
    { name: fetchQueryEndpoint },
  );

  fetchMock.removeRoute(runQueryEndpoint);
  fetchMock.post(runQueryEndpoint, `{ "data": ${mockBigNumber} }`, {
    name: runQueryEndpoint,
  });
}

function teardownAsyncHistory() {
  fetchMock.clearHistory();
}

const saveQueryEndpoint = "glob:*/api/v1/saved_query/";
fetchMock.post(saveQueryEndpoint, { results: { json: {} } });

const makeSaveQueryRequest = () => {
  const request = actions.saveQuery(query, queryId);
  return request(dispatch, () => typedInitialState, undefined);
};

test("posts to the correct url", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore(initialState);
  return store.dispatch(actions.saveQuery(query, queryId)).then(() => {
    expect(fetchMock.callHistory.calls(saveQueryEndpoint)).toHaveLength(1);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("posts the correct query object", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore(initialState);
  return store.dispatch(actions.saveQuery(query, queryId)).then(() => {
    const call = fetchMock.callHistory.calls(saveQueryEndpoint)[0];
    const formData = JSON.parse(call.options.body as string);
    const mappedQueryToServer = actions.convertQueryToServer(query);

    // The 'id' field is excluded from the POST payload since it's for new queries
    expect(formData.id).toBeUndefined();
    Object.keys(mappedQueryToServer).forEach((key) => {
      if (key !== "id") {
        expect(formData[key]).toBeDefined();
      }
    });
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls 3 dispatch actions", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeSaveQueryRequest().then(() => {
    expect(dispatch.mock.calls.length).toBe(2);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls QUERY_EDITOR_SAVED after making a request", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeSaveQueryRequest().then(() => {
    expect(dispatch.mock.calls[0][0].type).toBe(actions.QUERY_EDITOR_SAVED);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("onSave calls QUERY_EDITOR_SAVED and QUERY_EDITOR_SET_TITLE", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore(initialState);
  const expectedActionTypes = [
    actions.QUERY_EDITOR_SAVED,
    actions.QUERY_EDITOR_SET_TITLE,
  ];
  return store.dispatch(actions.saveQuery(query, queryId)).then(() => {
    expect(store.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const duplicateError = "A saved query with this name already exists";
const rejectedResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status });

const spies: jest.SpyInstance[] = [];
const track = <T extends jest.SpyInstance>(spy: T): T => {
  spies.push(spy);
  return spy;
};

function restoreTrackedSpies() {
  spies.splice(0).forEach((spy) => spy.mockRestore());
}

test("saveQuery rejects with the server message on a 422 without a toast", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  track(jest.spyOn(SupersetClient, "post")).mockRejectedValueOnce(
    rejectedResponse(422, { error: duplicateError }),
  );
  const store = mockStore(initialState);

  await expect(
    store.dispatch(actions.saveQuery(query, queryId)),
  ).rejects.toThrow(duplicateError);
  expect(store.getActions()).toEqual([]);

    })();
  } finally {
    restoreTrackedSpies();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("saveQuery toasts and rejects on other failures", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  track(jest.spyOn(SupersetClient, "post")).mockRejectedValueOnce(
    rejectedResponse(500, { message: "boom" }),
  );
  const store = mockStore(initialState);

  await expect(
    store.dispatch(actions.saveQuery(query, queryId)),
  ).rejects.toBeInstanceOf(Response);
  expect(store.getActions().map((a) => a.type)).toEqual([ADD_TOAST]);
  expect(store.getActions()[0].payload.toastType).toBe(ToastType.Danger);

    })();
  } finally {
    restoreTrackedSpies();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updateSavedQuery rejects with the server message on a 422 without a toast or editor update", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  track(jest.spyOn(SupersetClient, "put")).mockRejectedValueOnce(
    rejectedResponse(422, { error: duplicateError }),
  );
  track(jest.spyOn(console, "error")).mockImplementation(() => {});
  const store = mockStore(initialState);

  await expect(
    store.dispatch(
      actions.updateSavedQuery({ ...query, remoteId: 1 }, queryId),
    ),
  ).rejects.toThrow(duplicateError);
  expect(store.getActions()).toEqual([]);

    })();
  } finally {
    restoreTrackedSpies();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updateSavedQuery toasts without updating the editor on other failures", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  track(jest.spyOn(SupersetClient, "put")).mockRejectedValueOnce(
    rejectedResponse(500, { message: "boom" }),
  );
  track(jest.spyOn(console, "error")).mockImplementation(() => {});
  const store = mockStore(initialState);

  await expect(
    store.dispatch(
      actions.updateSavedQuery({ ...query, remoteId: 1 }, queryId),
    ),
  ).rejects.toBeInstanceOf(Response);
  expect(store.getActions().map((a) => a.type)).toEqual([ADD_TOAST]);

    })();
  } finally {
    restoreTrackedSpies();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updateSavedQuery updates the editor and toasts success on success", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  track(jest.spyOn(SupersetClient, "put")).mockResolvedValueOnce({
    json: {},
  } as never);
  const store = mockStore(initialState);

  await store.dispatch(
    actions.updateSavedQuery({ ...query, remoteId: 1 }, queryId),
  );

  expect(store.getActions().map((a) => a.type)).toEqual([
    ADD_TOAST,
    actions.QUERY_EDITOR_SET_TITLE,
    actions.UPDATE_QUERY_EDITOR,
  ]);

    })();
  } finally {
    restoreTrackedSpies();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const formatQueryEndpoint = "glob:*/api/v1/sqllab/format_sql/";
const expectedSql = "SELECT 1";

function setupFormatQuery() {
  fetchMock.removeRoute(formatQueryEndpoint);
  fetchMock.post(
    formatQueryEndpoint,
    { result: expectedSql },
    {
      name: formatQueryEndpoint,
    },
  );
}

test("posts to the correct url", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const store = mockStore(initialState);
  store.dispatch(actions.formatQuery(query as unknown as QueryEditor));
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );
  expect(store.getActions()[0].type).toBe(actions.QUERY_EDITOR_SET_SQL);
  expect(store.getActions()[0].sql).toBe(expectedSql);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("sends only sql in request body when no dbId or templateParams", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const queryEditorWithoutExtras = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table",
    dbId: null,
    templateParams: null,
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditorWithoutExtras],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  store.dispatch(
    actions.formatQuery(queryEditorWithoutExtras as unknown as QueryEditor),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );

  const call = fetchMock.callHistory.calls(formatQueryEndpoint)[0];
  const body = JSON.parse(call.options.body as string);

  expect(body).toEqual({ sql: "SELECT * FROM table" });
  expect(body.database_id).toBeUndefined();
  expect(body.template_params).toBeUndefined();

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("includes database_id in request when dbId is provided", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const queryEditorWithDb = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table",
    dbId: 5,
    templateParams: null,
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditorWithDb],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  store.dispatch(
    actions.formatQuery(queryEditorWithDb as unknown as QueryEditor),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );

  const call = fetchMock.callHistory.calls(formatQueryEndpoint)[0];
  const body = JSON.parse(call.options.body as string);

  expect(body).toEqual({
    sql: "SELECT * FROM table",
    database_id: 5,
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("includes template_params as string when provided as string", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const queryEditorWithTemplateString = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table WHERE id = {{ user_id }}",
    dbId: 5,
    templateParams: '{"user_id": 123}',
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditorWithTemplateString],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  store.dispatch(
    actions.formatQuery(
      queryEditorWithTemplateString as unknown as QueryEditor,
    ),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );

  const call = fetchMock.callHistory.calls(formatQueryEndpoint)[0];
  const body = JSON.parse(call.options.body as string);

  expect(body).toEqual({
    sql: "SELECT * FROM table WHERE id = {{ user_id }}",
    database_id: 5,
    template_params: '{"user_id": 123}',
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("stringifies template_params when provided as object", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const queryEditorWithTemplateObject = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table WHERE id = {{ user_id }}",
    dbId: 5,
    templateParams: { user_id: 123, status: "active" },
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditorWithTemplateObject],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  store.dispatch(
    actions.formatQuery(
      queryEditorWithTemplateObject as unknown as QueryEditor,
    ),
  );

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );

  const call = fetchMock.callHistory.calls(formatQueryEndpoint)[0];
  const body = JSON.parse(call.options.body as string);

  expect(body).toEqual({
    sql: "SELECT * FROM table WHERE id = {{ user_id }}",
    database_id: 5,
    template_params: '{"user_id":123,"status":"active"}',
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("dispatches QUERY_EDITOR_SET_SQL with formatted result", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const formattedSql = "SELECT\n  *\nFROM\n  table";
  fetchMock.removeRoute(formatQueryEndpoint);
  fetchMock.route(
    formatQueryEndpoint,
    { result: formattedSql },
    { name: formatQueryEndpoint },
  );

  const queryEditorToFormat = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM table",
  };
  const state = {
    sqlLab: {
      queryEditors: [queryEditorToFormat],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  await store.dispatch(actions.formatQuery(queryEditorToFormat));

  const dispatchedActions = store.getActions();
  expect(dispatchedActions).toHaveLength(1);
  expect(dispatchedActions[0].type).toBe(actions.QUERY_EDITOR_SET_SQL);
  expect(dispatchedActions[0].sql).toBe(formattedSql);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("uses up-to-date query editor state from store", async () => {
  setupAsyncActions();
  setupFormatQuery();
  try {
    await (async () => {
  const outdatedQueryEditor = {
    ...defaultQueryEditor,
    sql: "OLD SQL",
    dbId: 1,
  };
  const upToDateQueryEditor = {
    ...defaultQueryEditor,
    sql: "SELECT * FROM updated_table",
    dbId: 10,
  };
  const state = {
    sqlLab: {
      queryEditors: [upToDateQueryEditor],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);

  // Pass outdated query editor, but expect the function to use the up-to-date one from store
  store.dispatch(actions.formatQuery(outdatedQueryEditor));

  await waitFor(() =>
    expect(fetchMock.callHistory.calls(formatQueryEndpoint)).toHaveLength(1),
  );

  const call = fetchMock.callHistory.calls(formatQueryEndpoint)[0];
  const body = JSON.parse(call.options.body as string);

  expect(body.sql).toBe("SELECT * FROM updated_table");
  expect(body.database_id).toBe(10);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const makeFetchQueryResultsRequest = () => {
  const store = mockStore(initialState);
  const request = actions.fetchQueryResults(query);
  return request(dispatch, store.getState, undefined);
};

test("makes the fetch request", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeFetchQueryResultsRequest().then(() => {
    expect(fetchMock.callHistory.calls(fetchQueryEndpoint)).toHaveLength(1);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls requestQueryResults", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeFetchQueryResultsRequest().then(() => {
    expect(dispatch.mock.calls[0][0].type).toBe(actions.REQUEST_QUERY_RESULTS);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

/* oxlint-disable-next-line jest/no-disabled-tests */
test.skip("parses large number result without losing precision", async () => {
  setupAsyncActions();
  try {
    await (async () => {
      return (
makeFetchQueryResultsRequest().then(() => {
    expect(fetchMock.callHistory.calls(fetchQueryEndpoint)).toHaveLength(1);
    expect(dispatch.mock.calls.length).toBe(2);
    expect(
      dispatch.mock.calls[1][
        dispatch.mock.calls[1].length - 1
      ].results.data.toString(),
    ).toBe(mockBigNumber);
  })
      );
    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls querySuccess on fetch success", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore({});
  const expectedActionTypes = [
    actions.REQUEST_QUERY_RESULTS,
    actions.QUERY_SUCCESS,
  ];
  return store.dispatch(actions.fetchQueryResults(query)).then(() => {
    expect(store.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls queryFailed on fetch error", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  fetchMock.removeRoute(fetchQueryEndpoint);
  fetchMock.get(
    fetchQueryEndpoint,
    { throws: { message: "error text" } },
    { name: fetchQueryEndpoint },
  );

  const store = mockStore({});
  const expectedActionTypes = [
    actions.REQUEST_QUERY_RESULTS,
    actions.QUERY_FAILED,
  ];
  return store.dispatch(actions.fetchQueryResults(query)).then(() => {
    expect(store.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const makeRunQueryRequest = () => {
  const request = actions.runQuery(query);
  return request(dispatch, () => typedInitialState, undefined);
};

test("makes the fetch request", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeRunQueryRequest().then(() => {
    expect(fetchMock.callHistory.calls(runQueryEndpoint)).toHaveLength(1);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls startQuery", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeRunQueryRequest().then(() => {
    expect(dispatch.mock.calls[0][0].type).toBe(actions.START_QUERY);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("parses large number result without losing precision", async () => {
  setupAsyncActions();
  try {
    await (async () => {
      return (
makeRunQueryRequest().then(() => {
    expect(fetchMock.callHistory.calls(runQueryEndpoint)).toHaveLength(1);
    expect(dispatch.mock.calls.length).toBe(2);
    expect(
      dispatch.mock.calls[1][
        dispatch.mock.calls[1].length - 1
      ].results.data.toString(),
    ).toBe(mockBigNumber);
  })
      );
    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls querySuccess on fetch success", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore({});
  const expectedActionTypes = [actions.START_QUERY, actions.QUERY_SUCCESS];
  const { dispatch } = store;
  const request = actions.runQuery(query);
  return request(dispatch, () => typedInitialState, undefined).then(() => {
    expect(store.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls queryFailed on fetch error and logs the error details", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(2);

  fetchMock.removeRoute(runQueryEndpoint);
  fetchMock.post(
    runQueryEndpoint,
    {
      throws: {
        message: "error text",
        timeout: true,
        statusText: "timeout",
      },
    },
    { name: runQueryEndpoint },
  );

  const store = mockStore({});
  const expectedActionTypes = [
    actions.START_QUERY,
    LOG_EVENT,
    actions.QUERY_FAILED,
  ];
  const { dispatch } = store;
  const request = actions.runQuery(query);
  return request(dispatch, () => typedInitialState, undefined).then(() => {
    const actions = store.getActions();
    expect(actions.map((a) => a.type)).toEqual(expectedActionTypes);
    expect(actions[1].payload.eventData.issue_codes).toEqual([1000, 1001]);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

let locationSpy: jest.SpyInstance;

function setupQueryLocation() {
  const u = new URL("http://localhost/sqllab/?foo=bar");
  locationSpy = jest.spyOn(window, "location", "get").mockReturnValue({
    href: u.href,
    pathname: u.pathname,
    search: u.search,
    hash: u.hash,
    origin: u.origin,
    host: u.host,
    hostname: u.hostname,
    port: u.port,
    protocol: u.protocol,
  } as Location);
}

function restoreQueryLocation() {
  locationSpy.mockRestore();
}

const makeRunQueryWithParamsRequest = () => {
  const request = actions.runQuery(query);
  return request(dispatch, () => typedInitialState, undefined);
};

test("makes the fetch request", async () => {
  setupQueryLocation();
  setupAsyncActions();
  try {
    await (async () => {
  const runQueryEndpointWithParams = "glob:*/api/v1/sqllab/execute/?foo=bar";
  fetchMock.post(runQueryEndpointWithParams, `{ "data": ${mockBigNumber} }`);
  await makeRunQueryWithParamsRequest().then(() => {
    expect(
      fetchMock.callHistory.calls(runQueryEndpointWithParams),
    ).toHaveLength(1);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
    restoreQueryLocation();
  }
});

test("creates new query with a new id", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const id = "id";
  const state = {
    sqlLab: {
      tabHistory: [id],
      queryEditors: [{ id, name: "Dummy query editor" }],
      unsavedQueryEditor: {},
    },
  };
  const store = mockStore(state);
  const request = actions.reRunQuery(query);
  request(store.dispatch, store.getState, undefined);
  expect(store.getActions()[0].query.id).toEqual("abcd");

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const stopQueryEndpoint = "glob:*/api/v1/query/stop";
fetchMock.post(stopQueryEndpoint, {});
const baseQuery = {
  ...query,
  id: "test_foo",
};

const makeStopQueryRequest = () => {
  const request = actions.postStopQuery(baseQuery);
  return request(dispatch, () => typedInitialState, undefined);
};

test("makes the fetch request", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeStopQueryRequest().then(() => {
    expect(fetchMock.callHistory.calls(stopQueryEndpoint)).toHaveLength(1);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("calls stopQuery", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeStopQueryRequest().then(() => {
    expect(dispatch.mock.calls[0][0].type).toBe(actions.STOP_QUERY);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("sends the correct data", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  return makeStopQueryRequest().then(() => {
    const call = fetchMock.callHistory.calls(stopQueryEndpoint)[0];
    const body = JSON.parse(call.options.body as string);
    expect(body.client_id).toBe(baseQuery.id);
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("creates new query editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const id = "id";
  const state = {
    sqlLab: {
      tabHistory: [id],
      queryEditors: [{ id, name: "out of updated title" }],
      unsavedQueryEditor: {
        id,
        name: "Dummy query editor",
      },
    },
  };
  const store = mockStore(state);
  const expectedActions = [
    {
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: {
        name: "Copy of Dummy query editor",
        dbId: 1,
        catalog: query.catalog,
        schema: query.schema,
        autorun: true,
        sql: "SELECT * FROM something",
        queryLimit: undefined,
        maxRow: undefined,
        id: "abcd",
        immutableId: "abcd",
        templateParams: undefined,
        inLocalStorage: true,
        loaded: true,
      },
    },
  ];
  const request = actions.cloneQueryToNewTab(query, true);
  request(store.dispatch, store.getState, undefined);

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const supersetClientGetSpy = jest.spyOn(SupersetClient, "get");
const savedQueryStore = mockStore(initialState);

const mockSavedQueryApiResponse = {
  catalog: null,
  changed_by: {
    first_name: "Superset",
    id: 1,
    last_name: "Admin",
  },
  changed_on: "2024-12-28T20:06:14.246743",
  changed_on_delta_humanized: "8 days ago",
  created_by: {
    first_name: "Superset",
    id: 1,
    last_name: "Admin",
  },
  database: {
    database_name: "examples",
    id: 2,
  },
  description: "A saved query description",
  id: 1,
  label: "Query 1",
  schema: "public",
  sql: "SELECT * FROM channels",
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: "channels",
    },
  ],
  template_parameters: null,
};

const makePopSavedQueryRequest = (id: string | number) => {
  const request = actions.popSavedQuery(String(id));
  const { dispatch } = savedQueryStore;

  return request(dispatch, () => typedInitialState, undefined);
};

function setupPopSavedQuery() {
  supersetClientGetSpy.mockClear();
  savedQueryStore.clearActions();
}

function restorePopSavedQuerySpy() {
  supersetClientGetSpy.mockRestore();
}

test("calls API endpint with correct params", async () => {
  setupAsyncActions();
  setupPopSavedQuery();
  try {
    await (async () => {
  supersetClientGetSpy.mockResolvedValue({
    json: { result: mockSavedQueryApiResponse },
  } as any);

  await makePopSavedQueryRequest(123);

  expect(supersetClientGetSpy).toHaveBeenCalledWith({
    endpoint: "/api/v1/saved_query/123",
  });

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("dispatches addQueryEditor with correct params on successful API call", async () => {
  setupAsyncActions();
  setupPopSavedQuery();
  try {
    await (async () => {
  supersetClientGetSpy.mockResolvedValue({
    json: { result: mockSavedQueryApiResponse },
  } as any);

  const expectedParams = {
    name: "Query 1",
    description: "A saved query description",
    dbId: 2,
    catalog: null,
    schema: "public",
    sql: "SELECT * FROM channels",
    templateParams: null,
    remoteId: 1,
  };

  await makePopSavedQueryRequest(1);

  const addQueryEditorAction = savedQueryStore
    .getActions()
    .find((action) => action.type === actions.ADD_QUERY_EDITOR);

  expect(addQueryEditorAction).toBeTruthy();
  expect(addQueryEditorAction?.queryEditor).toEqual(
    expect.objectContaining(expectedParams),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("should dispatch addDangerToast on API error", async () => {
  setupAsyncActions();
  setupPopSavedQuery();
  try {
    await (async () => {
  supersetClientGetSpy.mockRejectedValue(new Error("not found"));

  await makePopSavedQueryRequest(1);

  const dispatchedActions = savedQueryStore.getActions();
  expect(dispatchedActions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: ADD_TOAST,
        payload: expect.objectContaining({
          toastType: ToastType.Danger,
        }),
      }),
    ]),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
    restorePopSavedQuerySpy();
  }
});

test.each([
  {
    name: "popPermalink",
    action: () => actions.popPermalink("abc123"),
  },
  {
    name: "popStoredQuery",
    action: () => actions.popStoredQuery("456"),
  },
  {
    name: "popQuery",
    action: () => actions.popQuery("789"),
  },
  {
    name: "popDatasourceQuery",
    action: () => actions.popDatasourceQuery("1__table"),
  },
])("$name dispatches addDangerToast on API error", async ({ action }) => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore(initialState);
  jest
    .spyOn(SupersetClient, "get")
    .mockRejectedValueOnce(new Error("not found"));

  const thunk = action();
  await thunk(store.dispatch, () => typedInitialState, undefined);

  const dispatchedActions = store.getActions();
  expect(dispatchedActions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: ADD_TOAST,
        payload: expect.objectContaining({
          toastType: ToastType.Danger,
        }),
      }),
    ]),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

// The numeric prefix of a `<id>__query` datasource key is a query id, not a
// dataset id, so it must never be resolved through the dataset API.
const datasetEndpoint = "glob:*/api/v1/dataset/*";
const datasourceMetadataEndpoint = "glob:*/fetch_datasource_metadata*";
const queryDatasourceMetadata = {
  name: "My tab",
  catalog: "analytics_catalog",
  schema: "analytics",
  database: { id: 7, backend: "postgresql" },
  sql: "SELECT 1",
};
const unrelatedDataset = {
  result: {
    name: "unrelated_dataset",
    schema: "unrelated_schema",
    database: { id: 99 },
    select_star: "SELECT * FROM unrelated_dataset",
  },
};
const generatedSql = "SELECT a FROM (SELECT 1) AS virtual_table";

const mockQueryDatasourceLookups = ({
  datasetWithSameId,
  queryFound,
  metadata = queryDatasourceMetadata,
}: {
  datasetWithSameId: boolean;
  queryFound: boolean;
  metadata?: Record<string, unknown>;
}) => {
  fetchMock.removeRoute(datasetEndpoint);
  fetchMock.removeRoute(datasourceMetadataEndpoint);
  fetchMock.get(datasetEndpoint, datasetWithSameId ? unrelatedDataset : 404, {
    name: datasetEndpoint,
  });
  fetchMock.get(datasourceMetadataEndpoint, queryFound ? metadata : 404, {
    name: datasourceMetadataEndpoint,
  });
};

const popDatasourceQuery = (datasourceKey: string, sql?: string) => {
  const store = mockStore(initialState);
  return actions
    .popDatasourceQuery(datasourceKey, sql)(
      store.dispatch,
      () => typedInitialState,
      undefined,
    )
    .then(() => store.getActions());
};

function teardownDatasourceRoutes() {
  fetchMock.removeRoute(datasetEndpoint);
  fetchMock.removeRoute(datasourceMetadataEndpoint);
}

const isDatasourceToast = (action: AnyAction) =>
  action.type === ADD_TOAST &&
  action.payload.toastType === ToastType.Danger &&
  action.payload.text === "The datasource couldn't be loaded";

test("popDatasourceQuery does not look up a query datasource key as a dataset", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });

  await popDatasourceQuery("42__query", generatedSql);

  expect(
    fetchMock.callHistory.calls(datasetEndpoint).map((call) => call.url),
  ).toEqual([]);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("popDatasourceQuery requests the datasource metadata with the full datasource key", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });

  await popDatasourceQuery("42__query", generatedSql);

  const requests = fetchMock.callHistory
    .calls(datasourceMetadataEndpoint)
    .map((call) => new URL(call.url));
  expect(requests).toHaveLength(1);
  expect(requests[0].pathname).toBe("/fetch_datasource_metadata");
  expect(requests[0].searchParams.get("datasourceKey")).toBe("42__query");

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test.each([{ datasetWithSameId: false }, { datasetWithSameId: true }])(
  "popDatasourceQuery opens the supplied SQL on the query database, catalog and schema (dataset with the same id exists: $datasetWithSameId)",
  async ({ datasetWithSameId }) => {
  setupAsyncActions();
  try {
    await (async () => {
    mockQueryDatasourceLookups({ datasetWithSameId, queryFound: true });

    const dispatched = await popDatasourceQuery("42__query", generatedSql);

    expect(dispatched.some(isDatasourceToast)).toBe(false);
    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: expect.objectContaining({
          name: "Query My tab",
          dbId: 7,
          catalog: "analytics_catalog",
          schema: "analytics",
          sql: generatedSql,
          autorun: false,
        }),
      }),
    );
  
    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
},
);

test("popDatasourceQuery falls back to the SQL of the query when no SQL is supplied", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });

  const dispatched = await popDatasourceQuery("42__query");

  expect(dispatched).toContainEqual(
    expect.objectContaining({
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: expect.objectContaining({
        dbId: 7,
        catalog: "analytics_catalog",
        schema: "analytics",
        sql: "SELECT 1",
        autorun: false,
      }),
    }),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("popDatasourceQuery shows the error toast and opens no editor when the query cannot be loaded", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: false });

  const dispatched = await popDatasourceQuery("42__query", generatedSql);

  expect(dispatched.some(isDatasourceToast)).toBe(true);
  expect(
    dispatched.some((action) => action.type === actions.ADD_QUERY_EDITOR),
  ).toBe(false);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("popDatasourceQuery still resolves a table datasource key as a dataset id", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });
  fetchMock.removeRoute(datasetEndpoint);
  fetchMock.get(
    datasetEndpoint,
    {
      result: {
        name: "my_dataset",
        schema: "public",
        database: { id: 3 },
        select_star: "SELECT * FROM my_dataset",
      },
    },
    { name: datasetEndpoint },
  );

  const dispatched = await popDatasourceQuery("5__table");

  expect(fetchMock.callHistory.calls(datasetEndpoint)).toHaveLength(1);
  expect(fetchMock.callHistory.calls(datasetEndpoint)[0].url).toContain(
    "/api/v1/dataset/5?",
  );
  expect(fetchMock.callHistory.calls(datasourceMetadataEndpoint)).toHaveLength(
    0,
  );
  expect(dispatched).toContainEqual(
    expect.objectContaining({
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: expect.objectContaining({
        name: "Query my_dataset",
        dbId: 3,
        schema: "public",
        sql: "SELECT * FROM my_dataset",
      }),
    }),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test.each([
  { datasourceKey: "5__semantic_view" },
  { datasourceKey: "7__saved_query" },
])(
  "popDatasourceQuery shows the error toast without any lookup for the $datasourceKey datasource",
  async ({ datasourceKey }) => {
  setupAsyncActions();
  try {
    await (async () => {
    mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });

    const dispatched = await popDatasourceQuery(datasourceKey, generatedSql);

    expect(fetchMock.callHistory.calls(datasetEndpoint)).toHaveLength(0);
    expect(
      fetchMock.callHistory.calls(datasourceMetadataEndpoint),
    ).toHaveLength(0);
    expect(dispatched.some(isDatasourceToast)).toBe(true);
    expect(
      dispatched.some((action) => action.type === actions.ADD_QUERY_EDITOR),
    ).toBe(false);
  
    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
},
);

test("popDatasourceQuery still resolves a bare datasource id as a dataset id", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  mockQueryDatasourceLookups({ datasetWithSameId: true, queryFound: true });

  const dispatched = await popDatasourceQuery("5");

  expect(fetchMock.callHistory.calls(datasetEndpoint)).toHaveLength(1);
  expect(fetchMock.callHistory.calls(datasetEndpoint)[0].url).toContain(
    "/api/v1/dataset/5?",
  );
  expect(dispatched).toContainEqual(
    expect.objectContaining({
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: expect.objectContaining({
        name: "Query unrelated_dataset",
        dbId: 99,
      }),
    }),
  );

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test.each([
  {
    description: "null",
    metadata: { ...queryDatasourceMetadata, name: null },
  },
  {
    description: "absent",
    metadata: {
      catalog: "analytics_catalog",
      schema: "analytics",
      database: { id: 7, backend: "postgresql" },
      sql: "SELECT 1",
    },
  },
])(
  'popDatasourceQuery titles the editor "Query" when the query name is $description',
  async ({ metadata }) => {
  setupAsyncActions();
  try {
    await (async () => {
    mockQueryDatasourceLookups({
      datasetWithSameId: false,
      queryFound: true,
      metadata,
    });

    const dispatched = await popDatasourceQuery("42__query", generatedSql);

    expect(dispatched).toContainEqual(
      expect.objectContaining({
        type: actions.ADD_QUERY_EDITOR,
        queryEditor: expect.objectContaining({ name: "Query", dbId: 7 }),
      }),
    );
  
    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
},
);

test("creates new query editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore(initialState);
  const expectedActions = [
    {
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: {
        ...queryEditor,
        immutableId: "abcd",
        inLocalStorage: true,
        loaded: true,
      },
    },
  ];
  store.dispatch(actions.addQueryEditor(defaultQueryEditor));

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("creates new query editor with new tab name", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      unsavedQueryEditor: {
        id: defaultQueryEditor.id,
        name: "Untitled Query 6",
      },
    },
  });
  const expectedActions = [
    {
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: {
        id: "abcd",
        immutableId: "abcd",
        sql: expect.stringContaining("SELECT ..."),
        name: `Untitled Query 7`,
        dbId: defaultQueryEditor.dbId,
        catalog: defaultQueryEditor.catalog,
        schema: defaultQueryEditor.schema,
        autorun: false,
        queryLimit:
          (defaultQueryEditor as any).queryLimit ||
          initialState.common.conf.DEFAULT_SQLLAB_LIMIT,
        inLocalStorage: true,
        loaded: true,
      },
    },
  ];
  const request = actions.addNewQueryEditor();
  request(store.dispatch, store.getState, undefined);
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("creates a new query editor from the saved state in the empty tab", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const unsavedEmptyTabState = {
    id: EMPTY_STATE_QE_ID,
    dbId: 2,
    catalog: "test_catalog",
    schema: "test_schema",
  };
  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      tabHistory: [EMPTY_STATE_QE_ID],
      unsavedQueryEditor: unsavedEmptyTabState,
    },
  });
  const expectedActions = [
    {
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: {
        id: "abcd",
        immutableId: "abcd",
        sql: expect.stringContaining("SELECT ..."),
        name: "Untitled Query 4",
        dbId: unsavedEmptyTabState.dbId,
        catalog: unsavedEmptyTabState.catalog,
        schema: unsavedEmptyTabState.schema,
        inLocalStorage: true,
        autorun: false,
        queryLimit: initialState.common.conf.DEFAULT_SQLLAB_LIMIT,
        loaded: true,
      },
    },
  ];
  const request = actions.addNewQueryEditor();
  request(store.dispatch, store.getState, undefined);
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("set current query editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore(initialState);
  const expectedActions = [
    {
      type: actions.SET_ACTIVE_QUERY_EDITOR,
      queryEditor: defaultQueryEditor,
    },
  ];
  store.dispatch(actions.setActiveQueryEditor(defaultQueryEditor));

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("switch to the next tab editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore(initialState);
  const expectedActions = [
    {
      type: actions.SET_ACTIVE_QUERY_EDITOR,
      queryEditor: initialState.sqlLab.queryEditors[1],
    },
  ];
  store.dispatch(actions.switchQueryEditor());

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("switch to the first tab editor once it reaches the rightmost tab", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      tabHistory: [
        initialState.sqlLab.queryEditors[
          initialState.sqlLab.queryEditors.length - 1
        ].id,
      ],
    },
  });
  const expectedActions = [
    {
      type: actions.SET_ACTIVE_QUERY_EDITOR,
      queryEditor: initialState.sqlLab.queryEditors[0],
    },
  ];
  store.dispatch(actions.switchQueryEditor());

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("switch to the previous tab editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      tabHistory: [initialState.sqlLab.queryEditors[1].id],
    },
  });
  const expectedActions = [
    {
      type: actions.SET_ACTIVE_QUERY_EDITOR,
      queryEditor: initialState.sqlLab.queryEditors[0],
    },
  ];
  store.dispatch(actions.switchQueryEditor(true));

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("switch to the last tab editor once it reaches the leftmost tab", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      tabHistory: [initialState.sqlLab.queryEditors[0].id],
    },
  });
  const expectedActions = [
    {
      type: actions.SET_ACTIVE_QUERY_EDITOR,
      queryEditor:
        initialState.sqlLab.queryEditors[
          initialState.sqlLab.queryEditors.length - 1
        ],
    },
  ];
  store.dispatch(actions.switchQueryEditor(true));

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const updateTabStateEndpoint = "glob:*/tabstateview/*";
fetchMock.put(updateTabStateEndpoint, {});
fetchMock.delete(updateTabStateEndpoint, {});
fetchMock.post(updateTabStateEndpoint, JSON.stringify({ id: 1 }));

const updateTableSchemaEndpoint = "glob:*/tableschemaview/*";
fetchMock.put(updateTableSchemaEndpoint, {});
fetchMock.delete(updateTableSchemaEndpoint, {});
fetchMock.post(updateTableSchemaEndpoint, JSON.stringify({ id: 1 }));

const getDatabaseEndpoint = /\/api\/v1\/database\/\d+$/;
fetchMock.get(
  getDatabaseEndpoint,
  { result: { id: queryEditor.dbId } },
  { name: "getDatabase" },
);

const updateTableSchemaExpandedEndpoint = "glob:**/tableschemaview/*/expanded";
fetchMock.post(updateTableSchemaExpandedEndpoint, {});

const getTableMetadataEndpoint = "glob:**/api/v1/database/*/table_metadata/*";
fetchMock.get(getTableMetadataEndpoint, {});
const getExtraTableMetadataEndpoint =
  "glob:**/api/v1/database/*/table_metadata/extra/*";
fetchMock.get(getExtraTableMetadataEndpoint, {});

function setupBackendSync() {
  isFeatureEnabledMock.mockImplementation(
    (feature: string) => feature === "SQLLAB_BACKEND_PERSISTENCE",
  );
  fetchMock.modifyRoute("getDatabase", {
    response: { result: { id: queryEditor.dbId } },
  });
}

function teardownBackendFlag() {
  isFeatureEnabledMock.mockRestore();
}

function teardownBackendHistory() { fetchMock.clearHistory(); }

test("creates the tab state in the local storage", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.ADD_QUERY_EDITOR,
      queryEditor: {
        ...queryEditor,
        id: "abcd",
        immutableId: "abcd",
        loaded: true,
        inLocalStorage: true,
      },
    },
  ];
  store.dispatch(actions.addQueryEditor(queryEditor));

  expect(store.getActions()).toEqual(expectedActions);
  expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(0);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.REMOVE_QUERY_EDITOR,
      queryEditor,
    },
  ];
  store.dispatch(actions.removeQueryEditor(queryEditor));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("removeQuery removes the deleted query from the editorQueries cache", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  isFeatureEnabledMock.mockReturnValue(false);
  const editorId = "editor1";
  const queryToRemove = {
    ...query,
    id: "queryToRemove",
    sqlEditorId: editorId,
  };

  await defaultStore.dispatch(
    queryHistoryApi.util.upsertQueryData("editorQueries", { editorId }, {
      count: 2,
      ids: [],
      result: [{ id: "queryToRemove" }, { id: "keep" }],
    } as unknown as QueryResult),
  );

  await defaultStore.dispatch(
    actions.removeQuery(queryToRemove) as unknown as AnyAction,
  );

  const { data } = queryHistoryApi.endpoints.editorQueries.select({
    editorId,
  })(defaultStore.getState());

  expect(data).toEqual({
    count: 1,
    ids: [],
    result: [{ id: "keep" }],
  });

  defaultStore.dispatch(api.util.resetApiState());

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("removeQuery removes duplicate cache entries for the deleted query", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  isFeatureEnabledMock.mockReturnValue(false);
  const editorId = "editor1";
  const queryToRemove = {
    ...query,
    id: "queryToRemove",
    sqlEditorId: editorId,
  };

  // The infinite-scroll merge can append the same query twice when
  // offsets shift between page fetches; deletion must drop every copy.
  await defaultStore.dispatch(
    queryHistoryApi.util.upsertQueryData("editorQueries", { editorId }, {
      count: 3,
      ids: [],
      result: [
        { id: "queryToRemove" },
        { id: "keep" },
        { id: "queryToRemove" },
      ],
    } as unknown as QueryResult),
  );

  await defaultStore.dispatch(
    actions.removeQuery(queryToRemove) as unknown as AnyAction,
  );

  const { data } = queryHistoryApi.endpoints.editorQueries.select({
    editorId,
  })(defaultStore.getState());

  expect(data).toEqual({
    count: 2,
    ids: [],
    result: [{ id: "keep" }],
  });

  defaultStore.dispatch(api.util.resetApiState());

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const dbId = 42;
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SETDB,
      queryEditor,
      dbId,
    },
  ];
  store.dispatch(actions.queryEditorSetDb(queryEditor, dbId));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const catalog = "public";
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_CATALOG,
      queryEditor,
      catalog,
    },
  ];
  store.dispatch(actions.queryEditorSetCatalog(queryEditor, catalog));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const schema = "schema";
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_SCHEMA,
      queryEditor,
      schema,
    },
  ];
  store.dispatch(actions.queryEditorSetSchema(queryEditor, schema));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const autorun = true;
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_AUTORUN,
      queryEditor,
      autorun,
    },
  ];
  store.dispatch(actions.queryEditorSetAutorun(queryEditor, autorun));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const name = "name";
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_TITLE,
      queryEditor,
      name,
    },
  ];
  store.dispatch(
    actions.queryEditorSetTitle(queryEditor, name, queryEditor.id),
  );
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const sql = "SELECT * ";
const expectedActions = [
  {
    type: actions.QUERY_EDITOR_SET_SQL,
    queryEditor,
    sql,
  },
];

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [queryEditor],
    },
  });
  const request = actions.queryEditorSetAndSaveSql(queryEditor, sql);
  return request(store.dispatch, store.getState, undefined).then(() => {
    expect(store.getActions()).toEqual(expectedActions);
    expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(1);
  });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not update the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  isFeatureEnabledMock.mockImplementation(
    (feature: string) => !(feature === "SQLLAB_BACKEND_PERSISTENCE"),
  );

  const store = mockStore({
    ...initialState,
    sqlLab: {
      ...initialState.sqlLab,
      queryEditors: [queryEditor],
    },
  });
  const request = actions.queryEditorSetAndSaveSql(queryEditor, sql);
  request(store.dispatch, store.getState, undefined);

  expect(store.getActions()).toEqual(expectedActions);
  expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(0);
  isFeatureEnabledMock.mockRestore();

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const queryLimit = 10;
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_QUERY_LIMIT,
      queryEditor,
      queryLimit,
    },
  ];
  store.dispatch(actions.queryEditorSetQueryLimit(queryEditor, queryLimit));
  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(1);

  const templateParams = '{"foo": "bar"}';
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.QUERY_EDITOR_SET_TEMPLATE_PARAMS,
      queryEditor,
      templateParams,
    },
  ];
  store.dispatch(
    actions.queryEditorSetTemplateParams(queryEditor, templateParams),
  );

  expect(store.getActions()).toEqual(expectedActions);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("dispatches table state from unsaved change", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  const tableName = "table";
  const catalogName = null;
  const schemaName = "schema";
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
  const request = actions.addTable(query, tableName, catalogName, schemaName);
  request(store.dispatch, store.getState, undefined);
  expect(store.getActions()[0]).toEqual(
    expect.objectContaining({
      table: expect.objectContaining({
        name: tableName,
        catalog: catalogName,
        schema: schemaName,
        dbId: expectedDbId,
      }),
    }),
  );

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("uses tabViewId when available", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  const tableName = "table";
  const catalogName = null;
  const schemaName = "schema";
  const expectedDbId = 473892;
  const tabViewId = "123";
  const queryWithTabViewId = { ...query, tabViewId };

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
    queryWithTabViewId,
    tableName,
    catalogName,
    schemaName,
  );
  request(store.dispatch, store.getState, undefined);

  expect(store.getActions()[0]).toEqual(
    expect.objectContaining({
      table: expect.objectContaining({
        name: tableName,
        catalog: catalogName,
        schema: schemaName,
        dbId: expectedDbId,
        queryEditorId: tabViewId, // Should use tabViewId, not id
      }),
    }),
  );

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("falls back to id when tabViewId is not available", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  const tableName = "table";
  const catalogName = null;
  const schemaName = "schema";
  const expectedDbId = 473892;
  const queryWithoutTabViewId = { ...query, tabViewId: undefined };

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
    queryWithoutTabViewId,
    tableName,
    catalogName,
    schemaName,
  );
  request(store.dispatch, store.getState, undefined);

  expect(store.getActions()[0]).toEqual(
    expect.objectContaining({
      table: expect.objectContaining({
        name: tableName,
        catalog: catalogName,
        schema: schemaName,
        dbId: expectedDbId,
        queryEditorId: query.id, // Should use id when tabViewId is not available
      }),
    }),
  );

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const results = {
  data: mockBigNumber,
  query: { sqlEditorId: "null", dbId: 1 },
  query_id: "efgh",
};
const tableName = "table";
const catalogName = null;
const schemaName = "schema";
const previewStore = mockStore({
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    databases: {
      1: { disable_data_preview: false },
    },
  },
});

function setupTablePreview() {
  fetchMock.removeRoute(runQueryEndpoint);
  fetchMock.post(runQueryEndpoint, JSON.stringify(results), {
    name: runQueryEndpoint,
  });
}

function teardownTablePreview() {
  previewStore.clearActions();
  fetchMock.clearHistory();
}

test("updates and runs data preview query when configured", async () => {
  setupAsyncActions();
  setupBackendSync();
  setupTablePreview();
  try {
    await (async () => {
  expect.assertions(3);

  const expectedActionTypes = [
    actions.MERGE_TABLE, // addTable (data preview)
    actions.START_QUERY, // runQuery (data preview)
    actions.QUERY_SUCCESS, // querySuccess
  ];
  const request = actions.runTablePreviewQuery({
    dbId: 1,
    name: tableName,
    catalog: catalogName,
    schema: schemaName,
  });
  return request(previewStore.dispatch, previewStore.getState, undefined).then(() => {
    expect(previewStore.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
    expect(fetchMock.callHistory.calls(runQueryEndpoint)).toHaveLength(1);
    // tab state is not updated, since the query is a data preview
    expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(0);
  });

    })();
  } finally {
    teardownTablePreview();
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("runs data preview query only", async () => {
  setupAsyncActions();
  setupBackendSync();
  setupTablePreview();
  try {
    await (async () => {
  const expectedActionTypes = [
    actions.START_QUERY, // runQuery (data preview)
    actions.QUERY_SUCCESS, // querySuccess
  ];
  const request = actions.runTablePreviewQuery(
    {
      dbId: 1,
      name: tableName,
      catalog: catalogName,
      schema: schemaName,
    },
    true,
  );
  return request(previewStore.dispatch, previewStore.getState, undefined).then(() => {
    expect(previewStore.getActions().map((a) => a.type)).toEqual(expectedActionTypes);
    expect(fetchMock.callHistory.calls(runQueryEndpoint)).toHaveLength(1);
    // tab state is not updated, since the query is a data preview
    expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(0);
  });

    })();
  } finally {
    teardownTablePreview();
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the table schema state in the backend when initialized", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: 1, initialized: true };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.EXPAND_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.expandTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(1);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when table is not initialized", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: "yVJPtuSackF", initialized: false };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.EXPAND_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.expandTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      // Check all POST calls to find the expanded endpoint
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when initialized is undefined", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: "yVJPtuSackF" };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.EXPAND_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.expandTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      // Check all POST calls to find the expanded endpoint
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when feature flag is off", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  isFeatureEnabledMock.mockImplementation(
    (feature: string) => !(feature === "SQLLAB_BACKEND_PERSISTENCE"),
  );

  const table = { id: 1, initialized: true };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.EXPAND_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.expandTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      // Check all POST calls to find the expanded endpoint
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
      isFeatureEnabledMock.mockRestore();
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the table schema state in the backend when initialized", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: 1, initialized: true };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.COLLAPSE_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.collapseTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(1);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when table is not initialized", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: "yVJPtuSackF", initialized: false };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.COLLAPSE_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.collapseTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when initialized is undefined", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: "yVJPtuSackF" };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.COLLAPSE_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.collapseTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not call backend when feature flag is off", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  isFeatureEnabledMock.mockImplementation(
    (feature: string) => !(feature === "SQLLAB_BACKEND_PERSISTENCE"),
  );

  const table = { id: 1, initialized: true };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.COLLAPSE_TABLE,
      table,
    },
  ];
  return store
    .dispatch(actions.collapseTable(table as unknown as Table))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      const expandedCalls = fetchMock.callHistory
        .calls()
        .filter(
          (call) =>
            call.url &&
            call.url.includes("/tableschemaview/") &&
            call.url.includes("/expanded"),
        );
      expect(expandedCalls).toHaveLength(0);
      isFeatureEnabledMock.mockRestore();
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the table schema state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const table = { id: 1, initialized: true };
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.REMOVE_TABLES,
      tables: [table],
    },
  ];
  return store
    .dispatch(actions.removeTables([table] as unknown as Table[]))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      expect(
        fetchMock.callHistory.calls(updateTableSchemaEndpoint),
      ).toHaveLength(1);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("deletes multiple tables and updates the table schema state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const tables = [
    { id: 1, initialized: true },
    { id: 2, initialized: true },
  ];
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.REMOVE_TABLES,
      tables,
    },
  ];
  return store
    .dispatch(actions.removeTables(tables as unknown as Table[]))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      expect(
        fetchMock.callHistory.calls(updateTableSchemaEndpoint),
      ).toHaveLength(2);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("only updates the initialized table schema state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(2);

  const tables = [{ id: 1 }, { id: 2, initialized: true }];
  const store = mockStore({});
  const expectedActions = [
    {
      type: actions.REMOVE_TABLES,
      tables,
    },
  ];
  return store
    .dispatch(actions.removeTables(tables as unknown as Table[]))
    .then(() => {
      expect(store.getActions()).toEqual(expectedActions);
      expect(
        fetchMock.callHistory.calls(updateTableSchemaEndpoint),
      ).toHaveLength(1);
    });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("updates the tab state in the backend", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(3);

  const results = {
    data: mockBigNumber,
    query: { sqlEditorId: "null" },
    query_id: "efgh",
  };
  fetchMock.removeRoute(runQueryEndpoint);
  fetchMock.post(runQueryEndpoint, JSON.stringify(results), {
    name: runQueryEndpoint,
  });

  const oldQueryEditor = { ...queryEditor, inLocalStorage: true };
  const tables = [
    {
      id: "one",
      dataPreviewQueryId: "previewOne",
      queryEditorId: oldQueryEditor.id,
      inLocalStorage: true,
    },
    {
      id: "two",
      dataPreviewQueryId: "previewTwo",
      queryEditorId: oldQueryEditor.id,
      inLocalStorage: true,
    },
  ];
  const queries = [
    {
      ...query,
      id: "previewOne",
      sqlEditorId: null,
      isDataPreview: true,
    },
    {
      ...query,
      id: "previewTwo",
      sqlEditorId: null,
      isDataPreview: true,
    },
    {
      ...query,
      id: "runningQuery",
      sqlEditorId: oldQueryEditor.id,
      state: "running",
    },
    {
      ...query,
      id: "unrelatedQuery",
      sqlEditorId: "other-editor",
      state: "running",
    },
  ];
  const store = mockStore({
    sqlLab: {
      queries,
      tables,
    },
  });
  const expectedActions = [
    {
      type: actions.MIGRATE_QUERY_EDITOR,
      oldQueryEditor,
      // new qe has a different id
      newQueryEditor: {
        ...oldQueryEditor,
        tabViewId: "1",
        inLocalStorage: false,
        loaded: true,
      },
    },
    {
      type: actions.MIGRATE_TABLE,
      oldTable: tables[0],
      // new table has a different id and points to new query editor
      newTable: { ...tables[0], id: 1, queryEditorId: "1" },
    },
    {
      type: actions.MIGRATE_TABLE,
      oldTable: tables[1],
      // new table has a different id and points to new query editor
      newTable: { ...tables[1], id: 1, queryEditorId: "1" },
    },
    {
      type: actions.MIGRATE_QUERY,
      queryId: "runningQuery",
      queryEditorId: "1",
    },
  ];
  return store.dispatch(actions.syncQueryEditor(oldQueryEditor)).then(() => {
    expect(store.getActions()).toEqual(expectedActions);
    expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(2);

    // query editor has 2 tables loaded in the schema viewer
    expect(fetchMock.callHistory.calls(updateTableSchemaEndpoint)).toHaveLength(
      2,
    );
  });

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("clears a deleted database before migrating the tab state", async () => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  expect.assertions(7);

  const oldQueryEditor = {
    ...queryEditor,
    dbId: 99,
    catalog: "deleted_catalog",
    schema: "deleted_schema",
    inLocalStorage: true,
  };
  const staleTable = {
    id: "stale-table",
    dbId: 99,
    queryEditorId: oldQueryEditor.id,
    inLocalStorage: true,
  };
  const store = mockStore({
    sqlLab: {
      queries: [],
      tables: [staleTable],
      databases: { 1: {}, 99: {} },
    },
  });
  fetchMock.modifyRoute("getDatabase", {
    response: { status: 404, body: { message: "Not found" } },
  });

  await store.dispatch(actions.syncQueryEditor(oldQueryEditor));

  const call = fetchMock.callHistory.calls(updateTabStateEndpoint)[0];
  const formData = call.options.body as FormData;
  const persistedQueryEditor = JSON.parse(
    formData.get("queryEditor") as string,
  );
  expect(persistedQueryEditor).toMatchObject({
    dbId: null,
    sql: oldQueryEditor.sql,
  });
  expect(persistedQueryEditor).not.toHaveProperty("catalog");
  expect(persistedQueryEditor).not.toHaveProperty("schema");
  expect(fetchMock.callHistory.calls("getDatabase")).toHaveLength(1);
  expect(fetchMock.callHistory.calls("getDatabase")[0].url).toMatch(
    /\/api\/v1\/database\/99$/,
  );
  expect(fetchMock.callHistory.calls(updateTableSchemaEndpoint)).toHaveLength(
    0,
  );
  expect(store.getActions()).toEqual([
    {
      type: actions.MIGRATE_QUERY_EDITOR,
      oldQueryEditor,
      newQueryEditor: {
        ...oldQueryEditor,
        dbId: undefined,
        catalog: undefined,
        schema: undefined,
        tabViewId: "1",
        inLocalStorage: false,
        loaded: true,
      },
    },
    {
      type: actions.REMOVE_TABLES,
      tables: [staleTable],
    },
  ]);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test.each([
  { status: 400, body: { message: "Bad request" } },
  { status: 403, body: { message: "Forbidden" } },
  { status: 500, body: { message: "Server error" } },
  { throws: new Error("database lookup failed") },
])("does not migrate when database validation fails: %o", async (response) => {
  setupAsyncActions();
  setupBackendSync();
  try {
    await (async () => {
  const oldQueryEditor = {
    ...queryEditor,
    dbId: 99,
    inLocalStorage: true,
  };
  const store = mockStore({
    sqlLab: {
      queries: [],
      tables: [],
      databases: { 99: {} },
    },
  });
  fetchMock.modifyRoute("getDatabase", {
    response,
  });

  await store.dispatch(actions.syncQueryEditor(oldQueryEditor));

  expect(fetchMock.callHistory.calls(updateTabStateEndpoint)).toHaveLength(0);
  expect(store.getActions()).toEqual([
    expect.objectContaining({
      type: ADD_TOAST,
      payload: expect.objectContaining({
        toastType: ToastType.Warning,
      }),
    }),
  ]);

    })();
  } finally {
    teardownBackendHistory();
    teardownBackendFlag();
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

const activeId = "active-qe";
const makeState = (hideLeftBar: boolean, unsavedOverride?: boolean) => ({
  sqlLab: {
    tabHistory: [activeId],
    queryEditors: [{ id: activeId, hideLeftBar }],
    unsavedQueryEditor:
      unsavedOverride !== undefined
        ? { id: activeId, hideLeftBar: unsavedOverride }
        : {},
  },
});

test("dispatches QUERY_EDITOR_TOGGLE_LEFT_BAR when state differs", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore(makeState(false));
  store.dispatch(actions.toggleLeftBar(true));
  expect(store.getActions()).toEqual([
    {
      type: actions.QUERY_EDITOR_TOGGLE_LEFT_BAR,
      queryEditorId: activeId,
      hideLeftBar: true,
    },
  ]);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not dispatch when state is already the same", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore(makeState(true));
  store.dispatch(actions.toggleLeftBar(true));
  expect(store.getActions()).toHaveLength(0);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("uses unsavedQueryEditor state when available", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  // qe in queryEditors says false, but unsaved override says true
  const store = mockStore(makeState(false, true));
  store.dispatch(actions.toggleLeftBar(true));
  expect(store.getActions()).toHaveLength(0);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test("does not dispatch when there is no active query editor", async () => {
  setupAsyncActions();
  try {
    await (async () => {
  const store = mockStore({
    sqlLab: {
      tabHistory: [],
      queryEditors: [],
      unsavedQueryEditor: {},
    },
  });
  store.dispatch(actions.toggleLeftBar(true));
  expect(store.getActions()).toHaveLength(0);

    })();
  } finally {
    teardownDatasourceRoutes();
    teardownAsyncHistory();
  }
});

test.each(["success", "failed", "timed_out"])(
  "postStopQuery refreshes an already %s query without a toast",
  async (state) => {
    const finishedQuery = { ...queryFixture, id: queryId, state };
    const post = jest.spyOn(SupersetClient, "post").mockRejectedValueOnce({
      status: 422,
      json: async () => ({
        message: "Could not cancel query",
        query: finishedQuery,
      }),
    });
    const store = mockStore(initialState);
    await store.dispatch(
      actions.postStopQuery({ ...queryFixture, id: queryId }),
    );
    expect(store.getActions()).toEqual([
      actions.refreshQueries({ [finishedQuery.id]: finishedQuery }),
    ]);
    post.mockRestore();
  },
);

test("postStopQuery retains the error toast for an unsupported stop", async () => {
  const post = jest.spyOn(SupersetClient, "post").mockRejectedValueOnce({
    status: 422,
    json: async () => ({ message: "Could not cancel query" }),
  });
  const store = mockStore(initialState);
  await store.dispatch(actions.postStopQuery({ ...queryFixture, id: queryId }));
  expect(store.getActions()).toEqual([
    expect.objectContaining({
      type: ADD_TOAST,
      payload: expect.objectContaining({ toastType: ToastType.Danger }),
    }),
  ]);
  post.mockRestore();
});

test("postStopQuery keeps the error toast when a target commit wins before publication", async () => {
  const post = jest.spyOn(SupersetClient, "post").mockRejectedValueOnce({
    status: 422,
    json: async () => ({
      message: "Could not cancel query",
      query: { ...queryFixture, id: queryId, state: "running" },
    }),
  });
  const store = mockStore(initialState);
  await store.dispatch(actions.postStopQuery({ ...queryFixture, id: queryId }));
  expect(store.getActions()).toEqual([
    expect.objectContaining({
      type: ADD_TOAST,
      payload: expect.objectContaining({ toastType: ToastType.Danger }),
    }),
  ]);
  post.mockRestore();
});
