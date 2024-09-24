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
import fetchMock from 'fetch-mock';
import { render, act } from 'spec/helpers/testing-library';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { logging } from '@superset-ui/core';
import EditorAutoSync, { INTERVAL } from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  logging: {
    warn: jest.fn(),
  },
}));

const editorTabLastUpdatedAt = Date.now();
const unsavedSqlLabState = {
  ...initialState.sqlLab,
  unsavedQueryEditor: {
    id: defaultQueryEditor.id,
    name: 'updated tab name',
    updatedAt: editorTabLastUpdatedAt + 100,
  },
  editorTabLastUpdatedAt,
};

beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});

const updateActiveEditorTabState = `glob:*/tabstateview/*/activate`;

beforeEach(() => {
  fetchMock.post(updateActiveEditorTabState, {});
});

afterEach(() => {
  fetchMock.reset();
});

test('sync the unsaved editor tab state when there are new changes since the last update', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, 200);
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: unsavedSqlLabState,
    },
  });
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(1);
  fetchMock.restore();
});

test('sync the unsaved NEW editor state when there are new in local storage', async () => {
  const createEditorTabState = `glob:*/tabstateview/`;
  fetchMock.post(createEditorTabState, { id: 123 });
  expect(fetchMock.calls(createEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        queryEditors: [
          ...initialState.sqlLab.queryEditors,
          {
            id: 'rnd-new-id',
            name: 'new tab name',
            inLocalStorage: true,
          },
        ],
      },
    },
  });
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(createEditorTabState)).toHaveLength(1);
  fetchMock.restore();
});

test('sync the active editor id when there are updates in tab history', async () => {
  expect(fetchMock.calls(updateActiveEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        lastUpdatedActiveTab: 'old-tab-id',
        queryEditors: [
          ...initialState.sqlLab.queryEditors,
          {
            id: 'rnd-new-id12',
            name: 'new tab name',
            inLocalStorage: false,
          },
        ],
        tabHistory: ['old-tab-id', 'rnd-new-id12'],
      },
    },
  });
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(updateActiveEditorTabState)).toHaveLength(1);
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(updateActiveEditorTabState)).toHaveLength(1);
});

test('sync the destroyed editor id when there are updates in destroyed editors', async () => {
  const removeId = 'removed-tab-id';
  const deleteEditorState = `glob:*/tabstateview/${removeId}`;
  fetchMock.delete(deleteEditorState, { id: removeId });
  expect(fetchMock.calls(deleteEditorState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        destroyedQueryEditors: {
          [removeId]: 123,
        },
      },
    },
  });
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(deleteEditorState)).toHaveLength(1);
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(deleteEditorState)).toHaveLength(1);
});

test('skip syncing the unsaved editor tab state when the updates are already synced', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, 200);
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: {
        ...initialState.sqlLab,
        unsavedQueryEditor: {
          id: defaultQueryEditor.id,
          name: 'updated tab name',
          updatedAt: editorTabLastUpdatedAt - 100,
        },
        editorTabLastUpdatedAt,
      },
    },
  });
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  fetchMock.restore();
});

test('renders an error toast when the sync failed', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, {
    throws: new Error('errorMessage'),
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  render(
    <>
      <EditorAutoSync />
      <ToastContainer />
    </>,
    {
      useRedux: true,
      initialState: {
        ...initialState,
        sqlLab: unsavedSqlLabState,
      },
    },
  );
  await act(async () => {
    jest.advanceTimersByTime(INTERVAL);
  });

  expect(logging.warn).toHaveBeenCalledTimes(1);
  expect(logging.warn).toHaveBeenCalledWith(
    'An error occurred while saving your editor state.',
    expect.anything(),
  );
  fetchMock.restore();
});
