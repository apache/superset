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
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';
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
import { debounce, isEmpty, noop } from 'lodash';
import Mousetrap from 'mousetrap';
import {
  Alert,
  Button,
  Dropdown,
  EmptyState,
  Input,
  Modal,
  Timer,
} from '@superset-ui/core/components';
import useStoredSidebarWidth from 'src/components/ResizableSidebar/useStoredSidebarWidth';
import { Splitter } from 'src/components/Splitter';
import { Skeleton } from '@superset-ui/core/components/Skeleton';
import { Switch } from '@superset-ui/core/components/Switch';
import { Menu, MenuItemType } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
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
  switchQueryEditor,
  toggleLeftBar,
} from 'src/SqlLab/actions/sqlLab';
import {
  STATE_TYPE_MAP,
  SQL_EDITOR_GUTTER_HEIGHT,
  SQL_EDITOR_LEFTBAR_WIDTH,
  INITIAL_NORTH_PERCENT,
  SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
} from 'src/SqlLab/constants';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
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
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { commands } from 'src/core';
import { CopyToClipboard } from 'src/components';
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
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  background: ${({ theme }) => theme.colorBgContainer};
  display: flex;
  justify-content: space-between;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-top: 0;
  column-gap: ${({ theme }) => theme.sizeUnit}px;

  form {
    margin-block-end: 0;
  }

  .leftItems,
  .rightItems {
    display: flex;
    align-items: center;
    & > span {
      margin-right: ${({ theme }) => theme.sizeUnit * 2}px;
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

const StyledSidebar = styled.div`
  padding: ${({ theme }) => theme.sizeUnit * 2.5}px;
`;

const StyledSqlEditor = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: row;
    height: 100%;

    .schemaPane {
      transition: transform ${theme.motionDurationMid} ease-in-out;
    }

    .queryPane {
      padding: ${theme.sizeUnit * 2}px;
      + .ant-splitter-bar .ant-splitter-bar-dragger {
        &::before {
          background: transparent;
        }
        &::after {
          height: ${SQL_EDITOR_GUTTER_HEIGHT}px;
          background: transparent;
          border-top: 1px solid ${theme.colorBorder};
          border-bottom: 1px solid ${theme.colorBorder};
        }
      }
    }

    .north-pane {
      height: 100%;
    }

    .sql-container {
      flex: 1 1 auto;
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

  const {
    database,
    latestQuery,
    hideLeftBar,
    currentQueryEditorId,
    hasSqlStatement,
  } = useSelector<
    SqlLabRootState,
    {
      database?: DatabaseObject;
      latestQuery?: QueryResponse;
      hideLeftBar?: boolean;
      currentQueryEditorId: QueryEditor['id'];
      hasSqlStatement: boolean;
    }
  >(({ sqlLab: { unsavedQueryEditor, databases, queries, tabHistory } }) => {
    let { dbId, latestQueryId, hideLeftBar } = queryEditor;
    if (unsavedQueryEditor?.id === queryEditor.id) {
      dbId = unsavedQueryEditor.dbId || dbId;
      latestQueryId = unsavedQueryEditor.latestQueryId || latestQueryId;
      hideLeftBar =
        typeof unsavedQueryEditor.hideLeftBar === 'boolean'
          ? unsavedQueryEditor.hideLeftBar
          : hideLeftBar;
    }
    return {
      hasSqlStatement: Boolean(queryEditor.sql?.trim().length > 0),
      database: databases[dbId || ''],
      latestQuery: queries[latestQueryId || ''],
      hideLeftBar,
      currentQueryEditorId: tabHistory.slice(-1)[0],
    };
  }, shallowEqual);

  const logAction = useLogAction({ queryEditorId: queryEditor.id });
  const isActive = currentQueryEditorId === queryEditor.id;
  const [autorun, setAutorun] = useState(queryEditor.autorun);
  const [ctas, setCtas] = useState('');
  const [northPercent, setNorthPercent] = useState(
    queryEditor.northPercent || INITIAL_NORTH_PERCENT,
  );
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(
    getItem(LocalStorageKeys.SqllabIsAutocompleteEnabled, true),
  );
  const [renderHTMLEnabled, setRenderHTMLEnabled] = useState(
    getItem(LocalStorageKeys.SqllabIsRenderHtmlEnabled, true),
  );
  const [showCreateAsModal, setShowCreateAsModal] = useState(false);
  const [createAs, setCreateAs] = useState('');
  const currentSQL = useRef<string>(queryEditor.sql);
  const showEmptyState = useMemo(
    () => !database || isEmpty(database),
    [database],
  );

  const sqlEditorRef = useRef<HTMLDivElement>(null);

  const SqlFormExtension = extensionsRegistry.get('sqleditor.extension.form');

  const isTempId = (value: unknown): boolean => Number.isNaN(Number(value));

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
      {
        name: 'switchTabToLeft',
        key: KeyboardShortcut.CtrlLeft,
        descr: KEY_MAP[KeyboardShortcut.CtrlLeft],
        func: () => {
          dispatch(switchQueryEditor(true));
        },
      },
      {
        name: 'switchTabToRight',
        key: KeyboardShortcut.CtrlRight,
        descr: KEY_MAP[KeyboardShortcut.CtrlRight],
        func: () => {
          dispatch(switchQueryEditor(false));
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
          const semicolonEnd = editor.find(';', {
            backwards: false,
            skipCurrent: true,
          });
          let end;
          if (semicolonEnd) {
            ({ end } = semicolonEnd);
          }
          if (!end || end.row < cursorPosition.row) {
            end = {
              row: totalLine + 1,
              column: 0,
            };
          }
          const semicolonStart = editor.find(';', {
            backwards: true,
            skipCurrent: true,
          });
          let start;
          if (semicolonStart) {
            start = semicolonStart.end;
          }
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
    if (isActive) {
      loadQueryEditor();
      window.addEventListener('beforeunload', onBeforeUnload);
    }

    return () => {
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

  const onResizeEnd = ([nHeight, sHeight]: number[]) => {
    const northPercent = Math.round((nHeight * 100) / (nHeight + sHeight));
    const southPercent = 100 - northPercent;

    setNorthPercent(northPercent);
    dispatch(persistEditorHeight(queryEditor, northPercent, southPercent));
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
    currentSQL.current = sql;
    dispatch(queryEditorSetSql(queryEditor, sql));
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

    const contributions =
      ExtensionsManager.getInstance().getMenuContributions('sqllab.editor');

    const secondaryContributions = (contributions?.secondary || []).map(
      contribution => {
        const command = ExtensionsManager.getInstance().getCommandContribution(
          contribution.command,
        )!;
        return {
          key: command.command,
          label: command.title,
          title: command.description,
          onClick: () => commands.executeCommand(command.command),
        };
      },
    );

    const menuItems: MenuItemType[] = [
      {
        key: 'render-html',
        label: (
          <div css={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('Render HTML')}</span>{' '}
            <Switch
              checked={renderHTMLEnabled}
              onChange={(checked, event) => {
                event.stopPropagation();
                handleToggleRenderHTMLEnabled();
              }}
            />
          </div>
        ),
      },
      {
        key: 'autocomplete',
        label: (
          <div css={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('Autocomplete')}</span>
            <Switch
              checked={autocompleteEnabled}
              onChange={(checked, event) => {
                event.stopPropagation();
                handleToggleAutocompleteEnabled();
              }}
            />
          </div>
        ),
      },
      isFeatureEnabled(FeatureFlag.EnableTemplateProcessing) && {
        key: 'template-params',
        label: (
          <TemplateParamsEditor
            language="json"
            onChange={params => {
              dispatch(queryEditorSetTemplateParams(qe, params));
            }}
            queryEditorId={qe.id}
          />
        ),
      },
      {
        key: 'format-sql',
        label: t('Format SQL'),
        onClick: () => formatCurrentQuery(),
      },
      !isEmpty(scheduledQueriesConf) && {
        key: 'schedule-query',
        label: (
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
        ),
      },
      {
        key: 'keyboard-shortcuts',
        label: (
          <KeyboardShortcutButton>
            {t('Keyboard shortcuts')}
          </KeyboardShortcutButton>
        ),
      },
      ...secondaryContributions,
    ].filter(Boolean) as MenuItemType[];

    return <Menu css={{ width: theme.sizeUnit * 50 }} items={menuItems} />;
  };

  const onSaveQuery = async (query: QueryPayload, clientId: string) => {
    const savedQuery = await dispatch(saveQuery(query, clientId));
    dispatch(addSavedQueryToTabState(queryEditor, savedQuery));
  };

  const renderEditorBottomBar = (hideActions: boolean) => {
    const { allow_ctas: allowCTAS, allow_cvas: allowCVAS } = database || {};

    const contributions =
      ExtensionsManager.getInstance().getMenuContributions('sqllab.editor');

    const primaryContributions = (contributions?.primary || []).map(
      contribution => {
        const command = ExtensionsManager.getInstance().getCommandContribution(
          contribution.command,
        )!;
        // @ts-ignore
        const Icon = Icons[command?.icon as IconNameType];

        return (
          <Button
            onClick={() => commands.executeCommand(command.command)}
            tooltip={command?.description}
            icon={<Icon iconSize="m" iconColor={theme.colorPrimary} />}
            buttonSize="small"
          >
            {command?.title}
          </Button>
        );
      },
    );

    const showMenu = allowCTAS || allowCVAS;
    const menuItems: MenuItemType[] = [
      allowCTAS && {
        key: '1',
        label: t('CREATE TABLE AS'),
        onClick: () => {
          logAction(LOG_ACTIONS_SQLLAB_CREATE_TABLE_AS, {
            shortcut: false,
          });
          setShowCreateAsModal(true);
          setCreateAs(CtasEnum.Table);
        },
      },
      allowCVAS && {
        key: '2',
        label: t('CREATE VIEW AS'),
        onClick: () => {
          logAction(LOG_ACTIONS_SQLLAB_CREATE_VIEW_AS, {
            shortcut: false,
          });
          setShowCreateAsModal(true);
          setCreateAs(CtasEnum.View);
        },
      },
    ].filter(Boolean) as MenuItemType[];

    const runMenuBtn = <Menu items={menuItems} />;

    return (
      <StyledToolbar className="sql-toolbar" id="js-sql-toolbar">
        {hideActions ? (
          <Alert
            type="warning"
            message={t(
              'The database that was used to generate this query could not be found',
            )}
            description={t(
              'Choose one of the available databases on the left panel.',
            )}
            closable={false}
          />
        ) : (
          <>
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
              <div>{primaryContributions}</div>
              <Dropdown
                popupRender={() => renderDropdown()}
                trigger={['click']}
              >
                <Button
                  buttonSize="xsmall"
                  showMarginRight={false}
                  buttonStyle="link"
                >
                  <Icons.EllipsisOutlined />
                </Button>
              </Dropdown>
            </div>
          </>
        )}
      </StyledToolbar>
    );
  };

  const handleCursorPositionChange = (newPosition: CursorPosition) => {
    dispatch(queryEditorSetCursorPosition(queryEditor, newPosition));
  };

  const copyQuery = (callback: (text: string) => void) => {
    callback(currentSQL.current);
  };
  const renderCopyQueryButton = () => (
    <Button type="primary">{t('COPY QUERY')}</Button>
  );

  const renderDatasetWarning = () => (
    <Alert
      css={css`
        margin-bottom: ${theme.sizeUnit * 2}px;
        padding-top: ${theme.sizeUnit * 4}px;
        .ant-alert-action {
          align-self: center;
        }
      `}
      type="info"
      action={
        <CopyToClipboard
          wrapText={false}
          copyNode={renderCopyQueryButton()}
          getText={copyQuery}
        />
      }
      description={
        <div
          css={css`
            display: flex;
            justify-content: space-between;
            align-items: center;
          `}
        >
          <div
            css={css`
              display: flex;
              flex-direction: column;
            `}
          >
            <p
              css={css`
                font-size: ${theme.fontSize}px;
                font-weight: ${theme.fontWeightStrong};
                color: ${theme.colorPrimaryText};
                margin: 0px;
              `}
            >
              {' '}
              {t(`You are edting a query from the virtual dataset `) +
                queryEditor.name}
            </p>
            <p
              css={css`
                font-size: ${theme.fontSize}px;
                font-weight: ${theme.fontWeightStrong};
                color: ${theme.colorPrimaryText};
                margin: 0px;
              `}
            >
              {t(
                'After making the changes, copy the query and paste in the virtual dataset SQL snippet settings.',
              )}{' '}
            </p>
          </div>
        </div>
      }
      message=""
    />
  );

  const queryPane = () => (
    <Splitter
      layout="vertical"
      onResizeStart={onResizeStart}
      onResizeEnd={onResizeEnd}
    >
      <Splitter.Panel
        min={queryEditor.isDataset ? 400 : 200}
        defaultSize={`${northPercent}%`}
        className="queryPane"
      >
        <div className="north-pane">
          {SqlFormExtension && (
            <SqlFormExtension
              queryEditorId={queryEditor.id}
              setQueryEditorAndSaveSqlWithDebounce={
                setQueryEditorAndSaveSqlWithDebounce
              }
              startQuery={startQuery}
            />
          )}
          {queryEditor.isDataset && renderDatasetWarning()}
          <div className="sql-container">
            <AutoSizer disableWidth>
              {({ height }) =>
                isActive && (
                  <AceEditorWrapper
                    autocomplete={
                      autocompleteEnabled && !isTempId(queryEditor.id)
                    }
                    onBlur={onSqlChanged}
                    onChange={onSqlChanged}
                    queryEditorId={queryEditor.id}
                    onCursorPositionChange={handleCursorPositionChange}
                    height={`${height}px`}
                    hotkeys={hotkeys}
                  />
                )
              }
            </AutoSizer>
          </div>
          {renderEditorBottomBar(showEmptyState)}
        </div>
      </Splitter.Panel>
      <Splitter.Panel className="queryPane">
        <SouthPane
          queryEditorId={queryEditor.id}
          latestQueryId={latestQuery?.id}
          displayLimit={displayLimit}
          defaultQueryLimit={defaultQueryLimit}
        />
      </Splitter.Panel>
    </Splitter>
  );

  const createViewModalTitle =
    createAs === CtasEnum.View ? 'CREATE VIEW AS' : 'CREATE TABLE AS';

  const createModalPlaceHolder =
    createAs === CtasEnum.View
      ? t('Specify name to CREATE VIEW AS schema in: public')
      : t('Specify name to CREATE TABLE AS schema in: public');

  const [width, setWidth] = useStoredSidebarWidth(
    `sqllab:${queryEditor.id}`,
    SQL_EDITOR_LEFTBAR_WIDTH,
  );

  const onSidebarChange = useCallback(
    (sizes: number[]) => {
      const [updatedWidth] = sizes;
      if (hideLeftBar || updatedWidth === 0) {
        dispatch(toggleLeftBar({ id: queryEditor.id, hideLeftBar }));
        if (hideLeftBar) {
          // Due to a bug in the splitter, the width must be changed
          // in order to properly restore the previous size
          setWidth(width + 0.01);
        }
      } else {
        setWidth(updatedWidth);
      }
    },
    [dispatch, hideLeftBar],
  );

  return (
    <StyledSqlEditor ref={sqlEditorRef} className="SqlEditor">
      <Splitter lazy onResizeEnd={onSidebarChange} onResize={noop}>
        <Splitter.Panel
          collapsible
          size={hideLeftBar ? 0 : width}
          min={SQL_EDITOR_LEFTBAR_WIDTH}
        >
          <StyledSidebar>
            <SqlEditorLeftBar
              database={database}
              queryEditorId={queryEditor.id}
            />
          </StyledSidebar>
        </Splitter.Panel>
        <Splitter.Panel>
          {shouldLoadQueryEditor ? (
            <div
              data-test="sqlEditor-loading"
              css={css`
                flex: 1;
                padding: ${theme.sizeUnit * 4}px;
              `}
            >
              <Skeleton active />
            </div>
          ) : showEmptyState && !hasSqlStatement ? (
            <EmptyState
              image="vector.svg"
              size="large"
              title={t('Select a database to write a query')}
              description={t(
                'Choose one of the available databases from the panel on the left.',
              )}
            />
          ) : (
            queryPane()
          )}
        </Splitter.Panel>
      </Splitter>
      <Modal
        show={showCreateAsModal}
        name={t(createViewModalTitle)}
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
