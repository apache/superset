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
import { useEffect, useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { SqlLabRootState } from 'src/SqlLab/types';
import {
  queryEditorSetDb,
  queryEditorSetCatalog,
  queryEditorSetSchema,
  setDatabases,
  addDangerToast,
  type Database,
} from 'src/SqlLab/actions/sqlLab';
import { type DatabaseObject } from 'src/components';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';

export default function useDatabaseSelector(queryEditorId: string) {
  const databases = useSelector<
    SqlLabRootState,
    SqlLabRootState['sqlLab']['databases']
  >(({ sqlLab }) => sqlLab.databases);
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'catalog',
    'schema',
    'tabViewId',
  ]);
  const database = useMemo(
    () => (queryEditor.dbId ? databases[queryEditor.dbId] : undefined),
    [databases, queryEditor.dbId],
  );
  const [userSelectedDb, setUserSelected] = useState<DatabaseObject | null>(
    null,
  );
  const { catalog, schema } = queryEditor;

  const onDbChange = useCallback(
    ({ id: dbId }: { id: number }) => {
      if (queryEditor) {
        dispatch(queryEditorSetDb(queryEditor, dbId));
      }
    },
    [dispatch, queryEditor],
  );

  const handleCatalogChange = useCallback(
    (catalog?: string | null) => {
      if (queryEditor) {
        dispatch(queryEditorSetCatalog(queryEditor, catalog ?? null));
      }
    },
    [dispatch, queryEditor],
  );

  const handleSchemaChange = useCallback(
    (schema: string) => {
      if (queryEditor) {
        dispatch(queryEditorSetSchema(queryEditor, schema));
      }
    },
    [dispatch, queryEditor],
  );

  const handleDbList = useCallback(
    (result: DatabaseObject[]) => {
      dispatch(setDatabases(result as unknown as Database[]));
    },
    [dispatch],
  );

  const handleError = useCallback(
    (message: string) => {
      dispatch(addDangerToast(message));
    },
    [dispatch],
  );

  useEffect(() => {
    const bool = new URLSearchParams(window.location.search).get('db');
    const userSelected = getItem(
      LocalStorageKeys.Database,
      null,
    ) as DatabaseObject | null;

    if (bool && userSelected) {
      setUserSelected(userSelected);
      setItem(LocalStorageKeys.Database, null);
    } else if (database) {
      setUserSelected(database);
    }
  }, [database]);

  return {
    db: userSelectedDb,
    catalog,
    schema,
    getDbList: handleDbList,
    handleError,
    onDbChange,
    onCatalogChange: handleCatalogChange,
    onSchemaChange: handleSchemaChange,
  };
}
