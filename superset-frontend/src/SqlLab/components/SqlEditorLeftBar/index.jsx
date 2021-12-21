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
import PropTypes from 'prop-types';
import Button from 'src/components/Button';
import { t, styled, css } from '@superset-ui/core';
import Collapse from 'src/components/Collapse';
import Icons from 'src/components/Icons';
import TableSelector from 'src/components/TableSelector';
import { IconTooltip } from 'src/components/IconTooltip';
import TableElement from '../TableElement';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.number,
  tables: PropTypes.array,
  actions: PropTypes.object,
  database: PropTypes.object,
  offline: PropTypes.bool,
};

const defaultProps = {
  actions: {},
  height: 500,
  offline: false,
  tables: [],
};

const StyledScrollbarContainer = styled.div`
  flex: 1 1 auto;
  overflow: auto;
`;

const StyledScrollbarContent = styled.div`
  height: ${props => props.contentHeight}px;
`;

export default function SqlEditorLeftBar(props) {
  const onSchemaChange = schema => {
    props.actions.queryEditorSetSchema(props.queryEditor, schema);
  };

  const onSchemasLoad = schemas => {
    props.actions.queryEditorSetSchemaOptions(props.queryEditor, schemas);
  };

  const onTablesLoad = tables => {
    props.actions.queryEditorSetTableOptions(props.queryEditor, tables);
  };

  const onDbChange = db => {
    props.actions.queryEditorSetDb(props.queryEditor, db.id);
    props.actions.queryEditorSetFunctionNames(props.queryEditor, db.id);
  };

  const onTableChange = (tableName, schemaName) => {
    if (tableName && schemaName) {
      props.actions.addTable(props.queryEditor, tableName, schemaName);
    }
  };

  const onToggleTable = tables => {
    props.tables.forEach(table => {
      if (!tables.includes(table.id.toString()) && table.expanded) {
        props.actions.collapseTable(table);
      } else if (tables.includes(table.id.toString()) && !table.expanded) {
        props.actions.expandTable(table);
      }
    });
  };

  const getDbList = dbs => {
    props.actions.setDatabases(dbs);
  };

  const resetState = () => {
    props.actions.resetState();
  };

  const renderExpandIconWithTooltip = ({ isActive }) => (
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
  const tableMetaDataHeight = props.height - 130; // 130 is the height of the selects above
  const qe = props.queryEditor;

  return (
    <div className="SqlEditorLeftBar">
      <TableSelector
        database={props.database}
        dbId={qe.dbId}
        getDbList={() => getDbList}
        handleError={props.actions.addDangerToast}
        onDbChange={onDbChange}
        onSchemaChange={onSchemaChange}
        onSchemasLoad={() => onSchemasLoad}
        onTableChange={onTableChange}
        onTablesLoad={() => onTablesLoad}
        schema={qe.schema}
        sqlLabMode
      />
      <div className="divider" />
      <StyledScrollbarContainer>
        <StyledScrollbarContent contentHeight={tableMetaDataHeight}>
          <Collapse
            activeKey={props.tables
              .filter(({ expanded }) => expanded)
              .map(({ id }) => id)}
            css={theme => css`
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
            `}
            expandIconPosition="right"
            ghost
            onChange={onToggleTable}
            expandIcon={renderExpandIconWithTooltip}
          >
            {props.tables.map(table => (
              <TableElement
                table={table}
                key={table.id}
                actions={props.actions}
              />
            ))}
          </Collapse>
        </StyledScrollbarContent>
      </StyledScrollbarContainer>
      {shouldShowReset && (
        <Button buttonSize="small" buttonStyle="danger" onClick={resetState}>
          <i className="fa fa-bomb" /> {t('Reset state')}
        </Button>
      )}
    </div>
  );
}

SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;
