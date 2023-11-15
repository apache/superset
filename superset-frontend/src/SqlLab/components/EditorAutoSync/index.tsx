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

import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logging } from '@superset-ui/core';
import {
  SqlLabRootState,
  QueryEditor,
  UnsavedQueryEditor,
} from 'src/SqlLab/types';
import { useUpdateSqlEditorTabMutation } from 'src/hooks/apiResources/sqlEditorTabs';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import { setEditorTabLastUpdate } from 'src/SqlLab/actions/sqlLab';

const INTERVAL = 5000;

function hasUnsavedChanges(
  queryEditor: QueryEditor,
  lastSavedTimestamp: number,
) {
  return (
    queryEditor.inLocalStorage ||
    (queryEditor.updatedAt && queryEditor.updatedAt > lastSavedTimestamp)
  );
}

export function filterUnsavedQueryEditorList(
  queryEditors: QueryEditor[],
  unsavedQueryEditor: UnsavedQueryEditor,
  lastSavedTimestamp: number,
) {
  return queryEditors
    .map(queryEditor => ({
      ...queryEditor,
      ...(unsavedQueryEditor.id === queryEditor.id && unsavedQueryEditor),
    }))
    .filter(queryEditor => hasUnsavedChanges(queryEditor, lastSavedTimestamp));
}

const EditorAutoSync: React.FC = () => {
  const queryEditors = useSelector<SqlLabRootState, QueryEditor[]>(
    state => state.sqlLab.queryEditors,
  );
  const unsavedQueryEditor = useSelector<SqlLabRootState, UnsavedQueryEditor>(
    state => state.sqlLab.unsavedQueryEditor,
  );
  const editorTabLastUpdatedAt = useSelector<SqlLabRootState, number>(
    state => state.sqlLab.editorTabLastUpdatedAt,
  );
  const dispatch = useDispatch();
  const lastSavedTimestampRef = useRef<number>(editorTabLastUpdatedAt);
  const [updateSqlEditor, { error }] = useUpdateSqlEditorTabMutation();

  const debouncedUnsavedQueryEditor = useDebounceValue(
    unsavedQueryEditor,
    INTERVAL,
  );

  useEffect(() => {
    const unsaved = filterUnsavedQueryEditorList(
      queryEditors,
      debouncedUnsavedQueryEditor,
      lastSavedTimestampRef.current,
    );

    Promise.all(
      unsaved
        // TODO: Migrate migrateQueryEditorFromLocalStorage
        //       in TabbedSqlEditors logic by addSqlEditor mutation later
        .filter(({ inLocalStorage }) => !inLocalStorage)
        .map(queryEditor => updateSqlEditor({ queryEditor })),
    ).then(resolvers => {
      if (!resolvers.some(result => 'error' in result)) {
        lastSavedTimestampRef.current = Date.now();
        dispatch(setEditorTabLastUpdate(lastSavedTimestampRef.current));
      }
    });
  }, [debouncedUnsavedQueryEditor, dispatch, queryEditors, updateSqlEditor]);

  useEffect(() => {
    if (error) {
      logging.warn('An error occurred while saving your editor state.', error);
    }
  }, [dispatch, error]);

  return null;
};

export default EditorAutoSync;
