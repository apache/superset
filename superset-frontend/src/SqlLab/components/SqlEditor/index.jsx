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
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import { CSSTransition } from 'react-transition-group';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';
import Split from 'react-split';
import { t, styled, withTheme } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import StyledModal from 'src/components/Modal';
import Mousetrap from 'mousetrap';
import Button from 'src/components/Button';
import Timer from 'src/components/Timer';
import { AntdDropdown, AntdSwitch } from 'src/components';
import { Input } from 'src/components/Input';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { detectOS } from 'src/utils/common';
import {
  addQueryEditor,
  CtasEnum,
  estimateQueryCost,
  persistEditorHeight,
  postStopQuery,
  queryEditorSetAutorun,
  queryEditorSetQueryLimit,
  queryEditorSetSql,
  queryEditorSetTemplateParams,
  runQuery,
  saveQuery,
  addSavedQueryToTabState,
  scheduleQuery,
  setActiveSouthPaneTab,
  updateSavedQuery,
  validateQuery,
} from 'src/SqlLab/actions/sqlLab';
import {
  STATE_TYPE_MAP,
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
} from 'src/SqlLab/constants';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import TemplateParamsEditor from '../TemplateParamsEditor';
import ConnectedSouthPane from '../SouthPane/state';
import SaveQuery from '../SaveQuery';
import ScheduleQueryButton from '../ScheduleQueryButton';
import EstimateQueryCostButton from '../EstimateQueryCostButton';
import ShareSqlLabQuery from '../ShareSqlLabQuery';
import SqlEditorLeftBar from '../SqlEditorLeftBar';
import AceEditorWrapper from '../AceEditorWrapper';
import RunQueryActionButton from '../RunQueryActionButton';

const LIMIT_DROPDOWN = [10, 100, 1000, 10000, 100000];
const SQL_EDITOR_PADDING = 10;
const INITIAL_NORTH_PERCENT = 30;
const INITIAL_SOUTH_PERCENT = 70;
const SET_QUERY_EDITOR_SQL_DEBOUNCE_MS = 2000;
const VALIDATION_DEBOUNCE_MS = 600;
const WINDOW_RESIZE_THROTTLE_MS = 100;

const appContainer = document.getElementById('app');
const bootstrapData = JSON.parse(
  appContainer.getAttribute('data-bootstrap') || '{}',
);
const validatorMap =
  bootstrapData?.common?.conf?.SQL_VALIDATORS_BY_ENGINE || {};
const scheduledQueriesConf = bootstrapData?.common?.conf?.SCHEDULED_QUERIES;

const LimitSelectStyled = styled.span`
  .ant-dropdown-trigger {
    align-items: center;
    color: black;
    display: flex;
    font-size: 12px;
    margin-right: ${({ theme }) => theme.gridUnit * 2}px;
    text-decoration: none;
    span {
      display: inline-block;
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
      &:last-of-type: {
        margin-right: ${({ theme }) => theme.gridUnit * 4}px;
      }
    }
  }
`;

const StyledToolbar = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  display: flex;
  justify-content: space-between;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-top: 0;

  form {
    margin-block-end: 0;
  }

  .leftItems,
  .rightItems {
    display: flex;
    align-items: center;
    & > span {
      margin-right: ${({ theme }) => theme.gridUnit * 2}px;
      display: inline-block;

      &:last-child {
        margin-right: 0;
      }
    }
  }

  .limitDropdown {
    white-space: nowrap;
  }
