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
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  ChangeEvent,
  FC,
} from 'react';

import type AceEditor from 'react-ace';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { CSSTransition } from 'react-transition-group';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import Split from 'react-split';
import {
  css,
  FeatureFlag,
  isFeatureEnabled,
  styled,
  t,
  useTheme,
  getExtensionsRegistry,
  QueryResponse,
  Query,
} from '@superset-ui/core';
import type {
  QueryEditor,
  SqlLabRootState,
  CursorPosition,
} from 'src/SqlLab/types';
import type { DatabaseObject } from 'src/features/databases/types';
import { debounce, throttle, isBoolean, isEmpty } from 'lodash';
import Modal from 'src/components/Modal';
import Mousetrap from 'mousetrap';
import Button from 'src/components/Button';
import Timer from 'src/components/Timer';
import ResizableSidebar from 'src/components/ResizableSidebar';
import { AntdDropdown, AntdSwitch, Skeleton } from 'src/components';
import { Input } from 'src/components/Input';
import { Menu } from 'src/components/Menu';
import Icons from 'src/components/Icons';
import { detectOS } from 'src/utils/common';
import {
  addNewQueryEditor,
  CtasEnum,
  estimateQueryCost,
  persistEditorHeight,
  postStopQuery,
  queryEditorSetAutorun,
  queryEditorSetSql,
  queryEditorSetCursorPosition,
  queryEditorSetAndSaveSql,
  queryEditorSetTemplateParams,
  runQueryFromSqlEditor,
  saveQuery,
  addSavedQueryToTabState,
  scheduleQuery,
  setActiveSouthPaneTab,
  updateSavedQuery,
  formatQuery,
  fetchQueryEditor,
} from 'src/SqlLab/actions/sqlLab';
import {
  STATE_TYPE_MAP,
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_GUTTER_MARGIN,
  SQL_TOOLBAR_HEIGHT,
  SQL_EDITOR_LEFTBAR_WIDTH,
  SQL_EDITOR_PADDING,
  INITIAL_NORTH_PERCENT,
  INITIAL_SOUTH_PERCENT,
  SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
  WINDOW_RESIZE_THROTTLE_MS,
} from 'src/SqlLab/constants';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { EmptyStateBig } from 'src/components/EmptyState';
import getBootstrapData from 'src/utils/getBootstrapData';
import useLogAction from 'src/logger/useLogAction';
import {
  LOG_ACTIONS_SQLLAB_CREATE_TABLE_AS,
  LOG_ACTIONS_SQLLAB_CREATE_VIEW_AS,
  LOG_ACTIONS_SQLLAB_ESTIMATE_QUERY_COST,
  LOG_ACTIONS_SQLLAB_FORMAT_SQL,
  LOG_ACTIONS_SQLLAB_LOAD_TAB_STATE,
  LOG_ACTIONS_SQLLAB_RUN_QUERY,
  LOG_ACTIONS_SQLLAB_STOP_QUERY,
  Logger,
} from 'src/logger/LogUtils';
import TemplateParamsEditor from '../TemplateParamsEditor';
import SouthPane from '../SouthPane';
import SaveQuery, { QueryPayload } from '../SaveQuery';
import ScheduleQueryButton from '../ScheduleQueryButton';
import EstimateQueryCostButton from '../EstimateQueryCostButton';
import ShareSqlLabQuery from '../ShareSqlLabQuery';
import SqlEditorLeftBar from '../SqlEditorLeftBar';
import AceEditorWrapper from '../AceEditorWrapper';
import RunQueryActionButton from '../RunQueryActionButton';
import QueryLimitSelect from '../QueryLimitSelect';
import KeyboardShortcutButton, {
  KEY_MAP,
  KeyboardShortcut,
} from '../KeyboardShortcutButton';

const bootstrapData = getBootstrapData();
const scheduledQueriesConf = bootstrapData?.common?.conf?.SCHEDULED_QUERIES;

