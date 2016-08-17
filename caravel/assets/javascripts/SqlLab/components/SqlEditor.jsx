const $ = window.$ = require('jquery');
import React from 'react';
import {
  Button,
  ButtonGroup,
  DropdownButton,
  Label,
  MenuItem,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';

import AceEditor from 'react-ace';
import 'brace/mode/sql';
import 'brace/theme/github';
import 'brace/ext/language_tools';

import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';
import shortid from 'shortid';
import ButtonWithTooltip from './ButtonWithTooltip';
import SouthPane from './SouthPane';
import Timer from './Timer';

import SqlEditorTopToolbar from './SqlEditorTopToolbar';

// CSS
import 'react-select/dist/react-select.css';

class SqlEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      autorun: props.queryEditor.autorun,
      sql: props.queryEditor.sql,
    };
  }
  componentDidMount() {
    this.onMount();
  }
  onMount() {
    if (this.state.autorun) {
      this.setState({ autorun: false });
      this.props.actions.queryEditorSetAutorun(this.props.queryEditor, false);
      this.startQuery();
    }
  }
  startQuery() {
    const that = this;
    const query = {
      id: shortid.generate(),
      sqlEditorId: this.props.queryEditor.id,
      sql: this.props.queryEditor.sql,
      state: 'running',
      tab: this.props.queryEditor.title,
      dbId: this.props.queryEditor.dbId,
      startDttm: new Date(),
    };
    const url = '/caravel/sql_json/';
    const data = {
      sql: this.props.queryEditor.sql,
      database_id: this.props.queryEditor.dbId,
      schema: this.props.queryEditor.schema,
      json: true,
    };
    this.props.actions.startQuery(query);
    $.ajax({
      type: 'POST',
      dataType: 'json',
      url,
      data,
      success(results) {
        try {
          that.props.actions.querySuccess(query, results);
        } catch (e) {
          that.props.actions.queryFailed(query, e);
        }
      },
      error(err) {
        let msg = '';
        try {
          msg = err.responseJSON.error;
        } catch (e) {
          msg = (err.responseText) ? err.responseText : e;
        }
        that.props.actions.queryFailed(query, msg);
      },
    });
  }
  stopQuery() {
    this.props.actions.stopQuery(this.props.latestQuery);
  }
  textChange(text) {
    this.setState({ sql: text });
    this.props.actions.queryEditorSetSql(this.props.queryEditor, text);
  }
  addWorkspaceQuery() {
    this.props.actions.addWorkspaceQuery({
      id: shortid.generate(),
      sql: this.state.sql,
      dbId: this.props.queryEditor.dbId,
      schema: this.props.queryEditor.schema,
      title: this.props.queryEditor.title,
    });
  }
  ctasChange() {}
  visualize() {}
  render() {
    let runButtons = (
      <ButtonGroup className="inline m-r-5">
        <Button onClick={this.startQuery.bind(this)} disabled={!(this.props.queryEditor.dbId)}>
          <i className="fa fa-table" /> Run
        </Button>
      </ButtonGroup>
    );
    if (this.props.latestQuery && this.props.latestQuery.state === 'running') {
      runButtons = (
        <ButtonGroup className="inline m-r-5">
          <Button onClick={this.stopQuery.bind(this)}>
            <a className="fa fa-stop" /> Stop
          </Button>
        </ButtonGroup>
      );
    }
    const rightButtons = (
      <ButtonGroup className="inlineblock">
        <ButtonWithTooltip
          tooltip="Save this query in your workspace"
          placement="left"
          onClick={this.addWorkspaceQuery.bind(this)}
        >
          <i className="fa fa-save" />&nbsp;
        </ButtonWithTooltip>
        <DropdownButton id="ddbtn-export" pullRight title={<i className="fa fa-file-o" />}>
          <MenuItem
            onClick={this.notImplemented}
          >
            <i className="fa fa-file-text-o" /> export to .csv
          </MenuItem>
          <MenuItem
            onClick={this.notImplemented}
          >
            <i className="fa fa-file-code-o" /> export to .json
          </MenuItem>
        </DropdownButton>
      </ButtonGroup>
    );
    let limitWarning = null;
    const rowLimit = 1000;
    if (this.props.latestQuery && this.props.latestQuery.rows === rowLimit) {
      const tooltip = (
        <Tooltip id="tooltip">
          It appears that the number of rows in the query results displayed
          was limited on the server side to the {rowLimit} limit.
        </Tooltip>
      );
      limitWarning = (
        <OverlayTrigger placement="left" overlay={tooltip}>
          <Label bsStyle="warning" className="m-r-5">LIMIT</Label>
        </OverlayTrigger>
      );
    }
    const editorBottomBar = (
      <div className="clearfix sql-toolbar padded">
        <div className="pull-left">
          {runButtons}
          <span className="inlineblock valignTop" style={{ height: '20px' }}>
            <input type="text" className="form-control" placeholder="CREATE TABLE AS" />
          </span>
        </div>
        <div className="pull-right">
          {limitWarning}
          <Timer query={this.props.latestQuery} />
          {rightButtons}
        </div>
      </div>
    );
    return (
      <div className="SqlEditor">
        <div>
          <div>
            <SqlEditorTopToolbar queryEditor={this.props.queryEditor} />
            <AceEditor
              mode="sql"
              name={this.props.queryEditor.title}
              theme="github"
              minLines={5}
              maxLines={30}
              onChange={this.textChange.bind(this)}
              height="200px"
              width="100%"
              editorProps={{ $blockScrolling: true }}
              enableBasicAutocompletion
              value={this.props.queryEditor.sql}
            />
            {editorBottomBar}
            <div className="padded">
              <SouthPane latestQuery={this.props.latestQuery} sqlEditor={this} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

SqlEditor.propTypes = {
  queryEditor: React.PropTypes.object,
  actions: React.PropTypes.object,
  latestQuery: React.PropTypes.object,
};

SqlEditor.defaultProps = {
};

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(SqlEditor);
