/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React from 'react';
import { CSSTransition } from 'react-transition-group';
import PropTypes from 'prop-types';
import {
  FormGroup,
  InputGroup,
  Form,
  FormControl,
  Label,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import Split from 'react-split';
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';
import LimitControl from './LimitControl';
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

const SQL_TOOLBAR_HEIGHT = 51;
const GUTTER_HEIGHT = 5;
const INITIAL_NORTH_PERCENT = 30;
const INITIAL_SOUTH_PERCENT = 70;

const propTypes = {
  actions: PropTypes.object.isRequired,
  database: PropTypes.object,
  latestQuery: PropTypes.object,
  tables: PropTypes.array.isRequired,
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  queryEditor: PropTypes.object.isRequired,
  hideLeftBar: PropTypes.bool,
  defaultQueryLimit: PropTypes.number.isRequired,
  maxRow: PropTypes.number.isRequired,
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
    this.sqlEditorRef = React.createRef();
    this.northPaneRef = React.createRef();

    this.onResizeStart = this.onResizeStart.bind(this);
    this.onResizeEnd = this.onResizeEnd.bind(this);
    this.runQuery = this.runQuery.bind(this);
    this.stopQuery = this.stopQuery.bind(this);
    this.onSqlChanged = this.onSqlChanged.bind(this);
    this.setQueryEditorSql = this.setQueryEditorSql.bind(this);
    this.queryPane = this.queryPane.bind(this);
    this.getAceEditorAndSouthPaneHeights = this.getAceEditorAndSouthPaneHeights.bind(this);
    this.getSqlEditorHeight = this.getSqlEditorHeight.bind(this);
  }
  componentWillMount() {
    if (this.state.autorun) {
      this.setState({ autorun: false });
      this.props.actions.queryEditorSetAutorun(this.props.queryEditor, false);
      this.startQuery();
    }
  }
  componentDidMount() {
    // We need to measure the height of the sql editor post render to figure the height of
    // the south pane so it gets rendered properly
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({ height: this.getSqlEditorHeight() });
  }
  onResizeStart() {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    document.getElementById('brace-editor').style.height = `calc(100% - ${SQL_TOOLBAR_HEIGHT}px)`;
    document.getElementsByClassName('ace_content')[0].style.height = '100%';
  }
  onResizeEnd([northPercent, southPercent]) {
    this.setState(this.getAceEditorAndSouthPaneHeights(
      this.state.height, northPercent, southPercent));

    if (this.northPaneRef.current && this.northPaneRef.current.clientHeight) {
      this.props.actions.persistEditorHeight(this.props.queryEditor,
        this.northPaneRef.current.clientHeight);
    }
  }
  onSqlChanged(sql) {
    this.setState({ sql });
  }
  // One layer of abstraction for easy spying in unit tests
  getSqlEditorHeight() {
    return this.sqlEditorRef.current ? this.sqlEditorRef.current.clientHeight : 0;
  }
  // Return the heights for the ace editor and the south pane as an object
  // given the height of the sql editor, north pane percent and south pane percent.
  getAceEditorAndSouthPaneHeights(height, northPercent, southPercent) {
    return {
      aceEditorHeight: height * northPercent / 100 - SQL_TOOLBAR_HEIGHT - GUTTER_HEIGHT / 2,
      southPaneHeight: height * southPercent / 100,
    };
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
  setQueryLimit(queryLimit) {
    this.props.actions.queryEditorSetQueryLimit(this.props.queryEditor, queryLimit);
  }
  runQuery() {
    if (this.props.database) {
      this.startQuery(this.props.database.allow_run_async);
    }
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
      queryLimit: qe.queryLimit || this.props.defaultQueryLimit,
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
  queryPane() {
    const hotkeys = this.getHotkeyConfig();
    const { aceEditorHeight, southPaneHeight } = this.getAceEditorAndSouthPaneHeights(
      this.state.height, INITIAL_NORTH_PERCENT, INITIAL_SOUTH_PERCENT);
    return (
      <div className="queryPane">
        <Split
          sizes={[INITIAL_NORTH_PERCENT, INITIAL_SOUTH_PERCENT]}
          minSize={200}
          direction="vertical"
          gutterSize={GUTTER_HEIGHT}
          onDragStart={this.onResizeStart}
          onDragEnd={this.onResizeEnd}
        >
          <div ref={this.northPaneRef}>
            <AceEditorWrapper
              actions={this.props.actions}
              onBlur={this.setQueryEditorSql}
              onChange={this.onSqlChanged}
              queryEditor={this.props.queryEditor}
              sql={this.props.queryEditor.sql}
              tables={this.props.tables}
              height={`${this.state.aceEditorHeight || aceEditorHeight}px`}
              hotkeys={hotkeys}
            />
            {this.renderEditorBottomBar(hotkeys)}
          </div>
          <SouthPane
            editorQueries={this.props.editorQueries}
            dataPreviewQueries={this.props.dataPreviewQueries}
            actions={this.props.actions}
            height={this.state.southPaneHeight || southPaneHeight}
          />
        </Split>
      </div>
    );
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
      <div className="sql-toolbar" id="js-sql-toolbar">
        <div>
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
            <span className="m-r-5">
              {ctasControls}
            </span>
            <span className="inlineBlock m-r-5">
              <LimitControl
                value={(this.props.queryEditor.queryLimit !== undefined) ?
                  this.props.queryEditor.queryLimit : this.props.defaultQueryLimit}
                defaultQueryLimit={this.props.defaultQueryLimit}
                maxRow={this.props.maxRow}
                onChange={this.setQueryLimit.bind(this)}
              />
            </span>
            <span className="m-l-5">
              <Hotkeys
                header="Keyboard shortcuts"
                hotkeys={hotkeys}
              />
            </span>
          </Form>
        </div>
        <div>
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
    return (
      <div ref={this.sqlEditorRef} className="SqlEditor">
        <CSSTransition
          classNames="schemaPane"
          in={!this.props.hideLeftBar}
          timeout={300}
        >
          <div className="schemaPane">
            <SqlEditorLeftBar
              database={this.props.database}
              queryEditor={this.props.queryEditor}
              tables={this.props.tables}
              actions={this.props.actions}
            />
          </div>
        </CSSTransition>
        {this.queryPane()}
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

export default SqlEditor;
