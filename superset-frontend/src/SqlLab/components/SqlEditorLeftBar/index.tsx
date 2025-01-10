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
import { useEffect, useCallback, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import querystring from 'query-string';

import { SqlLabRootState } from 'src/SqlLab/types';
import {
  queryEditorSetDb,
  queryEditorSetCatalog,
  setDatabases,
  addDangerToast,
  resetState,
} from 'src/SqlLab/actions/sqlLab';
import Button from 'src/components/Button';
import { t, styled, css, useTheme } from '@superset-ui/core';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import type { DatabaseObject } from 'src/components/DatabaseSelector';
import { emptyStateComponent } from 'src/components/EmptyState';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import DatabaseSelector from 'src/components/DatabaseSelector';
import TableExploreTree from '../TableExploreTree';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
}

const LeftBarStyles = styled.div`
  ${({ theme }) => css`
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    & .ant-tree .ant-tree-node-content-wrapper {
      word-break: break-all;
    }
    & .ant-tree .ant-tree-node {
      position: relative;
    }
    & .highlighted {
      background-color: ${theme.colors.alert.light1};
    }
  `}
`;

const SqlEditorLeftBar = ({ queryEditorId }: SqlEditorLeftBarProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'catalog',
    'schema',
  ]);
  const database = useSelector<SqlLabRootState, DatabaseObject>(
    ({ sqlLab: { unsavedQueryEditor, databases } }) => {
      let { dbId } = queryEditor;
      if (unsavedQueryEditor?.id === queryEditor.id) {
        dbId = unsavedQueryEditor.dbId || dbId;
      }
      return databases[dbId || ''];
    },
    shallowEqual,
  );

  const [emptyResultsWithSearch, setEmptyResultsWithSearch] = useState(false);
  const [userSelectedDb, setUserSelected] = useState<DatabaseObject | null>(
    database,
  );

  useEffect(() => {
    const bool = querystring.parse(window.location.search).db;
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

  const onEmptyResults = useCallback((searchText?: string) => {
    setEmptyResultsWithSearch(!!searchText);
  }, []);

  const onDbChange = ({ id: dbId }: { id: number }) => {
    dispatch(queryEditorSetDb(queryEditor, dbId));
  };

  const shouldShowReset = window.location.search === '?reset=1';

  const handleCatalogChange = useCallback(
    (catalog?: string | null) => {
      if (queryEditor) {
        dispatch(queryEditorSetCatalog(queryEditor, catalog));
      }
    },
    [dispatch, queryEditor],
  );

  const handleDbList = useCallback(
    (result: DatabaseObject) => {
      dispatch(setDatabases(result));
    },
    [dispatch],
  );

  const handleError = useCallback(
    (message: string) => {
      dispatch(addDangerToast(message));
    },
    [dispatch],
  );

  const handleResetState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  return (
    <LeftBarStyles data-test="sql-editor-left-bar">
      <DatabaseSelector
        db={userSelectedDb}
        getDbList={handleDbList}
        catalog={queryEditor?.catalog}
        onEmptyResults={onEmptyResults}
        emptyState={emptyStateComponent(emptyResultsWithSearch)}
        handleError={handleError}
        onDbChange={onDbChange}
        onCatalogChange={handleCatalogChange}
        sqlLabMode
      />
      <hr
        css={css`
          margin-top: 0px;
          border-bottom: 1px solid ${theme.colors.grayscale.light4};
        `}
      />
      <TableExploreTree queryEditorId={queryEditorId} />
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleResetState}
        >
          <i className="fa fa-bomb" /> {t('Reset state')}
        </Button>
      )}
    </LeftBarStyles>
  );
};

export default SqlEditorLeftBar;
