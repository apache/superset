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
import Select from 'src/components/Select';
import { ControlLabel, Label } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import AsyncSelect from './AsyncSelect';
import RefreshLabel from './RefreshLabel';
import './TableSelector.less';

const propTypes = {
  dbId: PropTypes.number.isRequired,
  schema: PropTypes.string,
  onSchemaChange: PropTypes.func,
  onDbChange: PropTypes.func,
  onSchemasLoad: PropTypes.func,
  onTablesLoad: PropTypes.func,
  getDbList: PropTypes.func,
  onTableChange: PropTypes.func,
  tableNameSticky: PropTypes.bool,
  tableName: PropTypes.string,
  database: PropTypes.object,
  sqlLabMode: PropTypes.bool,
  onChange: PropTypes.func,
  clearable: PropTypes.bool,
  handleError: PropTypes.func.isRequired,
};

const defaultProps = {
  onDbChange: () => {},
  onSchemaChange: () => {},
  onSchemasLoad: () => {},
  onTablesLoad: () => {},
  getDbList: () => {},
  onTableChange: () => {},
  onChange: () => {},
  tableNameSticky: true,
  sqlLabMode: true,
  clearable: true,
};

export default class TableSelector extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      schemaLoading: false,
      schemaOptions: [],
      tableLoading: false,
      tableOptions: [],
      dbId: props.dbId,
      schema: props.schema,
      tableName: props.tableName,
    };
    this.changeSchema = this.changeSchema.bind(this);
    this.changeTable = this.changeTable.bind(this);
    this.dbMutator = this.dbMutator.bind(this);
    this.getTableNamesBySubStr = this.getTableNamesBySubStr.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onDatabaseChange = this.onDatabaseChange.bind(this);
  }
  componentDidMount() {
    this.fetchSchemas(this.state.dbId);
    this.fetchTables();
  }
  onDatabaseChange(db, force = false) {
    const dbId = db ? db.id : null;
    this.setState({ schemaOptions: [] });
    this.props.onSchemaChange(null);
    this.props.onDbChange(db);
    this.fetchSchemas(dbId, force);
    this.setState({ dbId, schema: null, tableOptions: [] }, this.onChange);
  }
  onChange() {
    this.props.onChange({
      dbId: this.state.dbId,
      schema: this.state.schema,
      tableName: this.state.tableName,
    });
  }
  getTableNamesBySubStr(input) {
    if (!this.props.dbId || !input) {
      const options = [];
      return Promise.resolve({ options });
    }
    return SupersetClient.get({
      endpoint: encodeURI(
        `/superset/tables/${this.props.dbId}/` +
          `${encodeURIComponent(this.props.schema)}/${encodeURIComponent(
            input,
          )}`,
      ),
    }).then(({ json }) => {
      const options = json.options.map(o => ({
        value: o.value,
        schema: o.schema,
        label: o.label,
        title: o.title,
        type: o.type,
      }));
      return { options };
    });
  }
  dbMutator(data) {
    this.props.getDbList(data.result);
    if (data.result.length === 0) {
      this.props.handleError(
        t("It seems you don't have access to any database"),
      );
    }
    return data.result.map(row => ({
      ...row,
      // label is used for the typeahead
      label: `${row.backend} ${row.database_name}`,
    }));
  }
  fetchTables(force, substr) {
    const forceRefresh = force || false;
    const { dbId, schema } = this.state;
    if (dbId && schema) {
      this.setState(() => ({ tableLoading: true, tableOptions: [] }));
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/` +
          `${encodeURIComponent(schema)}/${encodeURIComponent(
            substr,
          )}/${forceRefresh}/`,
      );
      return SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const options = json.options.map(o => ({
            value: o.value,
            schema: o.schema,
            label: o.label,
            title: o.title,
            type: o.type,
          }));
          this.setState(() => ({
            tableLoading: false,
            tableOptions: options,
          }));
          this.props.onTablesLoad(json.options);
        })
        .catch(() => {
          this.setState(() => ({ tableLoading: false, tableOptions: [] }));
          this.props.handleError(t('Error while fetching table list'));
        });
    }
    this.setState(() => ({ tableLoading: false, tableOptions: [] }));
    return Promise.resolve();
  }
  fetchSchemas(dbId, force) {
    const actualDbId = dbId || this.props.dbId;
    const forceRefresh = force || false;
    if (actualDbId) {
      this.setState({ schemaLoading: true });
      const endpoint = `/superset/schemas/${actualDbId}/${forceRefresh}/`;

      return SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const schemaOptions = json.schemas.map(s => ({
            value: s,
            label: s,
            title: s,
          }));
          this.setState({ schemaOptions, schemaLoading: false });
          this.props.onSchemasLoad(schemaOptions);
        })
        .catch(() => {
          this.setState({ schemaLoading: false, schemaOptions: [] });
          this.props.handleError(t('Error while fetching schema list'));
        });
    }

    return Promise.resolve();
  }
  changeTable(tableOpt) {
    if (!tableOpt) {
      this.setState({ tableName: '' });
      return;
    }
    const schemaName = tableOpt.schema;
    const tableName = tableOpt.value;
    if (this.props.tableNameSticky) {
      this.setState({ tableName }, this.onChange);
    }
    this.props.onTableChange(tableName, schemaName);
  }
  changeSchema(schemaOpt, force = false) {
    const schema = schemaOpt ? schemaOpt.value : null;
    this.props.onSchemaChange(schema);
    this.setState({ schema }, () => {
      this.fetchTables(force);
      this.onChange();
    });
  }
  renderDatabaseOption(db) {
    return (
      <span>
        <Label bsStyle="default" className="m-r-5">
          {db.backend}
        </Label>
        {db.database_name}
      </span>
    );
  }
  renderTableOption(option) {
    return (
      <span className="TableLabel">
        <span className="m-r-5">
          <small className="text-muted">
            <i
              className={`fa fa-${option.type === 'view' ? 'eye' : 'table'}`}
            />
          </small>
        </span>
        {option.label}
      </span>
    );
  }
  renderSelectRow(select, refreshBtn) {
    return (
      <div className="section">
        <span className="select">{select}</span>
        <span className="refresh-col">{refreshBtn}</span>
      </div>
    );
  }
  renderDatabaseSelect() {
    return this.renderSelectRow(
      <AsyncSelect
        dataEndpoint={
          '/api/v1/database/?q=' +
          '(keys:!(none),' +
          'filters:!((col:expose_in_sqllab,opr:eq,value:!t)),' +
          'order_columns:database_name,order_direction:asc,page:0,page_size:-1)'
        }
        onChange={this.onDatabaseChange}
        onAsyncError={() =>
          this.props.handleError(t('Error while fetching database list'))
        }
        clearable={false}
        value={this.state.dbId}
        valueKey="id"
        valueRenderer={db => (
          <div>
            <span className="text-muted m-r-5">{t('Database:')}</span>
            {this.renderDatabaseOption(db)}
          </div>
        )}
        optionRenderer={this.renderDatabaseOption}
        mutator={this.dbMutator}
        placeholder={t('Select a database')}
        autoSelect
      />,
    );
  }
  renderSchema() {
    return this.renderSelectRow(
      <Select
        name="select-schema"
        placeholder={t('Select a schema (%s)', this.state.schemaOptions.length)}
        options={this.state.schemaOptions}
        value={this.props.schema}
        valueRenderer={o => (
          <div>
            <span className="text-muted">{t('Schema:')}</span> {o.label}
          </div>
        )}
        isLoading={this.state.schemaLoading}
        autosize={false}
        onChange={this.changeSchema}
      />,
      <RefreshLabel
        onClick={() => this.onDatabaseChange({ id: this.props.dbId }, true)}
        tooltipContent={t('Force refresh schema list')}
      />,
    );
  }
  renderTable() {
    let tableSelectPlaceholder;
    let tableSelectDisabled = false;
    if (
      this.props.database &&
      this.props.database.allow_multi_schema_metadata_fetch
    ) {
      tableSelectPlaceholder = t('Type to search ...');
    } else {
      tableSelectPlaceholder = t('Select table ');
      tableSelectDisabled = true;
    }
    const options = this.state.tableOptions;
    const select = this.props.schema ? (
      <Select
        name="select-table"
        ref="selectTable"
        isLoading={this.state.tableLoading}
        ignoreAccents={false}
        placeholder={t('Select table or type table name')}
        autosize={false}
        onChange={this.changeTable}
        options={options}
        value={this.state.tableName}
        optionRenderer={this.renderTableOption}
      />
    ) : (
      <Select
        async
        name="async-select-table"
        ref="selectTable"
        placeholder={tableSelectPlaceholder}
        disabled={tableSelectDisabled}
        autosize={false}
        onChange={this.changeTable}
        value={this.state.tableName}
        loadOptions={this.getTableNamesBySubStr}
        optionRenderer={this.renderTableOption}
      />
    );
    return this.renderSelectRow(
      select,
      <RefreshLabel
        onClick={() => this.changeSchema({ value: this.props.schema }, true)}
        tooltipContent={t('Force refresh table list')}
      />,
    );
  }
  renderSeeTableLabel() {
    return (
      <div className="section">
        <ControlLabel>
          {t('See table schema')}{' '}
          {this.props.schema && (
            <small>
              ({this.state.tableOptions.length} in <i>{this.props.schema}</i>)
            </small>
          )}
        </ControlLabel>
      </div>
    );
  }
  render() {
    return (
      <div className="TableSelector">
        {this.renderDatabaseSelect()}
        {this.renderSchema()}
        <div className="divider" />
        {this.props.sqlLabMode && this.renderSeeTableLabel()}
        {this.renderTable()}
      </div>
    );
  }
}
TableSelector.propTypes = propTypes;
TableSelector.defaultProps = defaultProps;
