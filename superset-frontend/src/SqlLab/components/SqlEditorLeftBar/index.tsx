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
import React, {
  useEffect,
  useCallback,
  useMemo,
  useState,
  Dispatch,
  SetStateAction,
} from 'react';
import { useDispatch } from 'react-redux';
import querystring from 'query-string';

import { Table } from 'src/SqlLab/types';
import {
  queryEditorSetDb,
  addTable,
  removeTables,
  collapseTable,
  expandTable,
  queryEditorSetSchema,
  setDatabases,
  addDangerToast,
  resetState,
} from 'src/SqlLab/actions/sqlLab';
import Button from 'src/components/Button';
import { t, styled, css, SupersetTheme } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import Icons from 'src/components/Icons';
import { TableSelectorMultiple } from 'src/components/TableSelector';
import { IconTooltip } from 'src/components/IconTooltip';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import type { DatabaseObject } from 'src/components/DatabaseSelector';
import { emptyStateComponent } from 'src/components/EmptyState';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import TableElement from '../TableElement';

export interface ExtendedTable extends Table {
  expanded: boolean;
}

interface SqlEditorLeftBarProps {
  queryEditorId: string;
  height?: number;
  tables?: ExtendedTable[];
  database?: DatabaseObject;
  setEmptyState: Dispatch<SetStateAction<boolean>>;
}

const StyledScrollbarContainer = styled.div`
  flex: 1 1 auto;
  overflow: auto;
`;

const collapseStyles = (theme: SupersetTheme) => css`
  .ant-collapse-item {
    margin-bottom: ${theme.gridUnit * 3}px;
  }
  .ant-collapse-header {
    padding: 0px !important;
    display: flex;
    align-items: center;
  }
  .ant-collapse-content-box {
    padding: 0px ${theme.gridUnit * 4}px 0px 0px !important;
  }
  .ant-collapse-arrow {
    padding: 0 !important;
    bottom: ${theme.gridUnit}px !important;
    right: ${theme.gridUnit * 4}px !important;
    color: ${theme.colors.primary.dark1} !important;
    &:hover {
      color: ${theme.colors.primary.dark2} !important;
    }
  }
`;

const LeftBarStyles = styled.div`
  ${({ theme }) => css`
    height: 100%;
    display: flex;
    flex-direction: column;

    .divider {
      border-bottom: 1px solid ${theme.colors.grayscale.light4};
      margin: ${theme.gridUnit * 4}px 0;
    }
  `}
`;

const SqlEditorLeftBar = ({
  database,
  queryEditorId,
  tables = [],
  height = 500,
  setEmptyState,
}: SqlEditorLeftBarProps) => {
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, ['dbId', 'schema']);

  const [emptyResultsWithSearch, setEmptyResultsWithSearch] = useState(false);
  const [userSelectedDb, setUserSelected] = useState<DatabaseObject | null>(
    null,
  );
  const { schema } = queryEditor;

  useEffect(() => {
    const bool = querystring.parse(window.location.search).db;
    const userSelected = getItem(
      LocalStorageKeys.db,
      null,
    ) as DatabaseObject | null;

    if (bool && userSelected) {
      setUserSelected(userSelected);
      setItem(LocalStorageKeys.db, null);
    } else if (database) {
      setUserSelected(database);
    }
  }, [database]);

  const onEmptyResults = (searchText?: string) => {
    setEmptyResultsWithSearch(!!searchText);
  };

  const onDbChange = ({ id: dbId }: { id: number }) => {
    setEmptyState(false);
    dispatch(queryEditorSetDb(queryEditor, dbId));
  };

  const selectedTableNames = useMemo(
    () => tables?.map(table => table.name) || [],
    [tables],
  );

  const onTablesChange = (tableNames: string[], schemaName: string) => {
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
      dispatch(addTable(queryEditor, tableName, schemaName));
    });

    dispatch(removeTables(currentTables));
  };

  const onToggleTable = (updatedTables: string[]) => {
    tables.forEach((table: ExtendedTable) => {
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

  const renderExpandIconWithTooltip = ({ isActive }: { isActive: boolean }) => (
    <IconTooltip
      css={css`
        transform: rotate(90deg);
      `}
      aria-label="Collapse"
      tooltip={
        isActive ? t('Collapse table preview') : t('Expand table preview')
      }
    >
      <Icons.RightOutlined
        iconSize="s"
        css={css`
          transform: ${isActive ? 'rotateY(180deg)' : ''};
        `}
      />
    </IconTooltip>
  );

  const shouldShowReset = window.location.search === '?reset=1';
  const tableMetaDataHeight = height - 130; // 130 is the height of the selects above

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
        emptyState={emptyStateComponent(emptyResultsWithSearch)}
        database={userSelectedDb}
        getDbList={handleDbList}
        handleError={handleError}
        onDbChange={onDbChange}
        onSchemaChange={handleSchemaChange}
        onTableSelectChange={onTablesChange}
        schema={schema}
        tableValue={selectedTableNames}
        sqlLabMode
      />
      <div className="divider" />
      <StyledScrollbarContainer>
        <div
          css={css`
            height: ${tableMetaDataHeight}px;
          `}
        >
          <Collapse
            activeKey={tables
              .filter(({ expanded }) => expanded)
              .map(({ id }) => id)}
            css={collapseStyles}
            expandIconPosition="right"
            ghost
            onChange={onToggleTable}
            expandIcon={renderExpandIconWithTooltip}
          >
            {tables.map(table => (
              <TableElement table={table} key={table.id} />
            ))}
          </Collapse>
        </div>
      </StyledScrollbarContainer>
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
