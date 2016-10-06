const $ = window.$ = require('jquery');
import React from 'react';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';
import shortid from 'shortid';
import Select from 'react-select';
import { Label, Button } from 'react-bootstrap';
import TableElement from './TableElement';
import DatabaseSelect from './DatabaseSelect';


class SqlEditorTopToolbar extends React.Component {
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
    this.fetchSchemas();
    this.fetchTables();
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
  resetState() {
    this.props.actions.resetState();
  }
  fetchTables(dbId, schema) {
    const actualDbId = dbId || this.props.queryEditor.dbId;
    if (actualDbId) {
      const actualSchema = schema || this.props.queryEditor.schema;
      this.setState({ tableLoading: true });
      this.setState({ tableOptions: [] });
      const url = `/caravel/tables/${actualDbId}/${actualSchema}`;
      $.get(url, (data) => {
        let tableOptions = data.tables.map((s) => ({ value: s, label: s }));
        const views = data.views.map((s) => ({ value: s, label: '[view] ' + s }));
        tableOptions = [...tableOptions, ...views];
        this.setState({ tableOptions });
        this.setState({ tableLoading: false });
      });
    }
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
      const url = `/databasetablesasync/api/read?_flt_0_id=${actualDbId}`;
      $.get(url, (data) => {
        const schemas = data.result[0].all_schema_names;
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
    const tableName = tableOpt.value;
    const qe = this.props.queryEditor;
    const url = `/caravel/table/${qe.dbId}/${tableName}/${qe.schema}/`;

    this.setState({ tableLoading: true });
    $.get(url, (data) => {
      this.props.actions.addTable({
        id: shortid.generate(),
        dbId: this.props.queryEditor.dbId,
        queryEditorId: this.props.queryEditor.id,
        name: data.name,
        indexes: data.indexes,
        schema: qe.schema,
        columns: data.columns,
        expanded: true,
      });
      this.setState({ tableLoading: false });
    })
    .fail(() => {
      this.props.actions.addAlert({
        msg: 'Error occurred while fetching metadata',
        bsStyle: 'danger',
      });
      this.setState({ tableLoading: false });
    });
  }
  render() {
    let networkAlert = null;
    if (!this.props.networkOn) {
      networkAlert = <p><Label bsStyle="danger">OFFLINE</Label></p>;
    }
    const tables = this.props.tables.filter((t) => (t.queryEditorId === this.props.queryEditor.id));
    const shouldShowReset = window.location.search === '?reset=1';
    return (
      <div className="clearfix sql-toolbar">
        {networkAlert}
        <div>
          <DatabaseSelect
            onChange={this.onChange.bind(this)}
            databaseId={this.props.queryEditor.dbId}
          />
        </div>
        <div className="m-t-5">
          <Select
            name="select-schema"
            placeholder={`Select a schema (${this.state.schemaOptions.length})`}
            options={this.state.schemaOptions}
            value={this.props.queryEditor.schema}
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
            value={this.state.tableName}
            onChange={this.changeTable.bind(this)}
            options={this.state.tableOptions}
          />
        </div>
        <hr />
        <div className="m-t-5">
          {tables.map((table) => (
            <TableElement table={table} queryEditor={this.props.queryEditor} key={table.id} />
          ))}
        </div>
        {shouldShowReset &&
          <Button bsSize="small" bsStyle="danger" onClick={this.resetState.bind(this)}>
            <i className="fa fa-bomb" /> Reset State
          </Button>
        }
      </div>
    );
  }
}

SqlEditorTopToolbar.propTypes = {
  queryEditor: React.PropTypes.object,
  tables: React.PropTypes.array,
  actions: React.PropTypes.object,
  networkOn: React.PropTypes.bool,
};

SqlEditorTopToolbar.defaultProps = {
  tables: [],
};

function mapStateToProps(state) {
  return {
    tables: state.tables,
    networkOn: state.networkOn,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SqlEditorTopToolbar);
