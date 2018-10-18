import React from 'react';
import PropTypes from 'prop-types';
import { ControlLabel, Button } from 'react-bootstrap';
import Select from 'react-virtualized-select';
import createFilterOptions from 'react-select-fast-filter-options';
import { SupersetClient } from '@superset-ui/core';

import TableElement from './TableElement';
import AsyncSelect from '../../components/AsyncSelect';
import RefreshLabel from '../../components/RefreshLabel';
import { t } from '../../locales';

const propTypes = {
  queryEditor: PropTypes.object.isRequired,
  height: PropTypes.number.isRequired,
  tables: PropTypes.array,
  actions: PropTypes.object,
  database: PropTypes.object,
};

const defaultProps = {
  tables: [],
  actions: {},
};

class SqlEditorLeftBar extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      schemaLoading: false,
      schemaOptions: [],
      tableLoading: false,
      tableOptions: [],
    };
  }

  componentWillMount() {
    this.fetchSchemas(this.props.queryEditor.dbId);
    this.fetchTables(this.props.queryEditor.dbId, this.props.queryEditor.schema);
  }

  onDatabaseChange(db, force) {
    const val = db ? db.value : null;
    this.setState(() => ({ schemaOptions: [], tableOptions: [] }));
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, null);
    this.props.actions.queryEditorSetDb(this.props.queryEditor, val);
    if (db) {
      this.fetchSchemas(val, force || false);
    }
  }

  getTableNamesBySubStr(input) {
    if (!this.props.queryEditor.dbId || !input) {
      return Promise.resolve({ options: [] });
    }

    return SupersetClient.get({
      endpoint: `/superset/tables/${this.props.queryEditor.dbId}/${
        this.props.queryEditor.schema
      }/${input}`,
    }).then(({ json }) => ({ options: json.options }));
  }

  dbMutator(data) {
    const options = data.result.map(db => ({ value: db.id, label: db.database_name }));
    this.props.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      this.props.actions.addDangerToast(t("It seems you don't have access to any database"));
    }
    return options;
  }

  resetState() {
    this.props.actions.resetState();
  }

  fetchTables(dbId, schema, force, substr) {
    // This can be large so it shouldn't be put in the Redux store
    const forceRefresh = force || false;
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
            tableLength: json.tableLength,
          }));
        })
        .catch(() => {
          this.setState(() => ({ tableLoading: false, tableOptions: [], tableLength: 0 }));
          this.props.actions.addDangerToast(t('Error while fetching table list'));
        });
    }

    this.setState(() => ({ tableLoading: false, tableOptions: [], filterOptions: null }));
    return Promise.resolve();
  }

  changeTable(tableOpt) {
    if (!tableOpt) {
      this.setState({ tableName: '' });
      return;
    }
    const namePieces = tableOpt.value.split('.');
    let tableName = namePieces[0];
    let schemaName = this.props.queryEditor.schema;
    if (namePieces.length === 1) {
      this.setState({ tableName });
    } else {
      schemaName = namePieces[0];
      tableName = namePieces[1];
      this.setState({ tableName });
      this.props.actions.queryEditorSetSchema(this.props.queryEditor, schemaName);
      this.fetchTables(this.props.queryEditor.dbId, schemaName);
    }
    this.props.actions.addTable(this.props.queryEditor, tableName, schemaName);
  }

  changeSchema(schemaOpt, force) {
    const schema = schemaOpt ? schemaOpt.value : null;
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, schema);
    this.fetchTables(this.props.queryEditor.dbId, schema, force);
  }

  fetchSchemas(dbId, force) {
    const actualDbId = dbId || this.props.queryEditor.dbId;
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
          this.props.actions.addDangerToast(t('Error while fetching schema list'));
        });
    }

    return Promise.resolve();
  }

  closePopover(ref) {
    this.refs[ref].hide();
  }

  render() {
    const shouldShowReset = window.location.search === '?reset=1';
    const tableMetaDataHeight = this.props.height - 130; // 130 is the height of the selects above
    let tableSelectPlaceholder;
    let tableSelectDisabled = false;
    if (this.props.database && this.props.database.allow_multi_schema_metadata_fetch) {
      tableSelectPlaceholder = t('Type to search ...');
    } else {
      tableSelectPlaceholder = t('Select table ');
      tableSelectDisabled = true;
    }
    const database = this.props.database || {};
    return (
      <div className="clearfix sql-toolbar">
        <div>
          <AsyncSelect
            dataEndpoint={
              '/databaseasync/api/' +
              'read?_flt_0_expose_in_sqllab=1&' +
              '_oc_DatabaseAsync=database_name&' +
              '_od_DatabaseAsync=asc'
            }
            onChange={this.onDatabaseChange.bind(this)}
            onAsyncError={() => {
              this.props.actions.addDangerToast(t('Error while fetching database list'));
            }}
            value={this.props.queryEditor.dbId}
            databaseId={this.props.queryEditor.dbId}
            actions={this.props.actions}
            valueRenderer={o => (
              <div>
                <span className="text-muted">{t('Database:')}</span> {o.label}
              </div>
            )}
            mutator={this.dbMutator.bind(this)}
            placeholder={t('Select a database')}
            autoSelect
          />
        </div>
        <div className="m-t-5">
          <div className="row">
            <div className="col-md-11 col-xs-11" style={{ paddingRight: '2px' }}>
              <Select
                name="select-schema"
                placeholder={t('Select a schema (%s)', this.state.schemaOptions.length)}
                options={this.state.schemaOptions}
                value={this.props.queryEditor.schema}
                valueRenderer={o => (
                  <div>
                    <span className="text-muted">{t('Schema:')}</span> {o.label}
                  </div>
                )}
                isLoading={this.state.schemaLoading}
                autosize={false}
                onChange={this.changeSchema.bind(this)}
              />
            </div>
            <div className="col-md-1 col-xs-1" style={{ paddingTop: '8px', paddingLeft: '0px' }}>
              <RefreshLabel
                onClick={this.onDatabaseChange.bind(
                    this, { value: database.id }, true)}
                tooltipContent={t('force refresh schema list')}
              />
            </div>
          </div>
        </div>
        <hr />
        <div className="m-t-5">
          <ControlLabel>
            {t('See table schema')}
            &nbsp;
            <small>
              ({this.state.tableOptions.length}
              &nbsp;
              {t('in')}
              &nbsp;
              <i>{this.props.queryEditor.schema}</i>)
            </small>
          </ControlLabel>
          <div className="row">
            <div className="col-md-11 col-xs-11" style={{ paddingRight: '2px' }}>
              {this.props.queryEditor.schema ? (
                <Select
                  name="select-table"
                  ref="selectTable"
                  isLoading={this.state.tableLoading}
                  placeholder={t('Select table or type table name')}
                  autosize={false}
                  onChange={this.changeTable.bind(this)}
                  filterOptions={this.state.filterOptions}
                  options={this.state.tableOptions}
                />
              ) : (
                <Select
                  async
                  name="async-select-table"
                  ref="selectTable"
                  placeholder={tableSelectPlaceholder}
                  disabled={tableSelectDisabled}
                  autosize={false}
                  onChange={this.changeTable.bind(this)}
                  loadOptions={this.getTableNamesBySubStr.bind(this)}
                />
              )}
            </div>
            <div className="col-md-1 col-xs-1" style={{ paddingTop: '8px', paddingLeft: '0px' }}>
              <RefreshLabel
                onClick={this.changeSchema.bind(
                    this, { value: this.props.queryEditor.schema }, true)}
                tooltipContent={t('force refresh table list')}
              />
            </div>
          </div>
        </div>
        <hr />
        <div className="m-t-5">
          <div className="scrollbar-container">
            <div className="scrollbar-content" style={{ height: tableMetaDataHeight }}>
              {this.props.tables.map(table => (
                <TableElement table={table} key={table.id} actions={this.props.actions} />
              ))}
            </div>
          </div>
        </div>
        {shouldShowReset && (
          <Button bsSize="small" bsStyle="danger" onClick={this.resetState.bind(this)}>
            <i className="fa fa-bomb" /> {t('Reset State')}
          </Button>
        )}
      </div>
    );
  }
}

SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;

export default SqlEditorLeftBar;
