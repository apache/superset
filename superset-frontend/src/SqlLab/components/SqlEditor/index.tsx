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
import React, { FC, useState, useEffect, useRef } from 'react';
import { CSSTransition } from 'react-transition-group';
import { useDispatch, useSelector } from 'react-redux';
import Split from 'react-split';
import { t, styled, useTheme } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import StyledModal from 'src/components/Modal';
import Mousetrap from 'mousetrap';
import Button from 'src/components/Button';
import Timer from 'src/components/Timer';
import {
  Dropdown,
  Menu as AntdMenu,
  Menu,
  Switch,
  Input,
} from 'src/common/components';
import { DatabaseObject } from 'src/components/DatabaseSelector';
import { QueryEditor, Query } from 'src/SqlLab/types';
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
import rootReducer from 'src/SqlLab/reducers';
import TemplateParamsEditor from '../TemplateParamsEditor';
import ConnectedSouthPane from '../SouthPane/state';
import SaveQuery from '../SaveQuery';
import ScheduleQueryButton from '../ScheduleQueryButton';
import EstimateQueryCostButton from '../EstimateQueryCostButton';
import ShareSqlLabQuery from '../ShareSqlLabQuery';
import SqlEditorLeftBar from '../SqlEditorLeftBar';
import AceEditorWrapper from '../AceEditorWrapper';
import RunQueryActionButton from '../RunQueryActionButton';

type RootState = ReturnType<typeof rootReducer>;

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

interface SqlEditorProps {
  actions: object;
  database?: DatabaseObject;
  latestQuery?: Query;
  tables: any[];
  editorQueries: QueryEditor[];
  dataPreviewQueries: object[];
  queryEditorId: string;
  hideLeftBar?: boolean;
  defaultQueryLimit: number;
  maxRow: number;
  displayLimit: number;
  saveQueryWarning?: string;
  scheduleQueryWarning?: string;
}

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

