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
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import Split from 'react-split';
import { t } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

import Label from 'src/components/Label';
import Button from 'src/components/Button';
import Checkbox from 'src/components/Checkbox';
import Timer from 'src/components/Timer';
import Hotkeys from 'src/components/Hotkeys';

import LimitControl from './LimitControl';
import TemplateParamsEditor from './TemplateParamsEditor';
import ConnectedSouthPane from './SouthPane';
import SaveQuery from './SaveQuery';
import ScheduleQueryButton from './ScheduleQueryButton';
import EstimateQueryCostButton from './EstimateQueryCostButton';
import ShareSqlLabQuery from './ShareSqlLabQuery';
import SqlEditorLeftBar from './SqlEditorLeftBar';
import AceEditorWrapper from './AceEditorWrapper';
import {
  STATE_BSSTYLE_MAP,
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
} from '../constants';
import RunQueryActionButton from './RunQueryActionButton';
import { FeatureFlag, isFeatureEnabled } from '../../featureFlags';
import { CtasEnum } from '../actions/sqlLab';

const SQL_EDITOR_PADDING = 10;
const INITIAL_NORTH_PERCENT = 30;
const INITIAL_SOUTH_PERCENT = 70;
const SET_QUERY_EDITOR_SQL_DEBOUNCE_MS = 2000;
const VALIDATION_DEBOUNCE_MS = 600;
const WINDOW_RESIZE_THROTTLE_MS = 100;

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
  displayLimit: PropTypes.number.isRequired,
  saveQueryWarning: PropTypes.string,
  scheduleQueryWarning: PropTypes.string,
};

const defaultProps = {
  database: null,
  latestQuery: null,
  hideLeftBar: false,
  scheduleQueryWarning: null,
};

class SqlEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      autorun: props.queryEditor.autorun,
      ctas: '',
      northPercent: props.queryEditor.northPercent || INITIAL_NORTH_PERCENT,
      southPercent: props.queryEditor.southPercent || INITIAL_SOUTH_PERCENT,
      sql: props.queryEditor.sql,
      autocompleteEnabled: true,
    };
    this.sqlEditorRef = React.createRef();
    this.northPaneRef = React.createRef();

    this.elementStyle = this.elementStyle.bind(this);
    this.onResizeStart = this.onResizeStart.bind(this);
    this.onResizeEnd = this.onResizeEnd.bind(this);
    this.canValidateQuery = this.canValidateQuery.bind(this);
    this.runQuery = this.runQuery.bind(this);
    this.stopQuery = this.stopQuery.bind(this);
    this.onSqlChanged = this.onSqlChanged.bind(this);
    this.setQueryEditorSql = this.setQueryEditorSql.bind(this);
    this.setQueryEditorSqlWithDebounce = debounce(
      this.setQueryEditorSql.bind(this),
      SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
    );
    this.queryPane = this.queryPane.bind(this);
    this.getAceEditorAndSouthPaneHeights = this.getAceEditorAndSouthPaneHeights.bind(
      this,
    );
    this.getSqlEditorHeight = this.getSqlEditorHeight.bind(this);
    this.requestValidation = debounce(
      this.requestValidation.bind(this),
      VALIDATION_DEBOUNCE_MS,
    );
    this.getQueryCostEstimate = this.getQueryCostEstimate.bind(this);
    this.handleWindowResize = throttle(
      this.handleWindowResize.bind(this),
      WINDOW_RESIZE_THROTTLE_MS,
    );
  }

  UNSAFE_componentWillMount() {
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

    window.addEventListener('resize', this.handleWindowResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize);
  }

  onResizeStart() {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    document.getElementsByClassName('ace_content')[0].style.height = '100%';
  }

  onResizeEnd([northPercent, southPercent]) {
    this.setState({ northPercent, southPercent });

    if (this.northPaneRef.current && this.northPaneRef.current.clientHeight) {
      this.props.actions.persistEditorHeight(
        this.props.queryEditor,
        northPercent,
        southPercent,
      );
    }
  }

  onSqlChanged(sql) {
    this.setState({ sql });
    this.setQueryEditorSqlWithDebounce(sql);
    // Request server-side validation of the query text
    if (this.canValidateQuery()) {
      // NB. requestValidation is debounced
      this.requestValidation();
    }
  }

  // One layer of abstraction for easy spying in unit tests
  getSqlEditorHeight() {
    return this.sqlEditorRef.current
      ? this.sqlEditorRef.current.clientHeight - SQL_EDITOR_PADDING * 2
      : 0;
  }

  // Return the heights for the ace editor and the south pane as an object
  // given the height of the sql editor, north pane percent and south pane percent.
  getAceEditorAndSouthPaneHeights(height, northPercent, southPercent) {
    return {
      aceEditorHeight:
        (height * northPercent) / 100 -
        (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN) -
        SQL_TOOLBAR_HEIGHT,
      southPaneHeight:
        (height * southPercent) / 100 -
        (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN),
    };
  }

  getHotkeyConfig() {
    return [
      {
        name: 'runQuery1',
        key: 'ctrl+r',
        descr: t('Run query'),
        func: this.runQuery,
      },
      {
        name: 'runQuery2',
        key: 'ctrl+enter',
        descr: t('Run query'),
        func: this.runQuery,
      },
      {
        name: 'newTab',
        key: 'ctrl+t',
        descr: t('New tab'),
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
        descr: t('Stop query'),
        func: this.stopQuery,
      },
    ];
  }

  setQueryEditorSql(sql) {
    this.props.actions.queryEditorSetSql(this.props.queryEditor, sql);
  }

  setQueryLimit(queryLimit) {
    this.props.actions.queryEditorSetQueryLimit(
      this.props.queryEditor,
      queryLimit,
    );
  }

  getQueryCostEstimate() {
    if (this.props.database) {
      const qe = this.props.queryEditor;
      const query = {
        dbId: qe.dbId,
        sql: qe.selectedText ? qe.selectedText : this.state.sql,
        sqlEditorId: qe.id,
        schema: qe.schema,
        templateParams: qe.templateParams,
      };
      this.props.actions.estimateQueryCost(query);
    }
  }

  handleToggleAutocompleteEnabled = () => {
    this.setState(prevState => ({
      autocompleteEnabled: !prevState.autocompleteEnabled,
    }));
  };

  handleWindowResize() {
    this.setState({ height: this.getSqlEditorHeight() });
  }

  elementStyle(dimension, elementSize, gutterSize) {
    return {
      [dimension]: `calc(${elementSize}% - ${
        gutterSize + SQL_EDITOR_GUTTER_MARGIN
      }px)`,
    };
  }

  requestValidation() {
    if (this.props.database) {
      const qe = this.props.queryEditor;
      const query = {
        dbId: qe.dbId,
        sql: this.state.sql,
        sqlEditorId: qe.id,
        schema: qe.schema,
        templateParams: qe.templateParams,
      };
      this.props.actions.validateQuery(query);
    }
  }

  canValidateQuery() {
    // Check whether or not we can validate the current query based on whether
    // or not the backend has a validator configured for it.
    const validatorMap = window.featureFlags.SQL_VALIDATORS_BY_ENGINE;
    if (this.props.database && validatorMap != null) {
      return validatorMap.hasOwnProperty(this.props.database.backend);
    }
    return false;
  }

  runQuery() {
    if (this.props.database) {
      this.startQuery();
    }
  }

  startQuery(ctas = false, ctas_method = CtasEnum.TABLE) {
    const qe = this.props.queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : this.state.sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTable: ctas ? this.state.ctas : '',
      templateParams: qe.templateParams,
      queryLimit: qe.queryLimit || this.props.defaultQueryLimit,
      runAsync: this.props.database
        ? this.props.database.allow_run_async
        : false,
      ctas,
      ctas_method,
      updateTabState: !qe.selectedText,
    };
    this.props.actions.runQuery(query);
    this.props.actions.setActiveSouthPaneTab('Results');
  }

  stopQuery() {
    if (
      this.props.latestQuery &&
      ['running', 'pending'].indexOf(this.props.latestQuery.state) >= 0
    ) {
      this.props.actions.postStopQuery(this.props.latestQuery);
    }
  }

  createTableAs() {
    this.startQuery(true, CtasEnum.TABLE);
  }

  createViewAs() {
    this.startQuery(true, CtasEnum.VIEW);
  }

  ctasChanged(event) {
    this.setState({ ctas: event.target.value });
  }

  queryPane() {
    const hotkeys = this.getHotkeyConfig();
    const {
      aceEditorHeight,
      southPaneHeight,
    } = this.getAceEditorAndSouthPaneHeights(
      this.state.height,
      this.state.northPercent,
      this.state.southPercent,
    );
    return (
      <Split
        expandToMin
        className="queryPane"
        sizes={[this.state.northPercent, this.state.southPercent]}
        elementStyle={this.elementStyle}
        minSize={200}
        direction="vertical"
        gutterSize={SQL_EDITOR_GUTTER_HEIGHT}
        onDragStart={this.onResizeStart}
        onDragEnd={this.onResizeEnd}
      >
        <div ref={this.northPaneRef} className="north-pane">
          <AceEditorWrapper
            actions={this.props.actions}
            autocomplete={this.state.autocompleteEnabled}
            onBlur={this.setQueryEditorSql}
            onChange={this.onSqlChanged}
            queryEditor={this.props.queryEditor}
            sql={this.props.queryEditor.sql}
            schemas={this.props.queryEditor.schemaOptions}
            tables={this.props.queryEditor.tableOptions}
            functionNames={
              this.props.database ? this.props.database.function_names : []
            }
            extendedTables={this.props.tables}
            height={`${aceEditorHeight}px`}
            hotkeys={hotkeys}
          />
          {this.renderEditorBottomBar(hotkeys)}
        </div>
        <ConnectedSouthPane
          editorQueries={this.props.editorQueries}
          latestQueryId={this.props.latestQuery && this.props.latestQuery.id}
          dataPreviewQueries={this.props.dataPreviewQueries}
          actions={this.props.actions}
          height={southPaneHeight}
          displayLimit={this.props.displayLimit}
        />
      </Split>
    );
  }

  renderEditorBottomBar(hotkeys) {
    let ctasControls;
    if (
      this.props.database &&
      (this.props.database.allow_ctas || this.props.database.allow_cvas)
    ) {
      const ctasToolTip = t('Create table as with query results');
      const cvasToolTip = t('Create view as with query results');

      ctasControls = (
        <FormGroup>
          <InputGroup bsSize="small">
            <FormControl
              type="text"
              bsSize="small"
              className="input-sm"
              placeholder={t('new table name')}
              onChange={this.ctasChanged.bind(this)}
            />
            <InputGroup.Button>
              {this.props.database.allow_ctas && (
                <Button
                  buttonSize="small"
                  disabled={this.state.ctas.length === 0}
                  onClick={this.createTableAs.bind(this)}
                  tooltip={ctasToolTip}
                >
                  <i className="fa fa-table" /> CTAS
                </Button>
              )}
              {this.props.database.allow_cvas && (
                <Button
                  buttonSize="small"
                  disabled={this.state.ctas.length === 0}
                  onClick={this.createViewAs.bind(this)}
                  tooltip={cvasToolTip}
                >
                  <i className="fa fa-table" /> CVAS
                </Button>
              )}
            </InputGroup.Button>
          </InputGroup>
        </FormGroup>
      );
    }
    const qe = this.props.queryEditor;
    let limitWarning = null;
    if (
      this.props.latestQuery &&
      this.props.latestQuery.results &&
      this.props.latestQuery.results.displayLimitReached
    ) {
      const tooltip = (
        <Tooltip id="tooltip">
          {t(
            `It appears that the number of rows in the query results displayed
           was limited on the server side to
           the %s limit.`,
            this.props.latestQuery.rows,
          )}
        </Tooltip>
      );
      limitWarning = (
        <OverlayTrigger placement="left" overlay={tooltip}>
          <Label bsStyle="warning">LIMIT</Label>
        </OverlayTrigger>
      );
    }
    const successful =
      this.props.latestQuery && this.props.latestQuery.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');
    return (
      <div className="sql-toolbar" id="js-sql-toolbar">
        <div className="leftItems">
          <Form inline>
            <span>
              <RunQueryActionButton
                allowAsync={
                  this.props.database
                    ? this.props.database.allow_run_async
                    : false
                }
                dbId={qe.dbId}
                queryState={
                  this.props.latestQuery && this.props.latestQuery.state
                }
                runQuery={this.runQuery}
                selectedText={qe.selectedText}
                stopQuery={this.stopQuery}
                sql={this.state.sql}
              />
            </span>
            {isFeatureEnabled(FeatureFlag.ESTIMATE_QUERY_COST) &&
              this.props.database &&
              this.props.database.allows_cost_estimate && (
                <span>
                  <EstimateQueryCostButton
                    dbId={qe.dbId}
                    schema={qe.schema}
                    sql={qe.sql}
                    getEstimate={this.getQueryCostEstimate}
                    queryCostEstimate={qe.queryCostEstimate}
                    selectedText={qe.selectedText}
                    tooltip={t('Estimate the cost before running a query')}
                  />
                </span>
              )}
            {isFeatureEnabled(FeatureFlag.SCHEDULED_QUERIES) && (
              <span>
                <ScheduleQueryButton
                  defaultLabel={qe.title}
                  sql={qe.sql}
                  onSchedule={this.props.actions.scheduleQuery}
                  schema={qe.schema}
                  dbId={qe.dbId}
                  scheduleQueryWarning={this.props.scheduleQueryWarning}
                  tooltip={scheduleToolTip}
                  disabled={!successful}
                />
              </span>
            )}
            <span>
              <SaveQuery
                query={qe}
                defaultLabel={qe.title || qe.description}
                onSave={this.props.actions.saveQuery}
                onUpdate={this.props.actions.updateSavedQuery}
                saveQueryWarning={this.props.saveQueryWarning}
              />
            </span>
            <span>
              <ShareSqlLabQuery queryEditor={qe} />
            </span>
            {ctasControls && <span>{ctasControls}</span>}
            <span>
              <LimitControl
                value={
                  this.props.queryEditor.queryLimit !== undefined
                    ? this.props.queryEditor.queryLimit
                    : this.props.defaultQueryLimit
                }
                defaultQueryLimit={this.props.defaultQueryLimit}
                maxRow={this.props.maxRow}
                onChange={this.setQueryLimit.bind(this)}
              />
            </span>
            <span>
              <Hotkeys header={t('Keyboard shortcuts')} hotkeys={hotkeys} />
            </span>
          </Form>
        </div>
        <div className="rightItems">
          <Button
            data-test="autocomplete"
            buttonSize="small"
            onClick={this.handleToggleAutocompleteEnabled}
          >
            <Checkbox checked={this.state.autocompleteEnabled} />{' '}
            {t('Autocomplete')}
          </Button>{' '}
          <TemplateParamsEditor
            language="json"
            onChange={params => {
              this.props.actions.queryEditorSetTemplateParams(qe, params);
            }}
            code={qe.templateParams}
          />
          {limitWarning}
          {this.props.latestQuery && (
            <Timer
              startTime={this.props.latestQuery.startDttm}
              endTime={this.props.latestQuery.endDttm}
              state={STATE_BSSTYLE_MAP[this.props.latestQuery.state]}
              isRunning={this.props.latestQuery.state === 'running'}
            />
          )}
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
