const $ = window.$ = require('jquery');
import React from 'react';
import { Label, OverlayTrigger, Popover } from 'react-bootstrap';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';
import shortid from 'shortid';
import Select from 'react-select';
import Link from './Link';

// CSS
import 'react-select/dist/react-select.css';

class SqlEditorTopToolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      databaseLoading: false,
      databaseOptions: [],
      schemaLoading: false,
      schemaOptions: [],
      tableLoading: false,
      tableOptions: [],
    };
  }
  componentWillMount() {
    this.fetchDatabaseOptions();
    this.fetchSchemas();
    this.fetchTables();
  }
  getSql(table) {
    let cols = '';
    table.columns.forEach(function (col, i) {
      cols += col.name;
      if (i < table.columns.length - 1) {
        cols += ', ';
      }
    });
    return `SELECT ${cols}\nFROM ${table.name}`;
  }
  selectStar(table) {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, this.getSql(table));
  }
  popTab(table) {
    const qe = {
      id: shortid.generate(),
      title: table.name,
      dbId: table.dbId,
      schema: table.schema,
      autorun: true,
      sql: this.getSql(table),
    };
    this.props.actions.addQueryEditor(qe);
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
  changeDb(db) {
    const val = (db) ? db.value : null;
    this.setState({ schemaOptions: [] });
    this.props.actions.queryEditorSetDb(this.props.queryEditor, val);
    if (!(db)) {
      this.setState({ tableOptions: [] });
      return;
    }
    this.fetchTables(val, this.props.queryEditor.schema);
    this.fetchSchemas(val);
  }
  fetchDatabaseOptions() {
    this.setState({ databaseLoading: true });
    const url = '/databaseasync/api/read';
    $.get(url, (data) => {
      const options = data.result.map((db) => ({ value: db.id, label: db.database_name }));
      this.setState({ databaseOptions: options });
      this.setState({ databaseLoading: false });
    });
  }
  closePopover(ref) {
    this.refs[ref].hide();
  }
  changeTable(tableOpt) {
    const tableName = tableOpt.value;
    const qe = this.props.queryEditor;
    const url = `/caravel/table/${qe.dbId}/${tableName}/${qe.schema}/`;
    $.get(url, (data) => {
      this.props.actions.addTable({
        id: shortid.generate(),
        dbId: this.props.queryEditor.dbId,
        queryEditorId: this.props.queryEditor.id,
        name: data.name,
        schema: qe.schema,
        columns: data.columns,
        expanded: true,
        showPopup: true,
      });
    })
    .fail(() => {
      this.props.actions.addAlert({
        msg: 'Error occurred while fetching metadata',
        bsStyle: 'danger',
      });
    });
  }
  render() {
    const tables = this.props.tables.filter((t) => (t.queryEditorId === this.props.queryEditor.id));
    const tablesEls = tables.map((table) => {
      let cols = [];
      if (table.columns) {
        cols = table.columns.map((col) => (
          <div className="clearfix">
            <div className="pull-left m-r-10">{col.name}</div>
            <div className="pull-right text-muted"> {col.type}</div>
          </div>
        ));
      }
      const popoverId = 'tblPopover_' + table.name;
      const popoverTop = (
        <div className="clearfix">
          <div className="pull-left">
            <Link
              className="fa fa-pencil"
              onClick={this.selectStar.bind(this, table)}
              tooltip="Overwrite text in editor with a query on this table"
              placement="left"
              href="#"
            />
            <Link
              className="fa fa-plus-circle"
              onClick={this.popTab.bind(this, table)}
              tooltip="Run query in a new tab"
              placement="left"
              href="#"
            />
          </div>
          <div className="pull-right">
            <Link
              className="fa fa-close"
              onClick={this.closePopover.bind(this, popoverId)}
              href="#"
            />
          </div>
        </div>
      );
      const popover = (
        <Popover
          id={popoverId}
          className="tablePopover"
          title={popoverTop}
        >
          {cols}
        </Popover>
      );
      return (
        <Label className="m-r-5 table-label" style={{ fontSize: '100%' }}>
          <OverlayTrigger
            trigger="click"
            placement="bottom"
            overlay={popover}
            ref={popoverId}
          >
            <span className="m-r-5" style={{ cursor: 'pointer' }}>
              {table.name}
            </span>
          </OverlayTrigger>
          <i
            className="fa fa-close"
            style={{ cursor: 'pointer' }}
            onClick={this.props.actions.removeTable.bind(this, table)}
          />
        </Label>
      );
    });
    return (
      <div className="clearfix sql-toolbar">
        <div className="pull-left m-r-5">
          <Select
            name="select-db"
            placeholder="[Database]"
            options={this.state.databaseOptions}
            value={this.props.queryEditor.dbId}
            isLoading={this.state.databaseLoading}
            autosize={false}
            onChange={this.changeDb.bind(this)}
          />
        </div>
        <div className="pull-left m-r-5">
          <Select
            name="select-schema"
            placeholder="[Schema]"
            options={this.state.schemaOptions}
            value={this.props.queryEditor.schema}
            isLoading={this.state.schemaLoading}
            autosize={false}
            onChange={this.changeSchema.bind(this)}
          />
        </div>
        <div className="pull-left m-r-5">
          <Select
            name="select-table"
            ref="selectTable"
            isLoading={this.state.tableLoading}
            placeholder="Add a table"
            autosize={false}
            value={this.state.tableName}
            onChange={this.changeTable.bind(this)}
            options={this.state.tableOptions}
          />
        </div>
        <div className="pull-left m-r-5">
          {tablesEls}
        </div>
      </div>
    );
  }
}

SqlEditorTopToolbar.propTypes = {
  queryEditor: React.PropTypes.object,
  tables: React.PropTypes.array,
  actions: React.PropTypes.object,
};

SqlEditorTopToolbar.defaultProps = {
  tables: [],
};

function mapStateToProps(state) {
  return {
    tables: state.tables,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SqlEditorTopToolbar);