`;

const propTypes = {
  actions: PropTypes.object.isRequired,
  database: PropTypes.object,
  latestQuery: PropTypes.object,
  tables: PropTypes.array.isRequired,
  editorQueries: PropTypes.array.isRequired,
  dataPreviewQueries: PropTypes.array.isRequired,
  queryEditorId: PropTypes.string.isRequired,
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
      autocompleteEnabled: getItem(
        LocalStorageKeys.sqllab__is_autocomplete_enabled,
        true,
      ),
      showCreateAsModal: false,
      createAs: '',
    };
    this.sqlEditorRef = React.createRef();
    this.northPaneRef = React.createRef();

    this.elementStyle = this.elementStyle.bind(this);
    this.onResizeStart = this.onResizeStart.bind(this);
    this.onResizeEnd = this.onResizeEnd.bind(this);
    this.canValidateQuery = this.canValidateQuery.bind(this);
    this.runQuery = this.runQuery.bind(this);
    this.stopQuery = this.stopQuery.bind(this);
    this.saveQuery = this.saveQuery.bind(this);
    this.onSqlChanged = this.onSqlChanged.bind(this);
    this.setQueryEditorSql = this.setQueryEditorSql.bind(this);
    this.setQueryEditorSqlWithDebounce = debounce(
      this.setQueryEditorSql.bind(this),
      SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
    );
    this.queryPane = this.queryPane.bind(this);
    this.renderQueryLimit = this.renderQueryLimit.bind(this);
    this.getAceEditorAndSouthPaneHeights =
      this.getAceEditorAndSouthPaneHeights.bind(this);
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

    this.onBeforeUnload = this.onBeforeUnload.bind(this);
    this.renderDropdown = this.renderDropdown.bind(this);
  }

  UNSAFE_componentWillMount() {
    if (this.state.autorun) {
      this.setState({ autorun: false });
      this.props.queryEditorSetAutorun(this.props.queryEditor, false);
      this.startQuery();
    }
  }

  componentDidMount() {
    // We need to measure the height of the sql editor post render to figure the height of
    // the south pane so it gets rendered properly
    // eslint-disable-next-line react/no-did-mount-set-state
    this.setState({ height: this.getSqlEditorHeight() });

    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('beforeunload', this.onBeforeUnload);

    // setup hotkeys
    const hotkeys = this.getHotkeyConfig();
    hotkeys.forEach(keyConfig => {
      Mousetrap.bind([keyConfig.key], keyConfig.func);
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
  }

  onResizeStart() {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    document.getElementsByClassName('ace_content')[0].style.height = '100%';
  }

  onResizeEnd([northPercent, southPercent]) {
    this.setState({ northPercent, southPercent });

    if (this.northPaneRef.current && this.northPaneRef.current.clientHeight) {
      this.props.persistEditorHeight(
        this.props.queryEditor,
        northPercent,
        southPercent,
      );
    }
  }

  onBeforeUnload(event) {
    if (
      this.props.database?.extra_json?.cancel_query_on_windows_unload &&
      this.props.latestQuery?.state === 'running'
    ) {
      event.preventDefault();
      this.stopQuery();
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
    // Get the user's OS
    const userOS = detectOS();

    const base = [
      {
        name: 'runQuery1',
        key: 'ctrl+r',
        descr: t('Run query'),
        func: () => {
          if (this.state.sql.trim() !== '') {
            this.runQuery();
          }
        },
      },
      {
        name: 'runQuery2',
        key: 'ctrl+enter',
        descr: t('Run query'),
        func: () => {
          if (this.state.sql.trim() !== '') {
            this.runQuery();
          }
        },
      },
      {
        name: 'newTab',
        key: userOS === 'Windows' ? 'ctrl+q' : 'ctrl+t',
        descr: t('New tab'),
        func: () => {
          this.props.addQueryEditor({
            ...this.props.queryEditor,
            title: t('Untitled query'),
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

    if (userOS === 'MacOS') {
      base.push({
        name: 'previousLine',
        key: 'ctrl+p',
        descr: t('Previous Line'),
        func: editor => {
          editor.navigateUp(1);
        },
      });
    }

    return base;
  }

  setQueryEditorSql(sql) {
    this.props.queryEditorSetSql(this.props.queryEditor, sql);
  }

  setQueryLimit(queryLimit) {
    this.props.queryEditorSetQueryLimit(this.props.queryEditor, queryLimit);
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
      this.props.estimateQueryCost(query);
    }
  }

  handleToggleAutocompleteEnabled = () => {
    this.setState(prevState => {
      setItem(
        LocalStorageKeys.sqllab__is_autocomplete_enabled,
        !prevState.autocompleteEnabled,
      );
      return {
        autocompleteEnabled: !prevState.autocompleteEnabled,
      };
    });
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
      this.props.validateQuery(query);
    }
  }

  canValidateQuery() {
    // Check whether or not we can validate the current query based on whether
    // or not the backend has a validator configured for it.
    if (this.props.database) {
      return validatorMap.hasOwnProperty(this.props.database.backend);
    }
    return false;
  }

  runQuery() {
    if (this.props.database) {
      this.startQuery();
    }
  }

  convertToNumWithSpaces(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');
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
    this.props.runQuery(query);
    this.props.setActiveSouthPaneTab('Results');
  }

  stopQuery() {
    if (
      this.props.latestQuery &&
      ['running', 'pending'].indexOf(this.props.latestQuery.state) >= 0
    ) {
      this.props.postStopQuery(this.props.latestQuery);
    }
  }

  createTableAs() {
    this.startQuery(true, CtasEnum.TABLE);
    this.setState({ showCreateAsModal: false, ctas: '' });
  }

  createViewAs() {
    this.startQuery(true, CtasEnum.VIEW);
    this.setState({ showCreateAsModal: false, ctas: '' });
  }

  ctasChanged(event) {
    this.setState({ ctas: event.target.value });
  }

  queryPane() {
    const hotkeys = this.getHotkeyConfig();
    const { aceEditorHeight, southPaneHeight } =
      this.getAceEditorAndSouthPaneHeights(
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
            database={this.props.database}
            schemas={this.props.queryEditor.schemaOptions}
            tables={this.props.queryEditor.tableOptions}
            functionNames={this.props.queryEditor.functionNames}
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
          defaultQueryLimit={this.props.defaultQueryLimit}
        />
      </Split>
    );
  }

  renderDropdown() {
    const qe = this.props.queryEditor;
    const successful = this.props.latestQuery?.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');
    return (
      <Menu onClick={this.handleMenuClick} style={{ width: 176 }}>
        <Menu.Item style={{ display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <span>{t('Autocomplete')}</span>{' '}
          <AntdSwitch
            checked={this.state.autocompleteEnabled}
            onChange={this.handleToggleAutocompleteEnabled}
            name="autocomplete-switch"
          />{' '}
        </Menu.Item>
        {isFeatureEnabled(FeatureFlag.ENABLE_TEMPLATE_PROCESSING) && (
          <Menu.Item>
            <TemplateParamsEditor
              language="json"
              onChange={params => {
                this.props.actions.queryEditorSetTemplateParams(qe, params);
              }}
              code={qe.templateParams}
            />
          </Menu.Item>
        )}
        {scheduledQueriesConf && (
          <Menu.Item>
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
          </Menu.Item>
        )}
      </Menu>
    );
  }

  renderQueryLimit() {
    // Adding SQL_MAX_ROW value to dropdown
    const { maxRow } = this.props;
    LIMIT_DROPDOWN.push(maxRow);

    return (
      <Menu>
        {[...new Set(LIMIT_DROPDOWN)].map(limit => (
          <Menu.Item key={`${limit}`} onClick={() => this.setQueryLimit(limit)}>
            {/* // eslint-disable-line no-use-before-define */}
            <a role="button" styling="link">
              {this.convertToNumWithSpaces(limit)}
            </a>{' '}
          </Menu.Item>
        ))}
      </Menu>
    );
  }

  async saveQuery(query) {
    const { queryEditor: qe, actions } = this.props;
    const savedQuery = await actions.saveQuery(query);
    actions.addSavedQueryToTabState(qe, savedQuery);
  }

  renderEditorBottomBar() {
    const { queryEditor: qe } = this.props;

    const { allow_ctas: allowCTAS, allow_cvas: allowCVAS } =
      this.props.database || {};

    const showMenu = allowCTAS || allowCVAS;
    const { theme } = this.props;
    const runMenuBtn = (
      <Menu>
        {allowCTAS && (
          <Menu.Item
            onClick={() => {
              this.setState({
                showCreateAsModal: true,
                createAs: CtasEnum.TABLE,
              });
            }}
            key="1"
          >
            {t('CREATE TABLE AS')}
          </Menu.Item>
        )}
        {allowCVAS && (
          <Menu.Item
            onClick={() => {
              this.setState({
                showCreateAsModal: true,
                createAs: CtasEnum.VIEW,
              });
            }}
            key="2"
          >
            {t('CREATE VIEW AS')}
          </Menu.Item>
        )}
      </Menu>
    );

    return (
      <StyledToolbar className="sql-toolbar" id="js-sql-toolbar">
        <div className="leftItems">
          <span>
            <RunQueryActionButton
              allowAsync={
                this.props.database
                  ? this.props.database.allow_run_async
                  : false
              }
              queryState={this.props.latestQuery?.state}
              runQuery={this.runQuery}
              selectedText={qe.selectedText}
              stopQuery={this.stopQuery}
              sql={this.state.sql}
              overlayCreateAsMenu={showMenu ? runMenuBtn : null}
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
          <span>
            <LimitSelectStyled>
              <AntdDropdown overlay={this.renderQueryLimit()} trigger="click">
                <a onClick={e => e.preventDefault()}>
                  <span>LIMIT:</span>
                  <span className="limitDropdown">
                    {this.convertToNumWithSpaces(
                      this.props.queryEditor.queryLimit ||
                        this.props.defaultQueryLimit,
                    )}
                  </span>
                  <Icons.TriangleDown iconColor={theme.colors.grayscale.base} />
                </a>
              </AntdDropdown>
            </LimitSelectStyled>
          </span>
          {this.props.latestQuery && (
            <Timer
              startTime={this.props.latestQuery.startDttm}
              endTime={this.props.latestQuery.endDttm}
              state={STATE_TYPE_MAP[this.props.latestQuery.state]}
              isRunning={this.props.latestQuery.state === 'running'}
            />
          )}
        </div>
        <div className="rightItems">
          <span>
            <SaveQuery
              query={qe}
              defaultLabel={qe.title || qe.description}
              onSave={this.saveQuery}
              onUpdate={this.props.actions.updateSavedQuery}
              saveQueryWarning={this.props.saveQueryWarning}
            />
          </span>
          <span>
            <ShareSqlLabQuery queryEditor={qe} />
          </span>
          <AntdDropdown overlay={this.renderDropdown()} trigger="click">
            <Icons.MoreHoriz iconColor={theme.colors.grayscale.base} />
          </AntdDropdown>
        </div>
      </StyledToolbar>
    );
  }

  render() {
    const createViewModalTitle =
      this.state.createAs === CtasEnum.VIEW
        ? 'CREATE VIEW AS'
        : 'CREATE TABLE AS';

    const createModalPlaceHolder =
      this.state.createAs === CtasEnum.VIEW
        ? 'Specify name to CREATE VIEW AS schema in: public'
        : 'Specify name to CREATE TABLE AS schema in: public';

    const leftBarStateClass = this.props.hideLeftBar
      ? 'schemaPane-exit-done'
      : 'schemaPane-enter-done';
    return (
      <div ref={this.sqlEditorRef} className="SqlEditor">
        <CSSTransition
          classNames="schemaPane"
          in={!this.props.hideLeftBar}
          timeout={300}
        >
          <div className={`schemaPane ${leftBarStateClass}`}>
            <SqlEditorLeftBar
              database={this.props.database}
              queryEditor={this.props.queryEditor}
              tables={this.props.tables}
              actions={this.props.actions}
            />
          </div>
        </CSSTransition>
        {this.queryPane()}
        <StyledModal
          visible={this.state.showCreateAsModal}
          title={t(createViewModalTitle)}
          onHide={() => {
            this.setState({ showCreateAsModal: false });
          }}
          footer={
            <>
              <Button
                onClick={() => this.setState({ showCreateAsModal: false })}
              >
                Cancel
              </Button>
              {this.state.createAs === CtasEnum.TABLE && (
                <Button
                  buttonStyle="primary"
                  disabled={this.state.ctas.length === 0}
                  onClick={this.createTableAs.bind(this)}
                >
                  Create
                </Button>
              )}
              {this.state.createAs === CtasEnum.VIEW && (
                <Button
                  buttonStyle="primary"
                  disabled={this.state.ctas.length === 0}
                  onClick={this.createViewAs.bind(this)}
                >
                  Create
                </Button>
              )}
            </>
          }
        >
          <span>Name</span>
          <Input
            placeholder={createModalPlaceHolder}
            onChange={this.ctasChanged.bind(this)}
          />
        </StyledModal>
      </div>
    );
  }
}
SqlEditor.defaultProps = defaultProps;
SqlEditor.propTypes = propTypes;

function mapStateToProps(state, props) {
  const { sqlLab } = state;
  const queryEditor = sqlLab.queryEditors.find(
    editor => editor.id === props.queryEditorId,
  );

  return { sqlLab, ...props, queryEditor };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(
    {
      addQueryEditor,
      estimateQueryCost,
      persistEditorHeight,
      postStopQuery,
      queryEditorSetAutorun,
      queryEditorSetQueryLimit,
      queryEditorSetSql,
      queryEditorSetTemplateParams,
      runQuery,
      saveQuery,
      addSavedQueryToTabState,
      scheduleQuery,
      setActiveSouthPaneTab,
      updateSavedQuery,
      validateQuery,
    },
    dispatch,
  );
}

const themedSqlEditor = withTheme(SqlEditor);
export default connect(mapStateToProps, mapDispatchToProps)(themedSqlEditor);
