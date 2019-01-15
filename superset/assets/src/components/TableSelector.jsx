import React from 'react';
import PropTypes from 'prop-types';
import Select from 'react-virtualized-select';
import createFilterOptions from 'react-select-fast-filter-options';
import { ControlLabel, Col, Label } from 'react-bootstrap';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import AsyncSelect from './AsyncSelect';
import RefreshLabel from './RefreshLabel';

const propTypes = {
  dbId: PropTypes.number.isRequired,
  schema: PropTypes.string,
  onSchemaChange: PropTypes.func,
  onDbChange: PropTypes.func,
  getDbList: PropTypes.func,
  onTableChange: PropTypes.func,
  tableNameSticky: PropTypes.bool,
  tableName: PropTypes.string,
  database: PropTypes.object,
  horizontal: PropTypes.bool,
  sqlLabMode: PropTypes.bool,
  onChange: PropTypes.func,
  clearable: PropTypes.bool,
  handleError: PropTypes.func.isRequired,
};

const defaultProps = {
  onDbChange: () => {},
  onSchemaChange: () => {},
  getDbList: () => {},
  onTableChange: () => {},
  onChange: () => {},
  tableNameSticky: true,
  horizontal: false,
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
      filterOptions: null,
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
      shema: this.state.schema,
      tableName: this.state.tableName,
    });
  }
  getTableNamesBySubStr(input) {
    const { tableName } = this.state;
    if (!this.props.dbId || !input) {
      const options = this.addOptionIfMissing([], tableName);
      return Promise.resolve({ options });
    }
    return SupersetClient.get({
      endpoint: (
        `/superset/tables/${this.props.dbId}/` +
        `${this.props.schema}/${input}`),
    }).then(({ json }) => ({ options: this.addOptionIfMissing(json.options, tableName) }));
  }
  dbMutator(data) {
    this.props.getDbList(data.result);
    if (data.result.length === 0) {
      this.props.handleError(t("It seems you don't have access to any database"));
    }
    return data.result;
  }
  fetchTables(force, substr) {
    // This can be large so it shouldn't be put in the Redux store
    const forceRefresh = force || false;
    const { dbId, schema } = this.props;
    if (dbId && schema) {
      this.setState(() => ({ tableLoading: true, tableOptions: [] }));
      const endpoint = `/superset/tables/${dbId}/${schema}/${substr}/${forceRefresh}/`;
       return SupersetClient.get({ endpoint })
        .then(({ json }) => {
          const filterOptions = createFilterOptions({ options: json.options });
          this.setState(() => ({
            filterOptions,
            tableLoading: false,
            tableOptions: json.options,
          }));
        })
        .catch(() => {
          this.setState(() => ({ tableLoading: false, tableOptions: [] }));
          this.props.handleError(t('Error while fetching table list'));
        });
    }
     this.setState(() => ({ tableLoading: false, tableOptions: [], filterOptions: null }));
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
          const schemaOptions = json.schemas.map(s => ({ value: s, label: s }));
          this.setState({ schemaOptions, schemaLoading: false });
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
    const namePieces = tableOpt.value.split('.');
    let tableName = namePieces[0];
    let schemaName = this.props.schema;
    if (namePieces.length > 1) {
      schemaName = namePieces[0];
      tableName = namePieces[1];
    }
    if (this.props.tableNameSticky) {
      this.setState({ tableName }, this.onChange);
    }
    this.props.onTableChange(tableName, schemaName);
  }
  changeSchema(schemaOpt) {
    const schema = schemaOpt ? schemaOpt.value : null;
    this.props.onSchemaChange(schema);
    this.setState({ schema }, () => {
      this.fetchTables();
      this.onChange();
    });
  }
  addOptionIfMissing(options, value) {
    if (options.filter(o => o.value === this.state.tableName).length === 0 && value) {
      return [...options, { value, label: value }];
    }
    return options;
  }
  renderDatabaseOption(db) {
    return (
      <span>
        <Label bsStyle="default" className="m-r-5">{db.backend}</Label>
        {db.database_name}
      </span>);
  }
  renderDatabaseSelect() {
    return (
      <AsyncSelect
        dataEndpoint={
          '/databaseasync/api/' +
          'read?_flt_0_expose_in_sqllab=1&' +
          '_oc_DatabaseAsync=database_name&' +
          '_od_DatabaseAsync=asc'
        }
        onChange={this.onDatabaseChange}
        onAsyncError={() => this.props.handleError(t('Error while fetching database list'))}
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
      />);
  }
  renderSchema() {
    return (
      <div className="m-t-5">
        <div className="row">
          <div className="col-md-11 col-xs-11 p-r-2">
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
            />
          </div>
          <div className="col-md-1 col-xs-1 p-l-0 p-t-8">
            <RefreshLabel
              onClick={() => this.onDatabaseChange({ id: this.props.dbId }, true)}
              tooltipContent={t('force refresh schema list')}
            />
          </div>
        </div>
      </div>
    );
  }
  renderTable() {
    let tableSelectPlaceholder;
    let tableSelectDisabled = false;
    if (this.props.database && this.props.database.allow_multi_schema_metadata_fetch) {
      tableSelectPlaceholder = t('Type to search ...');
    } else {
      tableSelectPlaceholder = t('Select table ');
      tableSelectDisabled = true;
    }
    const options = this.addOptionIfMissing(this.state.tableOptions, this.state.tableName);
    return (
      <div className="m-t-5">
        <div className="row">
          <div className="col-md-11 col-xs-11 p-r-2">
            {this.props.schema ? (
              <Select
                name="select-table"
                ref="selectTable"
                isLoading={this.state.tableLoading}
                placeholder={t('Select table or type table name')}
                autosize={false}
                onChange={this.changeTable}
                filterOptions={this.state.filterOptions}
                options={options}
                value={this.state.tableName}
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
              />
            )}
          </div>
          <div className="col-md-1 col-xs-1 p-l-0 p-t-8">
            <RefreshLabel
              onClick={() => this.changeSchema({ value: this.props.schema }, true)}
              tooltipContent={t('force refresh table list')}
            />
          </div>
        </div>
      </div>);
  }
  renderSeeTableLabel() {
    return (
      <div>
        <hr />
        <ControlLabel>
          {t('See table schema')}{' '}
          <small>
            ({this.state.tableOptions.length}
            {' '}{t('in')}{' '}
            <i>
              {this.props.schema}
            </i>)
          </small>
        </ControlLabel>
      </div>);
  }
  render() {
    if (this.props.horizontal) {
      return (
        <div>
          <Col md={4}>{this.renderDatabaseSelect()}</Col>
          <Col md={4}>{this.renderSchema()}</Col>
          <Col md={4}>{this.renderTable()}</Col>
        </div>);
    }
    return (
      <div>
        <div>{this.renderDatabaseSelect()}</div>
        <div className="m-t-5">{this.renderSchema()}</div>
        {this.props.sqlLabMode && this.renderSeeTableLabel()}
        <div className="m-t-5">{this.renderTable()}</div>
      </div>);
  }
}
TableSelector.propTypes = propTypes;
TableSelector.defaultProps = defaultProps;
