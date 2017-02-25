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
    };
  }
  componentWillMount() {
    this.fetchSchemas(this.props.queryEditor.dbId);
    this.fetchTables(this.props.queryEditor.dbId, this.props.queryEditor.schema);
  }
  onChange(db) {
    const val = (db) ? db.value : null;
    this.setState({ schemaOptions: [] });
    this.props.actions.queryEditorSetDb(this.props.queryEditor, val);
    if (!(db)) {
      this.setState({ tableOptions: [] });
    } else {
      this.fetchTables(val, this.props.queryEditor.schema);
      this.fetchSchemas(val);
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
  getTableNamesBySubStr(input) {
    if (!this.props.queryEditor.dbId || !input) {
      return Promise.resolve({ options: [] });
    }
    const url = `/superset/tables/${this.props.queryEditor.dbId}/\
${this.props.queryEditor.schema}/${input}`;
    return $.get(url).then((data) => ({ options: data.options }));
  }
  // TODO: move fetching methods to the actions.
  fetchTables(dbId, schema, substr) {
    if (dbId) {
      this.setState({ tableLoading: true, tableOptions: [] });
      const url = `/superset/tables/${dbId}/${schema}/${substr}/`;
      $.get(url, (data) => {
        this.setState({
          tableLoading: false,
          tableOptions: data.options,
          tableLength: data.tableLength,
        });
      });
    }
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
    this.setState({ tableLoading: true });
    // TODO: handle setting the tableLoading state depending on success or
    //       failure of the addTable async call in the action.
    this.props.actions.addTable(this.props.queryEditor, tableName, schemaName);
    this.setState({ tableLoading: false });
  }
  changeSchema(schemaOpt) {
    const schema = (schemaOpt) ? schemaOpt.value : null;
    this.props.actions.queryEditorSetSchema(this.props.queryEditor, schema);
    this.fetchTables(this.props.queryEditor.dbId, schema);
  }
  fetchSchemas(dbId) {
    const actualDbId = dbId || this.props.queryEditor.dbId;
    if (actualDbId) {
      this.setState({ schemaLoading: true });
      const url = `/superset/schemas/${actualDbId}/`;
      $.get(url, (data) => {
        const schemaOptions = data.schemas.map((s) => ({ value: s, label: s }));
        this.setState({ schemaOptions });
        this.setState({ schemaLoading: false });
      });
    }
  }
  closePopover(ref) {
    this.refs[ref].hide();
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
            {this.props.queryEditor.schema &&
              <Select
                name="select-table"
                ref="selectTable"
                isLoading={this.state.tableLoading}
                value={this.state.tableName}
                placeholder={`Add a table (${this.state.tableOptions.length})`}
                autosize={false}
                onChange={this.changeTable.bind(this)}
                options={this.state.tableOptions}
              />
            }
            {!this.props.queryEditor.schema &&
              <Select.Async
                name="async-select-table"
                ref="selectTable"
                value={this.state.tableName}
                placeholder={"Type to search ..."}
                autosize={false}
                onChange={this.changeTable.bind(this)}
                loadOptions={this.getTableNamesBySubStr.bind(this)}
              />
            }
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
