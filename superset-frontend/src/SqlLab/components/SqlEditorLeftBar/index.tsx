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
import React, { useEffect, useRef, useCallback } from 'react';
import Button from 'src/components/Button';
import { t, styled, css, SupersetTheme } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import Icons from 'src/components/Icons';
import TableSelector from 'src/components/TableSelector';
import { IconTooltip } from 'src/components/IconTooltip';
import { QueryEditor } from 'src/SqlLab/types';
import { DatabaseObject } from 'src/components/DatabaseSelector';
import TableElement, { Table, TableElementProps } from '../TableElement';

interface ExtendedTable extends Table {
  expanded: boolean;
}

interface actionsTypes {
  queryEditorSetDb: (queryEditor: QueryEditor, dbId: number) => void;
  queryEditorSetFunctionNames: (queryEditor: QueryEditor, dbId: number) => void;
  collapseTable: (table: Table) => void;
  expandTable: (table: Table) => void;
  addTable: (queryEditor: any, database: any, value: any, schema: any) => void;
  setDatabases: (arg0: any) => {};
  addDangerToast: (msg: string) => void;
  queryEditorSetSchema: (queryEditor: QueryEditor, schema?: string) => void;
  queryEditorSetSchemaOptions: () => void;
  queryEditorSetTableOptions: (
    queryEditor: QueryEditor,
    options: Array<any>,
  ) => void;
  resetState: () => void;
}

interface SqlEditorLeftBarProps {
  queryEditor: QueryEditor;
  height?: number;
  tables?: ExtendedTable[];
  actions: actionsTypes & TableElementProps['actions'];
  database: DatabaseObject;
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
    top: ${theme.gridUnit * 2}px !important;
    color: ${theme.colors.primary.dark1} !important;
    &: hover {
      color: ${theme.colors.primary.dark2} !important;
    }
  }
`;

export default function SqlEditorLeftBar({
  actions,
  database,
  queryEditor,
  tables = [],
  height = 500,
}: SqlEditorLeftBarProps) {
  // Ref needed to avoid infinite rerenders on handlers
  // that require and modify the queryEditor
  const queryEditorRef = useRef<QueryEditor>(queryEditor);
  useEffect(() => {
    queryEditorRef.current = queryEditor;
  }, [queryEditor]);

  const onDbChange = ({ id: dbId }: { id: number }) => {
    actions.queryEditorSetDb(queryEditor, dbId);
    actions.queryEditorSetFunctionNames(queryEditor, dbId);
  };

  const onTableChange = (tableName: string, schemaName: string) => {
    if (tableName && schemaName) {
      actions.addTable(queryEditor, database, tableName, schemaName);
    }
  };

  const onToggleTable = (updatedTables: string[]) => {
    tables.forEach((table: ExtendedTable) => {
      if (!updatedTables.includes(table.id.toString()) && table.expanded) {
        actions.collapseTable(table);
      } else if (
        updatedTables.includes(table.id.toString()) &&
        !table.expanded
      ) {
        actions.expandTable(table);
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
      if (queryEditorRef.current) {
        actions.queryEditorSetSchema(queryEditorRef.current, schema);
      }
    },
    [actions],
  );

  const handleTablesLoad = React.useCallback(
    (options: Array<any>) => {
      if (queryEditorRef.current) {
        actions.queryEditorSetTableOptions(queryEditorRef.current, options);
      }
    },
    [actions],
  );

  return (
    <div className="SqlEditorLeftBar">
      <TableSelector
        database={database}
        getDbList={actions.setDatabases}
        handleError={actions.addDangerToast}
        onDbChange={onDbChange}
        onSchemaChange={handleSchemaChange}
        onSchemasLoad={actions.queryEditorSetSchemaOptions}
        onTableChange={onTableChange}
        onTablesLoad={handleTablesLoad}
        schema={queryEditor.schema}
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
              <TableElement table={table} key={table.id} actions={actions} />
            ))}
          </Collapse>
        </div>
      </StyledScrollbarContainer>
      {shouldShowReset && (
        <Button
          buttonSize="small"
          buttonStyle="danger"
          onClick={actions.resetState}
        >
          <i className="fa fa-bomb" /> {t('Reset state')}
        </Button>
      )}
    </div>
  );
}
