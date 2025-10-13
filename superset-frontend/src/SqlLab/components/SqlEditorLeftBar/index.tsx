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
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { SqlLabRootState, Table } from 'src/SqlLab/types';
import {
  queryEditorSetDb,
  addTable,
  removeTables,
  collapseTable,
  expandTable,
  queryEditorSetCatalog,
  queryEditorSetSchema,
  setDatabases,
  addDangerToast,
  resetState,
} from 'src/SqlLab/actions/sqlLab';
import { Button, EmptyState, Icons } from '@superset-ui/core/components';
import { type DatabaseObject } from 'src/components';
import { t, styled, css } from '@superset-ui/core';
import { TableSelectorMultiple } from 'src/components/TableSelector';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { noop } from 'lodash';
import TableElement from '../TableElement';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
  database?: DatabaseObject;
}

const StyledScrollbarContainer = styled.div`
  flex: 1 1 auto;
  overflow: auto;
`;

const LeftBarStyles = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;

    .divider {
      border-bottom: 1px solid ${theme.colorSplit};
      margin: ${theme.sizeUnit * 4}px 0;
    }
  `}
`;

const SqlEditorLeftBar = ({
  database,
  queryEditorId,
}: SqlEditorLeftBarProps) => {
  const allSelectedTables = useSelector<SqlLabRootState, Table[]>(
    ({ sqlLab }) =>
      sqlLab.tables.filter(table => table.queryEditorId === queryEditorId),
    shallowEqual,
  );
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'catalog',
    'schema',
    'tabViewId',
  ]);

  const [_emptyResultsWithSearch, setEmptyResultsWithSearch] = useState(false);
  const [userSelectedDb, setUserSelected] = useState<DatabaseObject | null>(
    null,
  );
  const { dbId, catalog, schema } = queryEditor;
  const tables = useMemo(
    () =>
      allSelectedTables.filter(
        table => table.dbId === dbId && table.schema === schema,
      ),
    [allSelectedTables, dbId, schema],
  );

  noop(_emptyResultsWithSearch); // This is to avoid unused variable warning, can be removed if not needed

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

  const onEmptyResults = useCallback((searchText?: string) => {
    setEmptyResultsWithSearch(!!searchText);
  }, []);

  const onDbChange = ({ id: dbId }: { id: number }) => {
    dispatch(queryEditorSetDb(queryEditor, dbId));
  };

  const selectedTableNames = useMemo(
    () => tables?.map(table => table.name) || [],
    [tables],
  );

  const onTablesChange = (
    tableNames: string[],
    catalogName: string | null,
    schemaName: string,
  ) => {
    if (!schemaName) {
      return;
    }

    const currentTables = [...tables];
    const tablesToAdd = tableNames.filter(name => {
      const index = currentTables.findIndex(table => table.name === name);
      if (index >= 0) {
        currentTables.splice(index, 1);
        return false;
      }

      return true;
    });

    tablesToAdd.forEach(tableName => {
      dispatch(addTable(queryEditor, tableName, catalogName, schemaName));
    });

    dispatch(removeTables(currentTables));
  };

  const onToggleTable = (updatedTables: string[]) => {
    tables.forEach(table => {
      if (!updatedTables.includes(table.id.toString()) && table.expanded) {
        dispatch(collapseTable(table));
      } else if (
        updatedTables.includes(table.id.toString()) &&
        !table.expanded
      ) {
        dispatch(expandTable(table));
      }
    });
  };

  const shouldShowReset = window.location.search === '?reset=1';

  const handleCatalogChange = useCallback(
    (catalog: string | null) => {
      if (queryEditor) {
        dispatch(queryEditorSetCatalog(queryEditor, catalog));
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
      <TableSelectorMultiple
        onEmptyResults={onEmptyResults}
        emptyState={<EmptyState />}
        database={userSelectedDb}
        getDbList={handleDbList}
        handleError={handleError}
        onDbChange={onDbChange}
        onCatalogChange={handleCatalogChange}
        catalog={catalog}
        onSchemaChange={handleSchemaChange}
        schema={schema}
        onTableSelectChange={onTablesChange}
        tableValue={selectedTableNames}
        sqlLabMode
      />
      <div className="divider" />
      <StyledScrollbarContainer>
        {tables.map(table => (
          <TableElement
            table={table}
            key={table.id}
            activeKey={tables
              .filter(({ expanded }) => expanded)
              .map(({ id }) => id)}
            onChange={onToggleTable}
          />
        ))}
      </StyledScrollbarContainer>
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={handleResetState}
        >
          <Icons.ClearOutlined /> {t('Reset state')}
        </Button>
      )}
    </LeftBarStyles>
  );
};

export default SqlEditorLeftBar;