const SqlEditor: FC<SqlEditorProps> = ({
  actions,
  database = null,
  latestQuery,
  tables,
  editorQueries,
  dataPreviewQueries,
  queryEditorId,
  hideLeftBar = false,
  defaultQueryLimit,
  maxRow,
  displayLimit,
  saveQueryWarning,
  scheduleQueryWarning = null,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const queryEditor = useSelector((state: RootState) =>
    state.sqlLab.queryEditors.find(editor => editor.id === queryEditorId),
  );

  const [height, setHeight] = useState(0);
  const [autorun, setAutorun] = useState(queryEditor.autorun);
  const [ctas, setCtas] = useState('');
  const [northPercent, setNorthPercent] = useState(queryEditor.northPercent || INITIAL_NORTH_PERCENT);
  const [southPercent, setSouthPercent] = useState(queryEditor.southPercent || INITIAL_SOUTH_PERCENT);
  const [sql, setSQL] = useState(queryEditor.sql);
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(
    getItem(LocalStorageKeys.sqllab__is_autocomplete_enabled, true),
  );
  const [showCreateAsModal, setShowCreateAsModal] = useState(false);
  const [createAs, setCreateAs] = useState('');

  const sqlEditorRef = useRef(null);
  const northPaneRef = useRef(null);

  useState(() => {
    if (autorun) {
      setAutorun(false);
      dispatch(queryEditorSetAutorun(queryEditor, false));
      startQuery();
    }
  });

  useEffect(() => {
    // We need to measure the height of the sql editor post render to figure the height of
    // the south pane so it gets rendered properly
    setHeight(getSqlEditorHeight());

    window.addEventListener('resize', handleWindowResizeWithThrottle);
    window.addEventListener('beforeunload', onBeforeUnload);

    // setup hotkeys
    const hotkeys = getHotkeyConfig();
    hotkeys.forEach(keyConfig => {
      Mousetrap.bind([keyConfig.key], keyConfig.func);
    });

    return () => {
      window.removeEventListener('resize', handleWindowResizeWithThrottle);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  const onResizeStart = () => {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    document.getElementsByClassName('ace_content')[0].style.height = '100%';
  };

  const onResizeEnd = ([northPercent, southPercent]: number[]) => {
    setNorthPercent(northPercent);
    setSouthPercent(southPercent);

    if (northPaneRef.current && northPaneRef.current.clientHeight) {
      dispatch(persistEditorHeight(queryEditor, northPercent, southPercent));
    }
  };

  const onBeforeUnload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (
      database?.extra_json?.cancel_query_on_windows_unload &&
      latestQuery?.state === 'running'
    ) {
      event.preventDefault();
      stopQuery();
    }
  };

  const onSqlChanged = (sql: string) => {
    setSQL(sql);
    setQueryEditorSqlWithDebounce(sql);
    // Request server-side validation of the query text
    if (canValidateQuery()) {
      requestValidationWithDebounce();
    }
  };

  // One layer of abstraction for easy spying in unit tests
  const getSqlEditorHeight = () =>
    sqlEditorRef.current
      ? sqlEditorRef.current.clientHeight - SQL_EDITOR_PADDING * 2
      : 0;

  // Return the heights for the ace editor and the south pane as an object
  // given the height of the sql editor, north pane percent and south pane percent.
  const getAceEditorAndSouthPaneHeights = (
    height: number,
    northPercent: number,
    southPercent: number,
  ) => ({
    aceEditorHeight:
      (height * northPercent) / 100 -
      (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN) -
      SQL_TOOLBAR_HEIGHT,
    southPaneHeight:
      (height * southPercent) / 100 -
      (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN),
  });

  const getHotkeyConfig = () => {
    // Get the user's OS
    const userOS = detectOS();
    return [
      {
        name: 'runQuery1',
        key: 'ctrl+r',
        descr: t('Run query'),
        func: () => {
          if (sql.trim() !== '') {
            startQuery();
          }
        },
      },
      {
        name: 'runQuery2',
        key: 'ctrl+enter',
        descr: t('Run query'),
        func: () => {
          if (sql.trim() !== '') {
            startQuery();
          }
        },
      },
      {
        name: 'newTab',
        key: userOS === 'Windows' ? 'ctrl+q' : 'ctrl+t',
        descr: t('New tab'),
        func: () => {
          dispatch(
            addQueryEditor({
              ...queryEditor,
              title: t('Untitled query'),
              sql: '',
            }),
          );
        },
      },
      {
        name: 'stopQuery',
        key: 'ctrl+x',
        descr: t('Stop query'),
        func: stopQuery,
      },
    ];
  };

  const setQueryEditorSql = (sql: string) => {
    dispatch(queryEditorSetSql(queryEditor, sql));
  };

  const setQueryEditorSqlWithDebounce = debounce(
    setQueryEditorSql,
    SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
  );

  const setQueryLimit = (queryLimit: number) => {
    dispatch(queryEditorSetQueryLimit(queryEditor, queryLimit));
  };

  const getQueryCostEstimate = () => {
    if (database) {
      const qe = queryEditor;
      const query = {
        dbId: qe.dbId,
        sql: qe.selectedText ? qe.selectedText : sql,
        sqlEditorId: qe.id,
        schema: qe.schema,
        templateParams: qe.templateParams,
      };
      dispatch(estimateQueryCost(query));
    }
  };

  const handleToggleAutocompleteEnabled = () => {
    setItem(
      LocalStorageKeys.sqllab__is_autocomplete_enabled,
      !autocompleteEnabled,
    );
    setAutocompleteEnabled(!autocompleteEnabled);
  };

  const handleWindowResize = () => {
    setHeight(getSqlEditorHeight());
  };

  const handleWindowResizeWithThrottle = throttle(
    handleWindowResize,
    WINDOW_RESIZE_THROTTLE_MS,
  );

  const elementStyle = (
    dimension: number,
    elementSize: number,
    gutterSize: number,
  ) => ({
    [dimension]: `calc(${elementSize}% - ${
      gutterSize + SQL_EDITOR_GUTTER_MARGIN
    }px)`,
  });

  const requestValidation = () => {
    if (database) {
      const qe = queryEditor;
      const query = {
        dbId: qe.dbId,
        sql,
        sqlEditorId: qe.id,
        schema: qe.schema,
        templateParams: qe.templateParams,
      };
      dispatch(validateQuery(query));
    }
  };

  const requestValidationWithDebounce = debounce(
    requestValidation,
    VALIDATION_DEBOUNCE_MS,
  );

  const canValidateQuery = () => {
    // Check whether or not we can validate the current query based on whether
    // or not the backend has a validator configured for it.
    if (database) {
      return validatorMap.hasOwnProperty(database.backend);
    }
    return false;
  };

  const convertToNumWithSpaces = (num: number) =>
    num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ');

  const startQuery = (ctasArg = false, ctas_method = CtasEnum.TABLE) => {
    if (!database) {
      return;
    }

    const qe = queryEditor;
    const query = {
      dbId: qe.dbId,
      sql: qe.selectedText ? qe.selectedText : sql,
      sqlEditorId: qe.id,
      tab: qe.title,
      schema: qe.schema,
      tempTable: ctasArg ? ctas : '',
      templateParams: qe.templateParams,
      queryLimit: qe.queryLimit || defaultQueryLimit,
      runAsync: database ? database.allow_run_async : false,
      ctasArg,
      ctas_method,
      updateTabState: !qe.selectedText,
    };
    dispatch(runQuery(query));
    dispatch(setActiveSouthPaneTab('Results'));
  };

  const stopQuery = () => {
    if (latestQuery && ['running', 'pending'].indexOf(latestQuery.state) >= 0) {
      dispatch(postStopQuery(latestQuery));
    }
  };

  const createTableAs = () => {
    startQuery(true, CtasEnum.TABLE);
    setShowCreateAsModal(false);
    setCtas('');
  };

  const createViewAs = () => {
    startQuery(true, CtasEnum.VIEW);
    setShowCreateAsModal(false);
    setCtas('');
  };

  const ctasChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCtas(event.target.value);
  };

  const queryPane = () => {
    const hotkeys = getHotkeyConfig();
    const { aceEditorHeight, southPaneHeight } =
      getAceEditorAndSouthPaneHeights(height, northPercent, southPercent);
    return (
      <Split
        expandToMin
        className="queryPane"
        sizes={[northPercent, southPercent]}
        elementStyle={elementStyle}
        minSize={200}
        direction="vertical"
        gutterSize={SQL_EDITOR_GUTTER_HEIGHT}
        onDragStart={onResizeStart}
        onDragEnd={onResizeEnd}
      >
        <div ref={northPaneRef} className="north-pane">
          <AceEditorWrapper
            actions={actions}
            autocomplete={autocompleteEnabled}
            onBlur={setQueryEditorSql}
            onChange={onSqlChanged}
            queryEditor={queryEditor}
            sql={queryEditor.sql}
            schemas={queryEditor.schemaOptions}
            tables={queryEditor.tableOptions}
            functionNames={queryEditor.functionNames}
            extendedTables={tables}
            height={`${aceEditorHeight}px`}
            hotkeys={hotkeys}
          />
          {renderEditorBottomBar()}
        </div>
        <ConnectedSouthPane
          editorQueries={editorQueries}
          latestQueryId={latestQuery && latestQuery.id}
          dataPreviewQueries={dataPreviewQueries}
          actions={actions}
          height={southPaneHeight}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
        />
      </Split>
    );
  };

  const renderDropdown = () => {
    const qe = queryEditor;
    const successful = latestQuery?.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');
    return (
      <Menu onClick={this.handleMenuClick} style={{ width: 176 }}>
        <Menu.Item style={{ display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <span>{t('Autocomplete')}</span>{' '}
          <Switch
            checked={autocompleteEnabled}
            onChange={handleToggleAutocompleteEnabled}
            name="autocomplete-switch"
          />{' '}
        </Menu.Item>
        {isFeatureEnabled(FeatureFlag.ENABLE_TEMPLATE_PROCESSING) && (
          <Menu.Item>
            <TemplateParamsEditor
              language="json"
              onChange={params => {
                dispatch(queryEditorSetTemplateParams(qe, params));
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
              onSchedule={dispatch(scheduleQuery)}
              schema={qe.schema}
              dbId={qe.dbId}
              scheduleQueryWarning={scheduleQueryWarning}
              tooltip={scheduleToolTip}
              disabled={!successful}
            />
          </Menu.Item>
        )}
      </Menu>
    );
  };

  const renderQueryLimit = () => {
    // Adding SQL_MAX_ROW value to dropdown
    LIMIT_DROPDOWN.push(maxRow);

    return (
      <AntdMenu>
        {[...new Set(LIMIT_DROPDOWN)].map(limit => (
          <AntdMenu.Item key={`${limit}`} onClick={() => setQueryLimit(limit)}>
            {/* // eslint-disable-line no-use-before-define */}
            <a role="button" styling="link">
              {convertToNumWithSpaces(limit)}
            </a>{' '}
          </AntdMenu.Item>
        ))}
      </AntdMenu>
    );
  };

  const onSaveQuery = async (query: Query) => {
    const savedQuery = await dispatch(saveQuery(query));
    dispatch(addSavedQueryToTabState(queryEditor, savedQuery));
  };

  const renderEditorBottomBar = () => {
    const qe = queryEditor;
    const { allow_ctas: allowCTAS, allow_cvas: allowCVAS } = database || {};

    const showMenu = allowCTAS || allowCVAS;
    const runMenuBtn = (
      <Menu>
        {allowCTAS && (
          <Menu.Item
            onClick={() => {
              setShowCreateAsModal(true);
              setCreateAs(CtasEnum.TABLE);
            }}
            key="1"
          >
            {t('CREATE TABLE AS')}
          </Menu.Item>
        )}
        {allowCVAS && (
          <Menu.Item
            onClick={() => {
              setShowCreateAsModal(true);
              setCreateAs(CtasEnum.VIEW);
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
              allowAsync={database ? database.allow_run_async : false}
              queryState={latestQuery?.state}
              runQuery={startQuery}
              selectedText={qe.selectedText}
              stopQuery={stopQuery}
              sql={sql}
              overlayCreateAsMenu={showMenu ? runMenuBtn : null}
            />
          </span>
          {isFeatureEnabled(FeatureFlag.ESTIMATE_QUERY_COST) &&
            database?.allows_cost_estimate && (
              <span>
                <EstimateQueryCostButton
                  dbId={qe.dbId}
                  schema={qe.schema}
                  sql={qe.sql}
                  getEstimate={getQueryCostEstimate}
                  queryCostEstimate={qe.queryCostEstimate}
                  selectedText={qe.selectedText}
                  tooltip={t('Estimate the cost before running a query')}
                />
              </span>
            )}
          <span>
            <LimitSelectStyled>
              <Dropdown overlay={renderQueryLimit()} trigger="click">
                <a onClick={e => e.preventDefault()}>
                  <span>LIMIT:</span>
                  <span className="limitDropdown">
                    {convertToNumWithSpaces(
                      queryEditor.queryLimit || defaultQueryLimit,
                    )}
                  </span>
                  <Icons.TriangleDown iconColor={theme.colors.grayscale.base} />
                </a>
              </Dropdown>
            </LimitSelectStyled>
          </span>
          {latestQuery && (
            <Timer
              startTime={latestQuery.startDttm}
              endTime={latestQuery.endDttm}
              state={STATE_TYPE_MAP[latestQuery.state]}
              isRunning={latestQuery.state === 'running'}
            />
          )}
        </div>
        <div className="rightItems">
          <span>
            <SaveQuery
              query={qe}
              defaultLabel={qe.title || qe.description}
              onSave={onSaveQuery}
              onUpdate={dispatch(updateSavedQuery)}
              saveQueryWarning={saveQueryWarning}
            />
          </span>
          <span>
            <ShareSqlLabQuery queryEditor={qe} />
          </span>
          <Dropdown overlay={renderDropdown()} trigger="click">
            <Icons.MoreHoriz iconColor={theme.colors.grayscale.base} />
          </Dropdown>
        </div>
      </StyledToolbar>
    );
  };

  const createViewModalTitle =
    createAs === CtasEnum.VIEW ? 'CREATE VIEW AS' : 'CREATE TABLE AS';

  const createModalPlaceHolder =
    createAs === CtasEnum.VIEW
      ? 'Specify name to CREATE VIEW AS schema in: public'
      : 'Specify name to CREATE TABLE AS schema in: public';

  const leftBarStateClass = hideLeftBar
    ? 'schemaPane-exit-done'
    : 'schemaPane-enter-done';
  return (
    <div ref={sqlEditorRef} className="SqlEditor">
      <CSSTransition classNames="schemaPane" in={!hideLeftBar} timeout={300}>
        <div className={`schemaPane ${leftBarStateClass}`}>
          <SqlEditorLeftBar
            database={database}
            queryEditor={queryEditor}
            tables={tables}
            actions={actions}
          />
        </div>
      </CSSTransition>
      {queryPane()}
      <StyledModal
        visible={showCreateAsModal}
        title={t(createViewModalTitle)}
        onHide={() => setShowCreateAsModal(false)}
        footer={
          <>
            <Button onClick={() => setShowCreateAsModal(false)}>Cancel</Button>
            {createAs === CtasEnum.TABLE && (
              <Button
                buttonStyle="primary"
                disabled={ctas.length === 0}
                onClick={createTableAs}
              >
                Create
              </Button>
            )}
            {createAs === CtasEnum.VIEW && (
              <Button
                buttonStyle="primary"
                disabled={ctas.length === 0}
                onClick={createViewAs}
              >
                Create
              </Button>
            )}
          </>
        }
      >
        <span>Name</span>
        <Input placeholder={createModalPlaceHolder} onChange={ctasChanged} />
      </StyledModal>
    </div>
  );
};

export default SqlEditor;
