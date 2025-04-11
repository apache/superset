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

import { useRef, useEffect, FC } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { logging } from '@superset-ui/core';
import {
  SqlLabRootState,
  QueryEditor,
  UnsavedQueryEditor,
} from 'src/SqlLab/types';
import {
  useUpdateCurrentSqlEditorTabMutation,
  useUpdateSqlEditorTabMutation,
  useDeleteSqlEditorTabMutation,
} from 'src/hooks/apiResources/sqlEditorTabs';
import { useDebounceValue } from 'src/hooks/useDebounceValue';
import {
  syncQueryEditor,
  setEditorTabLastUpdate,
  setLastUpdatedActiveTab,
  clearDestoryedQueryEditor,
} from 'src/SqlLab/actions/sqlLab';
import useEffectEvent from 'src/hooks/useEffectEvent';

export const INTERVAL = 5000;

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

const EditorAutoSync: FC = () => {
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

  const currentQueryEditorId = useSelector<SqlLabRootState, string>(
    ({ sqlLab }) => sqlLab.tabHistory.slice(-1)[0] || '',
  );
  const lastUpdatedActiveTab = useSelector<SqlLabRootState, string>(
    ({ sqlLab }) => sqlLab.lastUpdatedActiveTab,
  );
  const destroyedQueryEditors = useSelector<
    SqlLabRootState,
    Record<string, number>
  >(({ sqlLab }) => sqlLab.destroyedQueryEditors);
  const [updateSqlEditor, { error }] = useUpdateSqlEditorTabMutation();
  const [updateCurrentSqlEditor] = useUpdateCurrentSqlEditorTabMutation();
  const [deleteSqlEditor] = useDeleteSqlEditorTabMutation();

  const debouncedUnsavedQueryEditor = useDebounceValue(
    unsavedQueryEditor,
    INTERVAL,
  );

  const getUnsavedItems = useEffectEvent(unsavedQE =>
    filterUnsavedQueryEditorList(
      queryEditors,
      unsavedQE,
      lastSavedTimestampRef.current,
    ),
  );

  const getUnsavedNewQueryEditor = useEffectEvent(() =>
    filterUnsavedQueryEditorList(
      queryEditors,
      unsavedQueryEditor,
      lastSavedTimestampRef.current,
    ).find(({ inLocalStorage }) => Boolean(inLocalStorage)),
  );

  const syncCurrentQueryEditor = useEffectEvent(() => {
    if (
      currentQueryEditorId &&
      currentQueryEditorId !== lastUpdatedActiveTab &&
      !queryEditors.find(({ id }) => id === currentQueryEditorId)
        ?.inLocalStorage
    ) {
      updateCurrentSqlEditor(currentQueryEditorId).then(() => {
        dispatch(setLastUpdatedActiveTab(currentQueryEditorId));
      });
    }
  });

  const syncDeletedQueryEditor = useEffectEvent(() => {
    if (Object.keys(destroyedQueryEditors).length > 0) {
      Object.keys(destroyedQueryEditors).forEach(id => {
        deleteSqlEditor(id)
          .then(() => {
            dispatch(clearDestoryedQueryEditor(id));
          })
          .catch(({ status }) => {
            if (status === 404) {
              dispatch(clearDestoryedQueryEditor(id));
            }
          });
      });
    }
  });

  useEffect(() => {
    let saveTimer: NodeJS.Timeout;
    function saveUnsavedQueryEditor() {
      const firstUnsavedQueryEditor = getUnsavedNewQueryEditor();

      if (firstUnsavedQueryEditor) {
        dispatch(syncQueryEditor(firstUnsavedQueryEditor));
      }
      saveTimer = setTimeout(saveUnsavedQueryEditor, INTERVAL);
    }
    const syncTimer = setInterval(syncCurrentQueryEditor, INTERVAL);
    saveTimer = setTimeout(saveUnsavedQueryEditor, INTERVAL);
    const clearQueryEditorTimer = setInterval(syncDeletedQueryEditor, INTERVAL);
    return () => {
      clearTimeout(saveTimer);
      clearInterval(syncTimer);
      clearInterval(clearQueryEditorTimer);
    };
  }, [
    getUnsavedNewQueryEditor,
    syncCurrentQueryEditor,
    syncDeletedQueryEditor,
    dispatch,
  ]);

  useEffect(() => {
    const unsaved = getUnsavedItems(debouncedUnsavedQueryEditor);

    Promise.all(
      unsaved
        .filter(({ inLocalStorage }) => !inLocalStorage)
        .map(queryEditor => updateSqlEditor({ queryEditor })),
    ).then(resolvers => {
      if (!resolvers.some(result => 'error' in result)) {
        lastSavedTimestampRef.current = Date.now();
        dispatch(setEditorTabLastUpdate(lastSavedTimestampRef.current));
      }
    });
  }, [debouncedUnsavedQueryEditor, getUnsavedItems, dispatch, updateSqlEditor]);

  useEffect(() => {
    if (error) {
      logging.warn('An error occurred while saving your editor state.', error);
    }
  }, [dispatch, error]);

  return null;
};

export default EditorAutoSync;
