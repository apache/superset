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
import React from 'react';
import fetchMock from 'fetch-mock';
import * as uiCore from '@superset-ui/core';
import { render, act } from 'spec/helpers/testing-library';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import EditorAutoSync from '.';

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

test('sync the unsaved editor tab state when there are new changes since the last update', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, 200);
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(
      featureFlag =>
        featureFlag === uiCore.FeatureFlag.SQLLAB_BACKEND_PERSISTENCE,
    );
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: unsavedSqlLabState,
    },
  });
  await act(async () => {
    jest.runAllTimers();
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(1);
  isFeatureEnabledMock.mockClear();
  fetchMock.restore();
});

test('skip syncing the unsaved editor tab state when the updates are already synced', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, 200);
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(
      featureFlag =>
        featureFlag === uiCore.FeatureFlag.SQLLAB_BACKEND_PERSISTENCE,
    );
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
    jest.runAllTimers();
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  isFeatureEnabledMock.mockClear();
  fetchMock.restore();
});

test('renders an error toast when the sync failed', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, {
    throws: new Error('errorMessage'),
  });
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(
      featureFlag =>
        featureFlag === uiCore.FeatureFlag.SQLLAB_BACKEND_PERSISTENCE,
    );
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  const { findByText } = render(
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
    jest.runAllTimers();
  });
  const errorToast = await findByText(
    'An error occurred while saving your editor state. ' +
      'Please contact your administrator if this problem persists.',
  );
  expect(errorToast).toBeTruthy();
  isFeatureEnabledMock.mockClear();
  fetchMock.restore();
});

test('skip syncing the unsaved editor tab stat when SQLLAB_BACKEND_PERSISTENCE is off', async () => {
  const updateEditorTabState = `glob:*/tabstateview/${defaultQueryEditor.id}`;
  fetchMock.put(updateEditorTabState, 200);
  const isFeatureEnabledMock = jest
    .spyOn(uiCore, 'isFeatureEnabled')
    .mockImplementation(
      featureFlag =>
        featureFlag !== uiCore.FeatureFlag.SQLLAB_BACKEND_PERSISTENCE,
    );
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  render(<EditorAutoSync />, {
    useRedux: true,
    initialState: {
      ...initialState,
      sqlLab: unsavedSqlLabState,
    },
  });
  await act(async () => {
    jest.runAllTimers();
  });
  expect(fetchMock.calls(updateEditorTabState)).toHaveLength(0);
  isFeatureEnabledMock.mockClear();
  fetchMock.restore();
});
