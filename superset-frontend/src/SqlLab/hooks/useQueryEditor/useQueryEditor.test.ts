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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { initialState, defaultQueryEditor } from 'src/SqlLab/fixtures';
import { renderHook } from '@testing-library/react-hooks';
import { createWrapper } from 'spec/helpers/testing-library';

import useQueryEditor from '.';

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

test('returns selected queryEditor values', () => {
  const { result } = renderHook(
    () =>
      useQueryEditor(defaultQueryEditor.id, ['id', 'name', 'dbId', 'schema']),
    {
      wrapper: createWrapper({
        useRedux: true,
        store: mockStore(initialState),
      }),
    },
  );
  expect(result.current).toEqual({
    id: defaultQueryEditor.id,
    name: defaultQueryEditor.name,
    dbId: defaultQueryEditor.dbId,
    schema: defaultQueryEditor.schema,
  });
});

test('includes id implicitly', () => {
  const { result } = renderHook(
    () => useQueryEditor(defaultQueryEditor.id, ['name']),
    {
      wrapper: createWrapper({
        useRedux: true,
        store: mockStore(initialState),
      }),
    },
  );
  expect(result.current).toEqual({
    id: defaultQueryEditor.id,
    name: defaultQueryEditor.name,
  });
});

test('returns updated values from unsaved change', () => {
  const expectedSql = 'SELECT updated_column\nFROM updated_table\nWHERE';
  const { result } = renderHook(
    () => useQueryEditor(defaultQueryEditor.id, ['id', 'sql']),
    {
      wrapper: createWrapper({
        useRedux: true,
        store: mockStore({
          ...initialState,
          sqlLab: {
            ...initialState.sqlLab,
            unsavedQueryEditor: {
              id: defaultQueryEditor.id,
              sql: expectedSql,
            },
          },
        }),
      }),
    },
  );
  expect(result.current.id).toEqual(defaultQueryEditor.id);
  expect(result.current.sql).toEqual(expectedSql);
});
