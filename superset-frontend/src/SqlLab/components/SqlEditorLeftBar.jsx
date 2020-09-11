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
import { t } from '@superset-ui/core';
import TableElement from './TableElement';
import TableSelector from '../../components/TableSelector';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.number.isRequired,
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
  }
  onTableChange(tableName, schemaName) {
    this.props.actions.addTable(this.props.queryEditor, tableName, schemaName);
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

  closePopover(ref) {
    this.refs[ref].hide();
  }
  render() {
    const shouldShowReset = window.location.search === '?reset=1';
    const tableMetaDataHeight = this.props.height - 130; // 130 is the height of the selects above
    const qe = this.props.queryEditor;
    return (
      <div className="SqlEditorLeftBar">
        <TableSelector
          dbId={qe.dbId}
          schema={qe.schema}
          onDbChange={this.onDbChange}
          onSchemaChange={this.onSchemaChange}
          onSchemasLoad={this.onSchemasLoad}
          onTablesLoad={this.onTablesLoad}
          getDbList={this.getDbList}
          onTableChange={this.onTableChange}
          tableNameSticky={false}
          database={this.props.database}
          handleError={this.props.actions.addDangerToast}
        />
        <div className="divider" />
        <div className="scrollbar-container">
          <div
            className="scrollbar-content"
            style={{ height: tableMetaDataHeight }}
          >
            {this.props.tables.map(table => (
              <TableElement
                table={table}
                key={table.id}
                actions={this.props.actions}
              />
            ))}
          </div>
        </div>
        {shouldShowReset && (
          <Button
            buttonSize="small"
            buttonStyle="danger"
            onClick={this.resetState}
          >
            <i className="fa fa-bomb" /> {t('Reset State')}
          </Button>
        )}
      </div>
    );
  }
}

SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;
