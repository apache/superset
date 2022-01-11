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

export default class SqlEditorLeftBar extends React.PureComponent {
  constructor(props) {
    super(props);
    this.resetState = this.resetState.bind(this);
    this.onSchemaChange = this.onSchemaChange.bind(this);
    this.onSchemasLoad = this.onSchemasLoad.bind(this);
    this.onTablesLoad = this.onTablesLoad.bind(this);
    this.onDbChange = this.onDbChange.bind(this);
    this.getDbList = this.getDbList.bind(this);
    this.onTableChange = this.onTableChange.bind(this);
    this.onToggleTable = this.onToggleTable.bind(this);
  }

  onSchemaChange(schema) {
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, schema);
  }

  onSchemasLoad(schemas) {
    this.props.actions.queryEditorSetSchemaOptions(
      this.props.queryEditor,
      schemas,
    );
  }

  onTablesLoad(tables) {
    this.props.actions.queryEditorSetTableOptions(
      this.props.queryEditor,
      tables,
    );
  }

  onDbChange(db) {
    this.props.actions.queryEditorSetDb(this.props.queryEditor, db.id);
    this.props.actions.queryEditorSetFunctionNames(
      this.props.queryEditor,
      db.id,
    );
  }

  onTableChange(tableName, schemaName) {
    if (tableName && schemaName) {
      this.props.actions.addTable(
        this.props.queryEditor,
        tableName,
        schemaName,
      );
    }
  }

  onToggleTable(tables) {
    this.props.tables.forEach(table => {
      if (!tables.includes(table.id.toString()) && table.expanded) {
        this.props.actions.collapseTable(table);
      } else if (tables.includes(table.id.toString()) && !table.expanded) {
        this.props.actions.expandTable(table);
      }
    });
  }

  getDbList(dbs) {
    this.props.actions.setDatabases(dbs);
  }

  dbMutator(data) {
    const options = data.result.map(db => ({
      value: db.id,
      label: db.database_name,
    }));
    this.props.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      this.props.actions.addDangerToast(
        t("It seems you don't have access to any database"),
      );
    }
    return options;
  }

  resetState() {
    this.props.actions.resetState();
  }

  changeTable(tableOpt) {
    if (!tableOpt) {
      return;
    }
    const schemaName = tableOpt.value.schema;
    const tableName = tableOpt.value.table;
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, schemaName);
    this.props.actions.addTable(this.props.queryEditor, tableName, schemaName);
  }

  renderExpandIconWithTooltip = ({ isActive }) => (
    <IconTooltip
      css={css`
        transform: rotate(90deg);
      `}
      aria-label="Collapse"
      tooltip={t(`${isActive ? 'Collapse' : 'Expand'} table preview`)}
    >
      <Icons.RightOutlined
        iconSize="s"
        css={css`
          transform: ${isActive ? 'rotateY(180deg)' : ''};
        `}
      />
    </IconTooltip>
  );

  render() {
    const shouldShowReset = window.location.search === '?reset=1';
    const tableMetaDataHeight = this.props.height - 130; // 130 is the height of the selects above
    const qe = this.props.queryEditor;
    return (
      <div className="SqlEditorLeftBar">
        <TableSelector
          database={this.props.database}
          dbId={qe.dbId}
          getDbList={this.getDbList}
          handleError={this.props.actions.addDangerToast}
          onDbChange={this.onDbChange}
          onSchemaChange={this.onSchemaChange}
          onSchemasLoad={this.onSchemasLoad}
          onTableChange={this.onTableChange}
          onTablesLoad={this.onTablesLoad}
          schema={qe.schema}
          sqlLabMode
        />
        <div className="divider" />
        <StyledScrollbarContainer>
          <StyledScrollbarContent contentHeight={tableMetaDataHeight}>
            <Collapse
              activeKey={this.props.tables
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
              onChange={this.onToggleTable}
              expandIcon={this.renderExpandIconWithTooltip}
            >
              {this.props.tables.map(table => (
                <TableElement
                  table={table}
                  key={table.id}
                  actions={this.props.actions}
                />
              ))}
            </Collapse>
          </StyledScrollbarContent>
        </StyledScrollbarContainer>
        {shouldShowReset && (
          <Button
            buttonSize="small"
            buttonStyle="danger"
            onClick={this.resetState}
          >
            <i className="fa fa-bomb" /> {t('Reset state')}
          </Button>
        )}
      </div>
    );
  }
}

SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;
