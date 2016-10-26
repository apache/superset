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

import shortid from 'shortid';
import SouthPane from './SouthPane';
import Timer from './Timer';

import SqlEditorLeftBar from './SqlEditorLeftBar';

const propTypes = {
  actions: React.PropTypes.object.isRequired,
  database: React.PropTypes.object,
  latestQuery: React.PropTypes.object,
  networkOn: React.PropTypes.bool,
  tables: React.PropTypes.array.isRequired,
  queries: React.PropTypes.array.isRequired,
  queryEditor: React.PropTypes.object.isRequired,
};

const defaultProps = {
  networkOn: true,
  database: null,
  latestQuery: null,
};


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
    const query = {
      dbId: this.props.queryEditor.dbId,
      sql: this.props.queryEditor.sql,
      sqlEditorId: this.props.queryEditor.id,
      tab: this.props.queryEditor.title,
      schema: this.props.queryEditor.schema,
      tempTableName: this.state.ctas,
      runAsync,
      ctas,
    };
    this.props.actions.runQuery(query);
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
    if (
        this.props.latestQuery &&
        ['running', 'pending'].indexOf(this.props.latestQuery.state) > -1) {
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
            <SqlEditorLeftBar
              queryEditor={this.props.queryEditor}
              tables={this.props.tables}
              networkOn={this.props.networkOn}
              actions={this.props.actions}
            />
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
            <SouthPane
              queries={this.props.queries}
              actions={this.props.actions}
            />
          </Col>
        </Row>
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
