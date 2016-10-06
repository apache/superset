const $ = require('jquery');
import { now } from '../../modules/dates';
import React from 'react';
import {
  Button,
  ButtonGroup,
  Col,
  FormGroup,
  InputGroup,
  Form,
  FormControl,
  Label,
  OverlayTrigger,
  Row,
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
import SouthPane from './SouthPane';
import Timer from './Timer';

import SqlEditorTopToolbar from './SqlEditorTopToolbar';

class SqlEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      autorun: props.queryEditor.autorun,
      sql: props.queryEditor.sql,
      ctas: '',
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
  runQuery(runAsync = false) {
    this.startQuery(runAsync);
  }
  startQuery(runAsync = false, ctas = false) {
    const that = this;
    const query = {
      dbId: this.props.queryEditor.dbId,
      id: shortid.generate(),
      progress: 0,
      sql: this.props.queryEditor.sql,
      sqlEditorId: this.props.queryEditor.id,
      startDttm: now(),
      state: 'running',
      tab: this.props.queryEditor.title,
    };
    if (runAsync) {
      query.state = 'pending';
    }

    // Execute the Query
    that.props.actions.startQuery(query);

    const sqlJsonUrl = '/caravel/sql_json/';
    const sqlJsonRequest = {
      client_id: query.id,
      database_id: this.props.queryEditor.dbId,
      json: true,
      runAsync,
      schema: this.props.queryEditor.schema,
      select_as_cta: ctas,
      sql: this.props.queryEditor.sql,
      sql_editor_id: this.props.queryEditor.id,
      tab: this.props.queryEditor.title,
      tmp_table_name: this.state.ctas,
    };
    $.ajax({
      type: 'POST',
      dataType: 'json',
      url: sqlJsonUrl,
      data: sqlJsonRequest,
      success(results) {
        if (!runAsync) {
          that.props.actions.querySuccess(query, results);
        }
      },
      error(err, textStatus, errorThrown) {
        let msg;
        try {
          msg = err.responseJSON.error;
        } catch (e) {
          if (err.responseText !== undefined) {
            msg = err.responseText;
          }
        }
        if (textStatus === 'error' && errorThrown === '') {
          msg = 'Could not connect to server';
        } else if (msg === null) {
          msg = `[${textStatus}] ${errorThrown}`;
        }
        that.props.actions.queryFailed(query, msg);
      },
    });
  }
  stopQuery() {
    this.props.actions.stopQuery(this.props.latestQuery);
  }
  createTableAs() {
    this.startQuery(true, true);
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
  ctasChanged(event) {
    this.setState({ ctas: event.target.value });
  }

  sqlEditorHeight() {
    // quick hack to make the white bg of the tab stretch full height.
    const tabNavHeight = 40;
    const navBarHeight = 56;
    const mysteryVerticalHeight = 50;
    return window.innerHeight - tabNavHeight - navBarHeight - mysteryVerticalHeight;
  }

  render() {
    let runButtons = [];
    if (this.props.database && this.props.database.allow_run_sync) {
      runButtons.push(
        <Button
          bsSize="small"
          bsStyle="primary"
          style={{ width: '100px' }}
          onClick={this.runQuery.bind(this, false)}
          disabled={!(this.props.queryEditor.dbId)}
          key={shortid.generate()}
        >
          <i className="fa fa-table" /> Run Query
        </Button>
      );
    }
    if (this.props.database && this.props.database.allow_run_async) {
      runButtons.push(
        <Button
          bsSize="small"
          bsStyle="primary"
          style={{ width: '100px' }}
          onClick={this.runQuery.bind(this, true)}
          disabled={!(this.props.queryEditor.dbId)}
          key={shortid.generate()}
        >
          <i className="fa fa-table" /> Run Async
        </Button>
      );
    }
    runButtons = (
      <ButtonGroup bsSize="small" className="inline m-r-5 pull-left">
        {runButtons}
      </ButtonGroup>
    );
    if (this.props.latestQuery && this.props.latestQuery.state === 'running') {
      runButtons = (
        <ButtonGroup bsSize="small" className="inline m-r-5 pull-left">
          <Button
            bsStyle="primary"
            bsSize="small"
            style={{ width: '100px' }}
            onClick={this.stopQuery.bind(this)}
          >
            <a className="fa fa-stop" /> Stop
          </Button>
        </ButtonGroup>
      );
    }
    let limitWarning = null;
    if (this.props.latestQuery && this.props.latestQuery.limit_reached) {
      const tooltip = (
        <Tooltip id="tooltip">
          It appears that the number of rows in the query results displayed
          was limited on the server side to
          the {this.props.latestQuery.rows} limit.
        </Tooltip>
      );
      limitWarning = (
        <OverlayTrigger placement="left" overlay={tooltip}>
          <Label bsStyle="warning" className="m-r-5">LIMIT</Label>
        </OverlayTrigger>
      );
    }
    let ctasControls;
    if (this.props.database && this.props.database.allow_ctas) {
      ctasControls = (
        <FormGroup>
          <InputGroup>
            <FormControl
              type="text"
              bsSize="small"
              className="input-sm"
              placeholder="new table name"
              onChange={this.ctasChanged.bind(this)}
            />
            <InputGroup.Button>
              <Button
                bsSize="small"
                disabled={this.state.ctas.length === 0}
                onClick={this.createTableAs.bind(this)}
              >
                <i className="fa fa-table" /> CTAS
              </Button>
            </InputGroup.Button>
          </InputGroup>
        </FormGroup>
      );
    }
    const editorBottomBar = (
      <div className="sql-toolbar clearfix">
        <div className="pull-left">
          <Form inline>
            {runButtons}
            {ctasControls}
          </Form>
        </div>
        <div className="pull-right">
          {limitWarning}
          <Timer query={this.props.latestQuery} />
        </div>
      </div>
    );
    return (
      <div className="SqlEditor" style={{ minHeight: this.sqlEditorHeight() }}>
        <Row>
          <Col md={3}>
            <SqlEditorTopToolbar queryEditor={this.props.queryEditor} />
          </Col>
          <Col md={9}>
            <AceEditor
              mode="sql"
              name={this.props.queryEditor.id}
              theme="github"
              minLines={7}
              maxLines={30}
              onChange={this.textChange.bind(this)}
              height="200px"
              width="100%"
              editorProps={{ $blockScrolling: true }}
              enableBasicAutocompletion
              value={this.props.queryEditor.sql}
            />
            {editorBottomBar}
            <br />
            <SouthPane latestQuery={this.props.latestQuery} sqlEditor={this} />
          </Col>
        </Row>
      </div>
    );
  }
}

SqlEditor.propTypes = {
  actions: React.PropTypes.object,
  database: React.PropTypes.object,
  latestQuery: React.PropTypes.object,
  queryEditor: React.PropTypes.object,
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