const StyledToolbar = styled.div`
  padding: ${({ theme }) => theme.gridUnit * 2}px;
  background: ${({ theme }) => theme.colors.grayscale.light5};
  display: flex;
  justify-content: space-between;
  border: 1px solid ${({ theme }) => theme.colors.grayscale.light2};
  border-top: 0;
  column-gap: ${({ theme }) => theme.gridUnit}px;

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

const StyledSidebar = styled.div<{ width: number; hide: boolean | undefined }>`
  flex: 0 0 ${({ width }) => width}px;
  width: ${({ width }) => width}px;
  padding: ${({ theme, hide }) => (hide ? 0 : theme.gridUnit * 2.5)}px;
  border-right: 1px solid
    ${({ theme, hide }) =>
      hide ? 'transparent' : theme.colors.grayscale.light2};
`;

const StyledSqlEditor = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;
    height: 100%;

    .schemaPane {
      transition: transform ${theme.transitionTiming}s ease-in-out;
    }

    .queryPane {
      flex: 1 1 auto;
      padding: ${theme.gridUnit * 2}px;
      overflow-y: auto;
      overflow-x: scroll;
    }

    .schemaPane-enter-done,
    .schemaPane-exit {
      transform: translateX(0);
      z-index: 7;
    }

    .schemaPane-exit-active {
      transform: translateX(-120%);
    }

    .schemaPane-enter-active {
      transform: translateX(0);
      max-width: ${theme.gridUnit * 75}px;
    }

    .schemaPane-enter,
    .schemaPane-exit-done {
      max-width: 0;
      transform: translateX(-120%);
      overflow: hidden;
    }

    .schemaPane-exit-done + .queryPane {
      margin-left: 0;
    }

    .gutter {
      border-top: 1px solid ${theme.colors.grayscale.light2};
      border-bottom: 1px solid ${theme.colors.grayscale.light2};
      width: 3%;
      margin: ${SQL_EDITOR_GUTTER_MARGIN}px 47%;
    }

    .gutter.gutter-vertical {
      cursor: row-resize;
    }
  `}
