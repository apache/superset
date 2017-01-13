const $ = window.$ = require('jquery');
import React from 'react';
import Select from 'react-select';
import { Label, Button } from 'react-bootstrap';
import TableElement from './TableElement';
import AsyncSelect from '../../components/AsyncSelect';

const propTypes = {
  queryEditor: React.PropTypes.object.isRequired,
  tables: React.PropTypes.array,
  actions: React.PropTypes.object,
  networkOn: React.PropTypes.bool,
};

const defaultProps = {
  tables: [],
  networkOn: true,
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
      networkOn: true,
      tableLength: 0,
    };
  }
  componentWillMount() {
    this.fetchSchemas(this.props.queryEditor.dbId);
    this.fetchTables(this.props.queryEditor.dbId);
  }
  onChange(db) {
    const val = (db) ? db.value : null;
    this.setState({ schemaOptions: [] });
    this.props.actions.queryEditorSetDb(this.props.queryEditor, val);
    if (!(db)) {
      this.setState({ tableOptions: [] });
    } else {
      this.fetchSchemas(val);
      this.fetchTables(val, this.props.queryEditor.schema);
    }
  }
  dbMutator(data) {
    const options = data.result.map((db) => ({ value: db.id, label: db.database_name }));
    this.props.actions.setDatabases(data.result);
    if (data.result.length === 0) {
      this.props.actions.addAlert({
        bsStyle: 'danger',
        msg: "It seems you don't have access to any database",
      });
    }
    return options;
  }
  resetState() {
    this.props.actions.resetState();
  }
  getTableNamesBySubStr(input, callback) {
    this.fetchTables(
        this.props.queryEditor.dbId,
        this.props.queryEditor.schema,
        input);
    callback(null, { options: this.state.tableOptions });
  }
  fetchTables(dbId, schema, substr) {
    if (!dbId) {
      this.setState({
        tableLoading: true,
        tableOptions: [],
      });
      const url = `/caravel/tables/${dbId}/${schema}?substr=${substr}`;
      const url = `/superset/tables/${actualDbId}/${actualSchema}`;
      $.get(url, (data) => {
        let tableOptions = data.tables.map((s) => ({value: s, label: s}));
        const views = data.views.map((s) => ({value: s, label: '[view] ' + s}));
        this.setState({
          tableOptions: [...tables, ...views],
          tableLength: data.views_length + data.tables_length,
          tableLoading: false
        });
        return;
      });
    }
  }
  changeSchema(schemaOpt) {
    const schema = (schemaOpt) ? schemaOpt.value : null;
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, schema);
    this.fetchTables(this.props.queryEditor.dbId, schema);
  }
  fetchSchemas(dbId) {
    if (dbId) {
      this.setState({ schemaLoading: true });
      const url = `/caravel/schemas/${dbId}`;
      $.get(url, (data) => {
        const schemas = data.schemas;
        const schemaOptions = schemas.map((s) => ({ value: s, label: s }));
        this.setState({ schemaOptions });
        this.setState({ schemaLoading: false });
      });
    }
  }
  closePopover(ref) {
    this.refs[ref].hide();
  }
  changeTable(tableOpt) {
    // tableOpt.value is schema.tableName or tableName
    const qe = this.props.queryEditor;
    this.setState({ tableLoading: true });
    this.props.actions.addTable(qe, tableOpt);
    this.setState({ tableLoading: false });

    // reset the list of tables
    this.fetchTables(qe.dbId, qe.schema);
  }
  render() {
    let networkAlert = null;
    if (!this.props.networkOn) {
      networkAlert = <p><Label bsStyle="danger">OFFLINE</Label></p>;
    }
    const shouldShowReset = window.location.search === '?reset=1';
    return (
      <div className="scrollbar-container">
        <div className="clearfix sql-toolbar scrollbar-content">
          {networkAlert}
          <div>
            <AsyncSelect
              dataEndpoint="/databaseasync/api/read?_flt_0_expose_in_sqllab=1"
              onChange={this.onChange.bind(this)}
              value={this.props.queryEditor.dbId}
              databaseId={this.props.queryEditor.dbId}
      <div className="clearfix sql-toolbar">
        {networkAlert}
        <div>
          <DatabaseSelect
            onChange={this.onChange.bind(this)}
            databaseId={this.props.queryEditor.dbId}
            actions={this.props.actions}
            valueRenderer={(o) => (
              <div>
                <span className="text-muted">Database:</span> {o.label}
              </div>
            )}
          />
        </div>
        <div className="m-t-5">
          <Select
            name="select-schema"
            placeholder={`Select a schema (${this.state.schemaOptions.length})`}
            options={this.state.schemaOptions}
            value={this.props.queryEditor.schema}
            valueRenderer={(o) => (
              <div>
                <span className="text-muted">Schema:</span> {o.label}
              </div>
            )}
            isLoading={this.state.schemaLoading}
            autosize={false}
            onChange={this.changeSchema.bind(this)}
          />
        </div>
        <div className="m-t-5">
          <Select.Async
            name="select-table"
            ref="selectTable"
            isLoading={this.state.tableLoading}
            placeholder={`Add a table (${this.state.tableLength})`}
            autosize={false}
            onChange={this.changeTable.bind(this)}
            options={this.state.tableOptions}
            loadOptions={this.getTableNamesBySubStr.bind(this)}
          />
        </div>
        <hr />
        <div className="m-t-5">
          {this.props.tables.map((table) => (
            <TableElement
              table={table}
              key={table.id}
              actions={this.props.actions}
              valueRenderer={(o) => (
                <div>
                  <span className="text-muted">Database:</span> {o.label}
                </div>
              )}
              mutator={this.dbMutator.bind(this)}
              placeholder="Select a database"
            />
            <Select
              name="select-schema"
              placeholder={`Select a schema (${this.state.schemaOptions.length})`}
              options={this.state.schemaOptions}
              value={this.props.queryEditor.schema}
              valueRenderer={(o) => (
                <div>
                  <span className="text-muted">Schema:</span> {o.label}
                </div>
              )}
              isLoading={this.state.schemaLoading}
              autosize={false}
              onChange={this.changeSchema.bind(this)}
            />
          </div>
          <div className="m-t-5">
            <Select
              name="select-table"
              ref="selectTable"
              isLoading={this.state.tableLoading}
              placeholder={`Add a table (${this.state.tableOptions.length})`}
              autosize={false}
              onChange={this.changeTable.bind(this)}
              options={this.state.tableOptions}
            />
          </div>
          <hr />
          <div className="m-t-5">
            {this.props.tables.map((table) => (
              <TableElement
                table={table}
                key={table.id}
                actions={this.props.actions}
              />
            ))}
          </div>
          {shouldShowReset &&
            <Button bsSize="small" bsStyle="danger" onClick={this.resetState.bind(this)}>
              <i className="fa fa-bomb" /> Reset State
            </Button>
          }
        </div>
      </div>
    );
  }
}
SqlEditorLeftBar.propTypes = propTypes;
SqlEditorLeftBar.defaultProps = defaultProps;

export default SqlEditorLeftBar;
