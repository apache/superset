import React from 'react';
import PropTypes from 'prop-types';
import { throttle } from 'lodash';
import {
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
import SplitPane from 'react-split-pane';
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';
import TemplateParamsEditor from './TemplateParamsEditor';
import SouthPane from './SouthPane';
import SaveQuery from './SaveQuery';
import ShareSqlLabQuery from './ShareSqlLabQuery';
import Timer from '../../components/Timer';
import Hotkeys from '../../components/Hotkeys';
import SqlEditorLeftBar from './SqlEditorLeftBar';
import AceEditorWrapper from './AceEditorWrapper';
import { STATE_BSSTYLE_MAP } from '../constants';
import RunQueryActionButton from './RunQueryActionButton';

const propTypes = {
  actions: PropTypes.object.isRequired,
  getHeight: PropTypes.func.isRequired,
  database: PropTypes.object,
  latestQuery: PropTypes.object,
  tables: PropTypes.array.isRequired,
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  queryEditor: PropTypes.object.isRequired,
  hideLeftBar: PropTypes.bool,
};

const defaultProps = {
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
      sql: props.queryEditor.sql,
    };

    this.onResize = this.onResize.bind(this);
    this.throttledResize = throttle(this.onResize, 250);
    this.runQuery = this.runQuery.bind(this);
    this.stopQuery = this.stopQuery.bind(this);
    this.onSqlChanged = this.onSqlChanged.bind(this);
    this.setQueryEditorSql = this.setQueryEditorSql.bind(this);
  }
  componentWillMount() {
    if (this.state.autorun) {
      this.setState({ autorun: false });
      this.props.actions.queryEditorSetAutorun(this.props.queryEditor, false);
      this.startQuery();
    }
  }
  componentDidMount() {
    this.onResize();
    window.addEventListener('resize', this.throttledResize);
  }
  componentWillUnmount() {
    window.removeEventListener('resize', this.throttledResize);
  }
  onResize() {
    const height = this.sqlEditorHeight();
    const editorPaneHeight = this.props.queryEditor.height || 200;
    const splitPaneHandlerHeight = 15;
    this.setState({
      editorPaneHeight,
      southPaneHeight: height - editorPaneHeight - splitPaneHandlerHeight,
      height,
    });

    if (this.refs.ace && this.refs.ace.clientHeight) {
      this.props.actions.persistEditorHeight(this.props.queryEditor, this.refs.ace.clientHeight);
    }
  }
  onSqlChanged(sql) {
    this.setState({ sql });
  }
  getHotkeyConfig() {
    return [
      {
        name: 'runQuery1',
        key: 'ctrl+r',
        descr: 'Run query',
        func: this.runQuery,
      },
      {
        name: 'runQuery2',
        key: 'ctrl+enter',
        descr: 'Run query',
        func: this.runQuery,
      },
      {
        name: 'newTab',
        key: 'ctrl+t',
        descr: 'New tab',
        func: () => {
          this.props.actions.addQueryEditor({
            ...this.props.queryEditor,
            title: t('Untitled Query'),
            sql: '',
          });
        },
      },
      {
        name: 'stopQuery',
        key: 'ctrl+x',
        descr: 'Stop query',
        func: this.stopQuery,
      },
    ];
  }
  setQueryEditorSql(sql) {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, sql);
  }
  runQuery() {
    this.startQuery(!(this.props.database || {}).allow_run_sync);
  }
  startQuery(runAsync = false, ctas = false) {
    const qe = this.props.queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : this.state.sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTableName: ctas ? this.state.ctas : '',
      templateParams: qe.templateParams,
      runAsync,
      ctas,
    };
    this.props.actions.runQuery(query);
    this.props.actions.setActiveSouthPaneTab('Results');
  }
  stopQuery() {
    if (this.props.latestQuery && ['running', 'pending'].indexOf(this.props.latestQuery.state) >= 0) {
      this.props.actions.postStopQuery(this.props.latestQuery);
    }
  }
  createTableAs() {
    this.startQuery(true, true);
  }
  ctasChanged(event) {
    this.setState({ ctas: event.target.value });
  }
  sqlEditorHeight() {
    const horizontalScrollbarHeight = 25;
    return parseInt(this.props.getHeight(), 10) - horizontalScrollbarHeight;
  }
  renderEditorBottomBar(hotkeys) {
    let ctasControls;
    if (this.props.database && this.props.database.allow_ctas) {
      const ctasToolTip = t('Create table as with query results');
      ctasControls = (
        <FormGroup>
          <InputGroup>
            <FormControl
              type="text"
              bsSize="small"
              className="input-sm"
              placeholder={t('new table name')}
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
    const qe = this.props.queryEditor;
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
    return (
      <div className="sql-toolbar clearfix" id="js-sql-toolbar">
        <div className="pull-left">
          <Form inline>
            <span className="m-r-5">
              <RunQueryActionButton
                allowAsync={this.props.database ? this.props.database.allow_run_async : false}
                dbId={qe.dbId}
                queryState={this.props.latestQuery && this.props.latestQuery.state}
                runQuery={this.runQuery}
                selectedText={qe.selectedText}
                stopQuery={this.stopQuery}
                sql={this.state.sql}
              />
            </span>
            <span className="m-r-5">
              <SaveQuery
                defaultLabel={qe.title}
                sql={qe.sql}
                className="m-r-5"
                onSave={this.props.actions.saveQuery}
                schema={qe.schema}
                dbId={qe.dbId}
              />
            </span>
            <span className="m-r-5">
              <ShareSqlLabQuery queryEditor={qe} />
            </span>
            {ctasControls}
            <span className="m-l-5">
              <Hotkeys
                header="Keyboard shortcuts"
                hotkeys={hotkeys}
              />
            </span>
          </Form>
        </div>
        <div className="pull-right">
          <TemplateParamsEditor
            language="json"
            onChange={(params) => {
              this.props.actions.queryEditorSetTemplateParams(qe, params);
            }}
            code={qe.templateParams}
          />
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
  }
  render() {
    const height = this.sqlEditorHeight();
    const defaultNorthHeight = this.props.queryEditor.height || 200;
    const hotkeys = this.getHotkeyConfig();
    return (
      <div
        className="SqlEditor"
        style={{
          height: height + 'px',
        }}
      >
        <Row>
          <Collapse
            in={!this.props.hideLeftBar}
          >
            <Col
              xs={6}
              sm={5}
              md={4}
              lg={3}
            >
              <SqlEditorLeftBar
                height={height}
                database={this.props.database}
                queryEditor={this.props.queryEditor}
                tables={this.props.tables}
                actions={this.props.actions}
              />
            </Col>
          </Collapse>
          <Col
            xs={this.props.hideLeftBar ? 12 : 6}
            sm={this.props.hideLeftBar ? 12 : 7}
            md={this.props.hideLeftBar ? 12 : 8}
            lg={this.props.hideLeftBar ? 12 : 9}
            style={{ height: this.state.height }}
          >
            <SplitPane
              split="horizontal"
              defaultSize={defaultNorthHeight}
              minSize={100}
              onChange={this.onResize}
            >
              <div ref="ace" style={{ width: '100%' }}>
                <div>
                  <AceEditorWrapper
                    actions={this.props.actions}
                    onBlur={this.setQueryEditorSql}
                    onChange={this.onSqlChanged}
                    queryEditor={this.props.queryEditor}
                    sql={this.props.queryEditor.sql}
                    tables={this.props.tables}
                    height={((this.state.editorPaneHeight || defaultNorthHeight) - 50) + 'px'}
                    hotkeys={hotkeys}
                  />
                  {this.renderEditorBottomBar(hotkeys)}
                </div>
              </div>
              <div ref="south">
                <SouthPane
                  editorQueries={this.props.editorQueries}
                  dataPreviewQueries={this.props.dataPreviewQueries}
                  actions={this.props.actions}
                  height={this.state.southPaneHeight || 0}
                />
              </div>
            </SplitPane>
          </Col>
        </Row>
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
