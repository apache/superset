import React from 'react';
import {
  Button as BootstrapButton,
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
  Collapse,
} from 'react-bootstrap';

import Button from '../../components/Button';

import SouthPane from './SouthPane';
import Timer from '../../components/Timer';
import SqlEditorLeftBar from './SqlEditorLeftBar';
import AceEditorWrapper from './AceEditorWrapper';
import { STATE_BSSTYLE_MAP } from '../constants.js';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  height: React.PropTypes.string.isRequired,
  database: React.PropTypes.object,
  latestQuery: React.PropTypes.object,
  networkOn: React.PropTypes.bool,
  tables: React.PropTypes.array.isRequired,
  editorQueries: React.PropTypes.array.isRequired,
  dataPreviewQueries: React.PropTypes.array.isRequired,
  queryEditor: React.PropTypes.object.isRequired,
  hideLeftBar: React.PropTypes.bool,
};

const defaultProps = {
  networkOn: true,
  database: null,
  latestQuery: null,
  hideLeftBar: false,
};


class SqlEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      autorun: props.queryEditor.autorun,
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
    let effectiveRunAsync = runAsync;
    if (!this.props.database.allow_run_sync) {
      effectiveRunAsync = true;
    }
    this.startQuery(effectiveRunAsync);
  }
  startQuery(runAsync = false, ctas = false) {
    const qe = this.props.queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : qe.sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTableName: ctas ? this.state.ctas : '',
      runAsync,
      ctas,
    };
    this.props.actions.runQuery(query);
    this.props.actions.setActiveSouthPaneTab('Results');
  }
  stopQuery() {
    this.props.actions.stopQuery(this.props.latestQuery);
  }
  createTableAs() {
    this.startQuery(true, true);
  }
  setQueryEditorSql(sql) {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, sql);
  }
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
    let runText = 'Run Query';
    let btnStyle = 'primary';
    if (this.props.queryEditor.selectedText) {
      runText = 'Run Selection';
      btnStyle = 'warning';
    }
    if (this.props.database && this.props.database.allow_run_sync) {
      runButtons.push(
        <BootstrapButton
          bsSize="small"
          bsStyle={btnStyle}
          style={{ width: '100px' }}
          onClick={this.runQuery.bind(this, false)}
          disabled={!(this.props.queryEditor.dbId)}
          key="run-btn"
        >
          <i className="fa fa-table" /> {runText}
        </BootstrapButton>
      );
    }
    if (this.props.database && this.props.database.allow_run_async) {
      const asyncToolTip = 'Run query asynchronously';
      runButtons.push(
        <Button
          bsSize="small"
          bsStyle={btnStyle}
          style={{ width: '100px' }}
          onClick={this.runQuery.bind(this, true)}
          disabled={!(this.props.queryEditor.dbId)}
          key="run-async-btn"
          tooltip={asyncToolTip}
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
    if (
        this.props.latestQuery &&
        ['running', 'pending'].indexOf(this.props.latestQuery.state) > -1) {
      runButtons = (
        <ButtonGroup bsSize="small" className="inline m-r-5 pull-left">
          <BootstrapButton
            bsStyle="primary"
            bsSize="small"
            style={{ width: '100px' }}
            onClick={this.stopQuery.bind(this)}
          >
            <a className="fa fa-stop" /> Stop
          </BootstrapButton>
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
      const ctasToolTip = 'Create table as with query results';
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
                tooltip={ctasToolTip}
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
          {this.props.latestQuery &&
            <Timer
              startTime={this.props.latestQuery.startDttm}
              endTime={this.props.latestQuery.endDttm}
              state={STATE_BSSTYLE_MAP[this.props.latestQuery.state]}
              isRunning={this.props.latestQuery.state === 'running'}
            />
          }
        </div>
      </div>
    );
    return (
      <div
        className="SqlEditor"
        style={{
          minHeight: this.sqlEditorHeight(),
          height: this.props.height,
        }}
      >
        <Row>
          <Collapse
            in={!this.props.hideLeftBar}
          >
            <Col md={3}>
              <SqlEditorLeftBar
                style={{ height: this.props.height }}
                queryEditor={this.props.queryEditor}
                tables={this.props.tables}
                networkOn={this.props.networkOn}
                actions={this.props.actions}
              />
            </Col>
          </Collapse>
          <Col md={this.props.hideLeftBar ? 12 : 9}>
            <div className="scrollbar-container">
              <div className="scrollbar-content">
                <AceEditorWrapper
                  actions={this.props.actions}
                  onBlur={this.setQueryEditorSql.bind(this)}
                  queryEditor={this.props.queryEditor}
                  onAltEnter={this.runQuery.bind(this)}
                  sql={this.props.queryEditor.sql}
                  tables={this.props.tables}
                />
                {editorBottomBar}
                <br />
                <SouthPane
                  editorQueries={this.props.editorQueries}
                  dataPreviewQueries={this.props.dataPreviewQueries}
                  actions={this.props.actions}
                />
              </div>
            </div>
          </Col>
        </Row>
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
