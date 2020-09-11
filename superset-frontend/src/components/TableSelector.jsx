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
import { styled, SupersetClient, t } from '@superset-ui/core';
import PropTypes from 'prop-types';
import rison from 'rison';
import { AsyncSelect, CreatableSelect, Select } from 'src/components/Select';

import Label from 'src/components/Label';
import FormLabel from 'src/components/FormLabel';

import SupersetAsyncSelect from './AsyncSelect';
import RefreshLabel from './RefreshLabel';
import './TableSelector.less';

const FieldTitle = styled.p`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  margin: 20px 0 10px 0;
  text-transform: uppercase;
`;

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
  formMode: PropTypes.bool,
  onChange: PropTypes.func,
  clearable: PropTypes.bool,
  handleError: PropTypes.func.isRequired,
  isDatabaseSelectEnabled: PropTypes.bool,
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
  formMode: false,
  clearable: true,
  isDatabaseSelectEnabled: true,
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
    this.onDatabaseChange = this.onDatabaseChange.bind(this);
    this.onSchemaChange = this.onSchemaChange.bind(this);
    this.changeTable = this.changeTable.bind(this);
    this.dbMutator = this.dbMutator.bind(this);
    this.getTableNamesBySubStr = this.getTableNamesBySubStr.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  componentDidMount() {
    if (this.state.dbId) {
      this.fetchSchemas(this.state.dbId);
      this.fetchTables();
    }
  }

  onChange() {
    this.props.onChange({
      dbId: this.state.dbId,
      schema: this.state.schema,
      tableName: this.state.tableName,
    });
  }

  onDatabaseChange(db, force) {
    return this.changeDataBase(db, force);
  }

  onSchemaChange(schemaOpt) {
    return this.changeSchema(schemaOpt);
  }

  getTableNamesBySubStr(substr = 'undefined') {
    if (!this.props.dbId || !substr) {
      const options = [];
      return Promise.resolve({ options });
    }
    const encodedSchema = encodeURIComponent(this.props.schema);
    const encodedSubstr = encodeURIComponent(substr);
    return SupersetClient.get({
      endpoint: encodeURI(
        `/superset/tables/${this.props.dbId}/${encodedSchema}/${encodedSubstr}`,
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

  fetchTables(forceRefresh = false, substr = 'undefined') {
    const { dbId, schema } = this.state;
    const encodedSchema = encodeURIComponent(schema);
    const encodedSubstr = encodeURIComponent(substr);
    if (dbId && schema) {
      this.setState(() => ({ tableLoading: true, tableOptions: [] }));
      const endpoint = encodeURI(
        `/superset/tables/${dbId}/${encodedSchema}/${encodedSubstr}/${!!forceRefresh}/`,
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

  fetchSchemas(dbId, forceRefresh = false) {
    const actualDbId = dbId || this.props.dbId;
    if (actualDbId) {
      this.setState({ schemaLoading: true });
      const queryParams = rison.encode({
        force: Boolean(forceRefresh),
      });
      const endpoint = `/api/v1/database/${actualDbId}/schemas/?q=${queryParams}`;
      return SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const schemaOptions = json.result.map(s => ({
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

  changeDataBase(db, force = false) {
    const dbId = db ? db.id : null;
    this.setState({ schemaOptions: [] });
    this.props.onSchemaChange(null);
    this.props.onDbChange(db);
    this.fetchSchemas(dbId, force);
    this.setState(
      { dbId, schema: null, tableName: null, tableOptions: [] },
      this.onChange,
    );
  }

  changeSchema(schemaOpt, force = false) {
    const schema = schemaOpt ? schemaOpt.value : null;
    this.props.onSchemaChange(schema);
    this.setState({ schema }, () => {
      this.fetchTables(force);
      this.onChange();
    });
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

  renderDatabaseOption(db) {
    return (
      <span title={db.database_name}>
        <Label bsStyle="default">{db.backend}</Label>
        {db.database_name}
      </span>
    );
  }

  renderTableOption(option) {
    return (
      <span className="TableLabel" title={option.label}>
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
    const queryParams = rison.encode({
      order_columns: 'database_name',
      order_direction: 'asc',
      page: 0,
      page_size: -1,
      ...(this.props.formMode
        ? {}
        : {
            filters: [
              {
                col: 'expose_in_sqllab',
                opr: 'eq',
                value: true,
              },
            ],
          }),
    });

    return this.renderSelectRow(
      <SupersetAsyncSelect
        dataEndpoint={`/api/v1/database/?q=${queryParams}`}
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
        isDisabled={!this.props.isDatabaseSelectEnabled}
        autoSelect
      />,
    );
  }

  renderSchema() {
    const refresh = !this.props.formMode && (
      <RefreshLabel
        onClick={() => this.onDatabaseChange({ id: this.props.dbId }, true)}
        tooltipContent={t('Force refresh schema list')}
      />
    );
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
        onChange={this.onSchemaChange}
      />,
      refresh,
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
    let select = null;
    if (this.props.schema && !this.props.formMode) {
      select = (
        <Select
          name="select-table"
          isLoading={this.state.tableLoading}
          ignoreAccents={false}
          placeholder={t('Select table or type table name')}
          autosize={false}
          onChange={this.changeTable}
          options={options}
          value={this.state.tableName}
          optionRenderer={this.renderTableOption}
        />
      );
    } else if (this.props.formMode) {
      select = (
        <CreatableSelect
          name="select-table"
          isLoading={this.state.tableLoading}
          ignoreAccents={false}
          placeholder={t('Select table or type table name')}
          autosize={false}
          onChange={this.changeTable}
          options={options}
          value={this.state.tableName}
          optionRenderer={this.renderTableOption}
        />
      );
    } else {
      select = (
        <AsyncSelect
          name="async-select-table"
          placeholder={tableSelectPlaceholder}
          isDisabled={tableSelectDisabled}
          autosize={false}
          onChange={this.changeTable}
          value={this.state.tableName}
          loadOptions={this.getTableNamesBySubStr}
          optionRenderer={this.renderTableOption}
        />
      );
    }
    const refresh = !this.props.formMode && (
      <RefreshLabel
        onClick={() => this.changeSchema({ value: this.props.schema }, true)}
        tooltipContent={t('Force refresh table list')}
      />
    );
    return this.renderSelectRow(select, refresh);
  }

  renderSeeTableLabel() {
    return (
      <div className="section">
        <FormLabel>
          {t('See table schema')}{' '}
          {this.props.schema && (
            <small>
              ({this.state.tableOptions.length} in <i>{this.props.schema}</i>)
            </small>
          )}
        </FormLabel>
      </div>
    );
  }

  render() {
    return (
      <div className="TableSelector">
        {this.props.formMode && <FieldTitle>{t('datasource')}</FieldTitle>}
        {this.renderDatabaseSelect()}
        {this.props.formMode && <FieldTitle>{t('schema')}</FieldTitle>}
        {this.renderSchema()}
        {!this.props.formMode && <div className="divider" />}
        {this.props.sqlLabMode && this.renderSeeTableLabel()}
        {this.props.formMode && <FieldTitle>{t('Table')}</FieldTitle>}
        {this.renderTable()}
      </div>
    );
  }
}
TableSelector.propTypes = propTypes;
TableSelector.defaultProps = defaultProps;
