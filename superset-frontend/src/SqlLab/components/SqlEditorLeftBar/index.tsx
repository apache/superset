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
import { useCallback, useMemo, useState } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

import { SqlLabRootState, Table } from 'src/SqlLab/types';
import {
  addTable,
  removeTables,
  collapseTable,
  expandTable,
  resetState,
} from 'src/SqlLab/actions/sqlLab';
import { Button, EmptyState, Icons } from '@superset-ui/core/components';
import { t } from '@apache-superset/core';
import { styled, css } from '@apache-superset/core/ui';
import { TableSelectorMultiple } from 'src/components/TableSelector';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import TableElement from '../TableElement';
import useDatabaseSelector from '../SqlEditorTopBar/useDatabaseSelector';

export interface SqlEditorLeftBarProps {
  queryEditorId: string;
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

const SqlEditorLeftBar = ({ queryEditorId }: SqlEditorLeftBarProps) => {
  const { db: userSelectedDb, ...dbSelectorProps } =
    useDatabaseSelector(queryEditorId);
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
  const { dbId, schema } = queryEditor;
  const tables = useMemo(
    () =>
      allSelectedTables.filter(
        table => table.dbId === dbId && table.schema === schema,
      ),
    [allSelectedTables, dbId, schema],
  );

  _emptyResultsWithSearch; // This is to avoid unused variable warning, can be removed if not needed

  const onEmptyResults = useCallback((searchText?: string) => {
    setEmptyResultsWithSearch(!!searchText);
  }, []);

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

  const handleResetState = useCallback(() => {
    dispatch(resetState());
  }, [dispatch]);

  return (
    <LeftBarStyles data-test="sql-editor-left-bar">
      <TableSelectorMultiple
        {...dbSelectorProps}
        onEmptyResults={onEmptyResults}
        emptyState={<EmptyState />}
        database={userSelectedDb}
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