`;

const extensionsRegistry = getExtensionsRegistry();

export type Props = {
  queryEditor: QueryEditor;
  defaultQueryLimit: number;
  maxRow: number;
  displayLimit: number;
  saveQueryWarning: string | null;
  scheduleQueryWarning: string | null;
};

const elementStyle = (
  dimension: string,
  elementSize: number,
  gutterSize: number,
) => ({
  [dimension]: `calc(${elementSize}% - ${
    gutterSize + SQL_EDITOR_GUTTER_MARGIN
  }px)`,
});

const SqlEditor: FC<Props> = ({
  queryEditor,
  defaultQueryLimit,
  maxRow,
  displayLimit,
  saveQueryWarning,
  scheduleQueryWarning,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const { database, latestQuery, hideLeftBar, currentQueryEditorId } =
    useSelector<
      SqlLabRootState,
      {
        database?: DatabaseObject;
        latestQuery?: QueryResponse;
        hideLeftBar?: boolean;
        currentQueryEditorId: QueryEditor['id'];
      }
    >(({ sqlLab: { unsavedQueryEditor, databases, queries, tabHistory } }) => {
      let { dbId, latestQueryId, hideLeftBar } = queryEditor;
      if (unsavedQueryEditor?.id === queryEditor.id) {
        dbId = unsavedQueryEditor.dbId || dbId;
        latestQueryId = unsavedQueryEditor.latestQueryId || latestQueryId;
        hideLeftBar = isBoolean(unsavedQueryEditor.hideLeftBar)
          ? unsavedQueryEditor.hideLeftBar
          : hideLeftBar;
      }
      return {
        database: databases[dbId || ''],
        latestQuery: queries[latestQueryId || ''],
        hideLeftBar,
        currentQueryEditorId: tabHistory.slice(-1)[0],
      };
    }, shallowEqual);

  const logAction = useLogAction({ queryEditorId: queryEditor.id });
  const isActive = currentQueryEditorId === queryEditor.id;
  const [height, setHeight] = useState(0);
  const [autorun, setAutorun] = useState(queryEditor.autorun);
  const [ctas, setCtas] = useState('');
  const [northPercent, setNorthPercent] = useState(
    queryEditor.northPercent || INITIAL_NORTH_PERCENT,
  );
  const [southPercent, setSouthPercent] = useState(
    queryEditor.southPercent || INITIAL_SOUTH_PERCENT,
  );
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(
    getItem(LocalStorageKeys.SqllabIsAutocompleteEnabled, true),
  );
  const [renderHTMLEnabled, setRenderHTMLEnabled] = useState(
    getItem(LocalStorageKeys.SqllabIsRenderHtmlEnabled, false),
  );
  const [showCreateAsModal, setShowCreateAsModal] = useState(false);
  const [createAs, setCreateAs] = useState('');
  const showEmptyState = useMemo(
    () => !database || isEmpty(database),
    [database],
  );

  const sqlEditorRef = useRef<HTMLDivElement>(null);
  const northPaneRef = useRef<HTMLDivElement>(null);

  const SqlFormExtension = extensionsRegistry.get('sqleditor.extension.form');

  const startQuery = useCallback(
    (ctasArg = false, ctas_method = CtasEnum.Table) => {
      if (!database) {
        return;
      }

      dispatch(
        runQueryFromSqlEditor(
          database,
          queryEditor,
          defaultQueryLimit,
          ctasArg ? ctas : '',
          ctasArg,
          ctas_method,
        ),
      );
      dispatch(setActiveSouthPaneTab('Results'));
    },
    [ctas, database, defaultQueryLimit, dispatch, queryEditor],
  );

  const formatCurrentQuery = useCallback(
    (useShortcut?: boolean) => {
      logAction(LOG_ACTIONS_SQLLAB_FORMAT_SQL, {
        shortcut: Boolean(useShortcut),
      });
      dispatch(formatQuery(queryEditor));
    },
    [dispatch, queryEditor, logAction],
  );

  const stopQuery = useCallback(() => {
    if (latestQuery && ['running', 'pending'].indexOf(latestQuery.state) >= 0) {
      dispatch(postStopQuery(latestQuery));
    }
    return false;
  }, [dispatch, latestQuery]);

  const runQuery = () => {
    if (database) {
      startQuery();
    }
  };

  useEffect(() => {
    if (autorun) {
      setAutorun(false);
      dispatch(queryEditorSetAutorun(queryEditor, false));
      startQuery();
    }
  }, [autorun, dispatch, queryEditor, startQuery]);

  // One layer of abstraction for easy spying in unit tests
  const getSqlEditorHeight = () =>
    sqlEditorRef.current
      ? sqlEditorRef.current.clientHeight - SQL_EDITOR_PADDING * 2
      : 0;

  const getHotkeyConfig = useCallback(() => {
    // Get the user's OS
    const userOS = detectOS();
    return [
      {
        name: 'runQuery1',
        key: KeyboardShortcut.CtrlR,
        descr: KEY_MAP[KeyboardShortcut.CtrlR],
        func: () => {
          if (queryEditor.sql.trim() !== '') {
            logAction(LOG_ACTIONS_SQLLAB_RUN_QUERY, { shortcut: true });
            startQuery();
          }
        },
      },
      {
        name: 'runQuery2',
        key: KeyboardShortcut.CtrlEnter,
        descr: KEY_MAP[KeyboardShortcut.CtrlEnter],
        func: () => {
          if (queryEditor.sql.trim() !== '') {
            logAction(LOG_ACTIONS_SQLLAB_RUN_QUERY, { shortcut: true });
            startQuery();
          }
        },
      },
      {
        name: 'newTab',
        ...(userOS === 'Windows'
          ? {
              key: KeyboardShortcut.CtrlQ,
              descr: KEY_MAP[KeyboardShortcut.CtrlQ],
            }
          : {
              key: KeyboardShortcut.CtrlT,
              descr: KEY_MAP[KeyboardShortcut.CtrlT],
            }),
        func: () => {
          Logger.markTimeOrigin();
          dispatch(addNewQueryEditor());
        },
      },
      {
        name: 'stopQuery',
        ...(userOS === 'MacOS'
          ? {
              key: KeyboardShortcut.CtrlX,
              descr: KEY_MAP[KeyboardShortcut.CtrlX],
            }
          : {
              key: KeyboardShortcut.CtrlE,
              descr: KEY_MAP[KeyboardShortcut.CtrlE],
            }),
        func: () => {
          logAction(LOG_ACTIONS_SQLLAB_STOP_QUERY, { shortcut: true });
          stopQuery();
        },
      },
      {
        name: 'formatQuery',
        key: KeyboardShortcut.CtrlShiftF,
        descr: KEY_MAP[KeyboardShortcut.CtrlShiftF],
        func: () => {
          formatCurrentQuery(true);
        },
      },
    ];
  }, [dispatch, queryEditor.sql, startQuery, stopQuery, formatCurrentQuery]);

  const hotkeys = useMemo(() => {
    // Get all hotkeys including ace editor hotkeys
    // Get the user's OS
    const userOS = detectOS();
    const base = [
      ...getHotkeyConfig(),
      {
        name: 'runQuery3',
        key: KeyboardShortcut.CtrlShiftEnter,
        descr: KEY_MAP[KeyboardShortcut.CtrlShiftEnter],
        func: (editor: AceEditor['editor']) => {
          if (!editor.getValue().trim()) {
            return;
          }
          const session = editor.getSession();
          const cursorPosition = editor.getCursorPosition();
          const totalLine = session.getLength();
          const currentRow = editor.getFirstVisibleRow();
          let end = editor.find(';', {
            backwards: false,
            skipCurrent: true,
          })?.end;
          if (!end || end.row < cursorPosition.row) {
            end = {
              row: totalLine + 1,
              column: 0,
            };
          }
          let start = editor.find(';', {
            backwards: true,
            skipCurrent: true,
          })?.end;
          let currentLine = start?.row;
          if (
            !currentLine ||
            currentLine > cursorPosition.row ||
            (currentLine === cursorPosition.row &&
              (start?.column || 0) > cursorPosition.column)
          ) {
            currentLine = 0;
          }
          let content =
            currentLine === start?.row
              ? session.getLine(currentLine).slice(start.column).trim()
              : session.getLine(currentLine).trim();
          while (!content && currentLine < totalLine) {
            currentLine += 1;
            content = session.getLine(currentLine).trim();
          }
          if (currentLine !== start?.row) {
            start = { row: currentLine, column: 0 };
          }
          editor.selection.setSelectionRange({
            start: start ?? { row: 0, column: 0 },
            end,
          });
          startQuery();
          editor.selection.clearSelection();
          editor.moveCursorToPosition(cursorPosition);
          editor.scrollToRow(currentRow);
        },
      },
    ];
    if (userOS === 'MacOS') {
      base.push({
        name: 'previousLine',
        key: KeyboardShortcut.CtrlP,
        descr: KEY_MAP[KeyboardShortcut.CtrlP],
        func: editor => {
          editor.navigateUp();
        },
      });
    }

    return base;
  }, [getHotkeyConfig, startQuery]);

  const onBeforeUnload = useEffectEvent(event => {
    if (
      database?.extra_json?.cancel_query_on_windows_unload &&
      latestQuery?.state === 'running'
    ) {
      event.preventDefault();
      stopQuery();
    }
  });

  const shouldLoadQueryEditor =
    isFeatureEnabled(FeatureFlag.SqllabBackendPersistence) &&
    !queryEditor.loaded;

  const loadQueryEditor = useEffectEvent(() => {
    const duration = Logger.getTimestamp();
    logAction(LOG_ACTIONS_SQLLAB_LOAD_TAB_STATE, {
      duration,
      queryEditorId: queryEditor.id,
      inLocalStorage: Boolean(queryEditor.inLocalStorage),
      hasLoaded: !shouldLoadQueryEditor,
    });
    if (shouldLoadQueryEditor) {
      dispatch(fetchQueryEditor(queryEditor, displayLimit));
    }
  });

  useEffect(() => {
    // We need to measure the height of the sql editor post render to figure the height of
    // the south pane so it gets rendered properly
    setHeight(getSqlEditorHeight());
    const handleWindowResizeWithThrottle = throttle(
      () => setHeight(getSqlEditorHeight()),
      WINDOW_RESIZE_THROTTLE_MS,
    );
    if (isActive) {
      loadQueryEditor();
      window.addEventListener('resize', handleWindowResizeWithThrottle);
      window.addEventListener('beforeunload', onBeforeUnload);
    }

    return () => {
      window.removeEventListener('resize', handleWindowResizeWithThrottle);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // TODO: Remove useEffectEvent deps once https://github.com/facebook/react/pull/25881 is released
  }, [onBeforeUnload, loadQueryEditor, isActive]);

  useEffect(() => {
    // setup hotkeys
    const hotkeys = getHotkeyConfig();
    if (isActive) {
      // MouseTrap always override the same key
      // Unbind (reset) will be called when App component unmount
      hotkeys.forEach(keyConfig => {
        Mousetrap.bind([keyConfig.key], keyConfig.func);
      });
    }
  }, [getHotkeyConfig, latestQuery, isActive]);

  const onResizeStart = () => {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    const editorEl = document.getElementsByClassName(
      'ace_content',
    )[0] as HTMLElement;
    if (editorEl) {
      editorEl.style.height = '100%';
    }
  };

  const onResizeEnd = ([northPercent, southPercent]: number[]) => {
    setNorthPercent(northPercent);
    setSouthPercent(southPercent);

    if (northPaneRef.current?.clientHeight) {
      dispatch(persistEditorHeight(queryEditor, northPercent, southPercent));
    }
  };

  const setQueryEditorAndSaveSql = useCallback(
    sql => {
      dispatch(queryEditorSetAndSaveSql(queryEditor, sql));
    },
    [dispatch, queryEditor],
  );

  const setQueryEditorAndSaveSqlWithDebounce = useMemo(
    () => debounce(setQueryEditorAndSaveSql, SET_QUERY_EDITOR_SQL_DEBOUNCE_MS),
    [setQueryEditorAndSaveSql],
  );

  const onSqlChanged = useEffectEvent((sql: string) => {
    dispatch(queryEditorSetSql(queryEditor, sql));
  });

  // Return the heights for the ace editor and the south pane as an object
  // given the height of the sql editor, north pane percent and south pane percent.
  const getAceEditorAndSouthPaneHeights = (
    height: number,
    northPercent: number,
    southPercent: number,
  ) => ({
    aceEditorHeight:
      (height * northPercent) / (theme.gridUnit * 25) -
      (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN) -
      SQL_TOOLBAR_HEIGHT,
    southPaneHeight:
      (height * southPercent) / (theme.gridUnit * 25) -
      (SQL_EDITOR_GUTTER_HEIGHT / 2 + SQL_EDITOR_GUTTER_MARGIN),
  });

  const getQueryCostEstimate = () => {
    logAction(LOG_ACTIONS_SQLLAB_ESTIMATE_QUERY_COST, { shortcut: false });
    if (database) {
      dispatch(estimateQueryCost(queryEditor));
    }
  };

  const handleToggleAutocompleteEnabled = () => {
    setItem(LocalStorageKeys.SqllabIsAutocompleteEnabled, !autocompleteEnabled);
    setAutocompleteEnabled(!autocompleteEnabled);
  };

  const handleToggleRenderHTMLEnabled = () => {
    setItem(LocalStorageKeys.SqllabIsRenderHtmlEnabled, !renderHTMLEnabled);
    setRenderHTMLEnabled(!renderHTMLEnabled);
  };

  const createTableAs = () => {
    startQuery(true, CtasEnum.Table);
    setShowCreateAsModal(false);
    setCtas('');
  };

  const createViewAs = () => {
    startQuery(true, CtasEnum.View);
    setShowCreateAsModal(false);
    setCtas('');
  };

  const ctasChanged = (event: ChangeEvent<HTMLInputElement>) => {
    setCtas(event.target.value);
  };

  const renderDropdown = () => {
    const qe = queryEditor;
    const successful = latestQuery?.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');
    return (
      <Menu css={{ width: theme.gridUnit * 50 }}>
        <Menu.Item css={{ display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <span>{t('Render HTML')}</span>{' '}
          <AntdSwitch
            checked={renderHTMLEnabled}
            onChange={handleToggleRenderHTMLEnabled}
          />{' '}
        </Menu.Item>
        <Menu.Item css={{ display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <span>{t('Autocomplete')}</span>{' '}
          <AntdSwitch
            checked={autocompleteEnabled}
            onChange={handleToggleAutocompleteEnabled}
          />{' '}
        </Menu.Item>
        {isFeatureEnabled(FeatureFlag.EnableTemplateProcessing) && (
          <Menu.Item>
            <TemplateParamsEditor
              language="json"
              onChange={params => {
                dispatch(queryEditorSetTemplateParams(qe, params));
              }}
              queryEditorId={qe.id}
            />
          </Menu.Item>
        )}
        <Menu.Item onClick={() => formatCurrentQuery()}>
          {t('Format SQL')}
        </Menu.Item>
        {!isEmpty(scheduledQueriesConf) && (
          <Menu.Item>
            <ScheduleQueryButton
              defaultLabel={qe.name}
              sql={qe.sql}
              onSchedule={(query: Query) => dispatch(scheduleQuery(query))}
              schema={qe.schema}
              dbId={qe.dbId}
              scheduleQueryWarning={scheduleQueryWarning}
              tooltip={scheduleToolTip}
              disabled={!successful}
            />
          </Menu.Item>
        )}
        <Menu.Item>
          <KeyboardShortcutButton>
            {t('Keyboard shortcuts')}
          </KeyboardShortcutButton>
        </Menu.Item>
      </Menu>
    );
  };

  const onSaveQuery = async (query: QueryPayload, clientId: string) => {
    const savedQuery = await dispatch(saveQuery(query, clientId));
    dispatch(addSavedQueryToTabState(queryEditor, savedQuery));
  };

  const renderEditorBottomBar = () => {
    const { allow_ctas: allowCTAS, allow_cvas: allowCVAS } = database || {};

    const showMenu = allowCTAS || allowCVAS;
    const runMenuBtn = (
      <Menu>
        {allowCTAS && (
          <Menu.Item
            onClick={() => {
              logAction(LOG_ACTIONS_SQLLAB_CREATE_TABLE_AS, {
                shortcut: false,
              });
              setShowCreateAsModal(true);
              setCreateAs(CtasEnum.Table);
            }}
            key="1"
          >
            {t('CREATE TABLE AS')}
          </Menu.Item>
        )}
        {allowCVAS && (
          <Menu.Item
            onClick={() => {
              logAction(LOG_ACTIONS_SQLLAB_CREATE_VIEW_AS, {
                shortcut: false,
              });
              setShowCreateAsModal(true);
              setCreateAs(CtasEnum.View);
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
              allowAsync={database?.allow_run_async === true}
              queryEditorId={queryEditor.id}
              queryState={latestQuery?.state}
              runQuery={runQuery}
              stopQuery={stopQuery}
              overlayCreateAsMenu={showMenu ? runMenuBtn : null}
            />
          </span>
          {isFeatureEnabled(FeatureFlag.EstimateQueryCost) &&
            database?.allows_cost_estimate && (
              <span>
                <EstimateQueryCostButton
                  getEstimate={getQueryCostEstimate}
                  queryEditorId={queryEditor.id}
                  tooltip={t('Estimate the cost before running a query')}
                />
              </span>
            )}
          <span>
            <QueryLimitSelect
              queryEditorId={queryEditor.id}
              maxRow={maxRow}
              defaultQueryLimit={defaultQueryLimit}
            />
          </span>
          {latestQuery && (
            <Timer
              startTime={latestQuery.startDttm}
              endTime={latestQuery.endDttm}
              status={STATE_TYPE_MAP[latestQuery.state]}
              isRunning={latestQuery.state === 'running'}
            />
          )}
        </div>
        <div className="rightItems">
          <span>
            <SaveQuery
              queryEditorId={queryEditor.id}
              columns={latestQuery?.results?.columns || []}
              onSave={onSaveQuery}
              onUpdate={(query, remoteId) =>
                dispatch(updateSavedQuery(query, remoteId))
              }
              saveQueryWarning={saveQueryWarning}
              database={database}
            />
          </span>
          <span>
            <ShareSqlLabQuery queryEditorId={queryEditor.id} />
          </span>
          <AntdDropdown overlay={renderDropdown()} trigger={['click']}>
            <Icons.MoreHoriz iconColor={theme.colors.grayscale.base} />
          </AntdDropdown>
        </div>
      </StyledToolbar>
    );
  };

  const handleCursorPositionChange = (newPosition: CursorPosition) => {
    dispatch(queryEditorSetCursorPosition(queryEditor, newPosition));
  };

  const queryPane = () => {
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
          {SqlFormExtension && (
            <SqlFormExtension
              queryEditorId={queryEditor.id}
              setQueryEditorAndSaveSqlWithDebounce={
                setQueryEditorAndSaveSqlWithDebounce
              }
              startQuery={startQuery}
            />
          )}
          <AceEditorWrapper
            autocomplete={autocompleteEnabled}
            onBlur={onSqlChanged}
            onChange={onSqlChanged}
            queryEditorId={queryEditor.id}
            onCursorPositionChange={handleCursorPositionChange}
            height={`${aceEditorHeight}px`}
            hotkeys={hotkeys}
          />
          {renderEditorBottomBar()}
        </div>
        <SouthPane
          queryEditorId={queryEditor.id}
          latestQueryId={latestQuery?.id}
          height={southPaneHeight}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
        />
      </Split>
    );
  };

  const createViewModalTitle =
    createAs === CtasEnum.View ? 'CREATE VIEW AS' : 'CREATE TABLE AS';

  const createModalPlaceHolder =
    createAs === CtasEnum.View
      ? t('Specify name to CREATE VIEW AS schema in: public')
      : t('Specify name to CREATE TABLE AS schema in: public');

  const leftBarStateClass = hideLeftBar
    ? 'schemaPane-exit-done'
    : 'schemaPane-enter-done';
  return (
    <StyledSqlEditor ref={sqlEditorRef} className="SqlEditor">
      <CSSTransition classNames="schemaPane" in={!hideLeftBar} timeout={300}>
        <ResizableSidebar
          id={`sqllab:${queryEditor.id}`}
          minWidth={SQL_EDITOR_LEFTBAR_WIDTH}
          initialWidth={SQL_EDITOR_LEFTBAR_WIDTH}
          enable={!hideLeftBar}
        >
          {adjustedWidth => (
            <StyledSidebar
              className={`schemaPane ${leftBarStateClass}`}
              width={adjustedWidth}
              hide={hideLeftBar}
            >
              <SqlEditorLeftBar
                database={database}
                queryEditorId={queryEditor.id}
              />
            </StyledSidebar>
          )}
        </ResizableSidebar>
      </CSSTransition>
      {shouldLoadQueryEditor ? (
        <div
          data-test="sqlEditor-loading"
          css={css`
            flex: 1;
            padding: ${theme.gridUnit * 4}px;
          `}
        >
          <Skeleton active />
        </div>
      ) : showEmptyState ? (
        <EmptyStateBig
          image="vector.svg"
          title={t('Select a database to write a query')}
          description={t(
            'Choose one of the available databases from the panel on the left.',
          )}
        />
      ) : (
        queryPane()
      )}
      <Modal
        show={showCreateAsModal}
        title={t(createViewModalTitle)}
        onHide={() => setShowCreateAsModal(false)}
        footer={
          <>
            <Button onClick={() => setShowCreateAsModal(false)}>
              {t('Cancel')}
            </Button>
            {createAs === CtasEnum.Table && (
              <Button
                buttonStyle="primary"
                disabled={ctas.length === 0}
                onClick={createTableAs}
              >
                {t('Create')}
              </Button>
            )}
            {createAs === CtasEnum.View && (
              <Button
                buttonStyle="primary"
                disabled={ctas.length === 0}
                onClick={createViewAs}
              >
                {t('Create')}
              </Button>
            )}
          </>
        }
      >
        <span>{t('Name')}</span>
        <Input placeholder={createModalPlaceHolder} onChange={ctasChanged} />
      </Modal>
    </StyledSqlEditor>
  );
};

export default SqlEditor;
