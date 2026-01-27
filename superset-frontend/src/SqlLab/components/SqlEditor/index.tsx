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
import { t } from '@apache-superset/core';
import {
  FeatureFlag,
  isFeatureEnabled,
  getExtensionsRegistry,
  QueryResponse,
  Query,
} from '@superset-ui/core';
import { css, styled, useTheme, Alert } from '@apache-superset/core/ui';
import type {
  QueryEditor,
  SqlLabRootState,
  CursorPosition,
} from 'src/SqlLab/types';
import type { DatabaseObject } from 'src/features/databases/types';
import { debounce, isEmpty } from 'lodash';
import Mousetrap from 'mousetrap';
import {
  Button,
  Divider,
  EmptyState,
  Input,
  Modal,
} from '@superset-ui/core/components';
import { Splitter } from 'src/components/Splitter';
import { Skeleton } from '@superset-ui/core/components/Skeleton';
import { Switch } from '@superset-ui/core/components/Switch';
import { Menu, MenuItemType } from '@superset-ui/core/components/Menu';
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
} from 'src/SqlLab/actions/sqlLab';
import {
  SQL_EDITOR_GUTTER_HEIGHT,
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
import { CopyToClipboard } from 'src/components';
import TemplateParamsEditor from '../TemplateParamsEditor';
import SouthPane from '../SouthPane';
import SaveQuery, { QueryPayload } from '../SaveQuery';
import ScheduleQueryButton from '../ScheduleQueryButton';
import EstimateQueryCostButton from '../EstimateQueryCostButton';
import ShareSqlLabQuery from '../ShareSqlLabQuery';
import AceEditorWrapper from '../AceEditorWrapper';
import RunQueryActionButton from '../RunQueryActionButton';
import QueryLimitSelect from '../QueryLimitSelect';
import KeyboardShortcutButton, {
  KEY_MAP,
  KeyboardShortcut,
} from '../KeyboardShortcutButton';
import SqlEditorTopBar from '../SqlEditorTopBar';

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
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.sizeUnit}px;
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

const StyledSqlEditor = styled.div`
  ${({ theme }) => css`
    height: 100%;

    .queryPane {
      padding: 0;
      + .ant-splitter-bar .ant-splitter-bar-dragger {
        &::before {
          height: 1px;
          background-color: ${theme.colorBorder};
          transform: translateX(-50%) !important;
        }
        &::after {
          height: ${SQL_EDITOR_GUTTER_HEIGHT}px;
          background: transparent;
          border-top: 1px solid ${theme.colorBorder};
          border-bottom: 1px solid ${theme.colorBorder};
          transform: translate(-50%, -2px);
        }
      }
    }

    .north-pane {
      padding: ${theme.sizeUnit * 2}px 0 0 0;
      height: 100%;
      margin: 0 ${theme.sizeUnit * 4}px;
    }

    .SouthPane {
      & .ant-tabs-tabpane {
        margin: 0 ${theme.sizeUnit * 4}px;
        & .ant-tabs {
          margin: 0 ${theme.sizeUnit * -4}px;
        }
      }
      & .ant-tabs-tab {
        box-shadow: none !important;
        background: transparent !important;
        border-color: transparent !important;
        margin-top: ${theme.sizeUnit * 2}px !important;
        &.ant-tabs-tab-active {
          border-bottom-color: ${theme.colorPrimary} !important;
          & .ant-tabs-tab-btn {
            font-weight: ${theme.fontWeightStrong};
            color: ${theme.colorTextBase} !important;
            text-shadow: none !important;
          }
        }
      }
    }

    .sql-container {
      flex: 1 1 auto;
      margin: 0 ${theme.sizeUnit * -4}px;
      box-shadow: 0 0 0 1px ${theme.colorBorder};
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

  const { database, latestQuery, currentQueryEditorId, hasSqlStatement } =
    useSelector<
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

  const SqlFormExtension = extensionsRegistry.get('sqleditor.extension.form');

  const startQuery = useCallback(
    (ctasArg = false, ctas_method = CtasEnum.Table) => {
      if (!database) {
        return;
      }

      dispatch(
        runQueryFromSqlEditor(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          database as any,
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
    (sql: string) => {
      dispatch(queryEditorSetAndSaveSql(queryEditor, sql, undefined));
    },
    [dispatch, queryEditor],
  );

  const setQueryEditorAndSaveSqlWithDebounce = useMemo(
    () => debounce(setQueryEditorAndSaveSql, SET_QUERY_EDITOR_SQL_DEBOUNCE_MS),
    [setQueryEditorAndSaveSql],
  );

  const onSqlChanged = useEffectEvent((sql: string) => {
    currentSQL.current = sql;
    dispatch(queryEditorSetSql(queryEditor, sql, undefined));
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

  const getSecondaryMenuItems = () => {
    const qe = queryEditor;
    const successful = latestQuery?.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');

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
    ].filter(Boolean) as MenuItemType[];

    return menuItems;
  };

  const onSaveQuery = async (query: QueryPayload, clientId: string) => {
    const savedQuery = await dispatch(saveQuery(query, clientId));
    dispatch(addSavedQueryToTabState(queryEditor, savedQuery));
  };

  const renderEditorPrimaryAction = () => {
    const { allow_ctas: allowCTAS, allow_cvas: allowCVAS } = database || {};
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
      <>
        <RunQueryActionButton
          queryEditorId={queryEditor.id}
          queryState={latestQuery?.state}
          runQuery={runQuery}
          stopQuery={stopQuery}
          overlayCreateAsMenu={showMenu ? runMenuBtn : null}
        />
        <QueryLimitSelect
          queryEditorId={queryEditor.id}
          maxRow={maxRow}
          defaultQueryLimit={defaultQueryLimit}
        />
        <Divider type="vertical" />
        {isFeatureEnabled(FeatureFlag.EstimateQueryCost) &&
          database?.allows_cost_estimate && (
            <EstimateQueryCostButton
              getEstimate={getQueryCostEstimate}
              queryEditorId={queryEditor.id}
              tooltip={t('Estimate the cost before running a query')}
            />
          )}
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
        <ShareSqlLabQuery queryEditorId={queryEditor.id} />
      </>
    );
  };

  const renderEmptyAlert = () => (
    <StyledToolbar className="sql-toolbar" id="js-sql-toolbar">
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
    </StyledToolbar>
  );

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
              {t(`You are editing a query from the virtual dataset `) +
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
          {showEmptyState ? (
            renderEmptyAlert()
          ) : (
            <SqlEditorTopBar
              queryEditorId={queryEditor.id}
              defaultPrimaryActions={renderEditorPrimaryAction()}
              defaultSecondaryActions={getSecondaryMenuItems()}
            />
          )}
          {queryEditor.isDataset && renderDatasetWarning()}
          <div className="sql-container">
            <AutoSizer disableWidth>
              {({ height }) =>
                isActive && (
                  <AceEditorWrapper
                    autocomplete={autocompleteEnabled}
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
          {SqlFormExtension && (
            <SqlFormExtension
              queryEditorId={queryEditor.id}
              setQueryEditorAndSaveSqlWithDebounce={
                setQueryEditorAndSaveSqlWithDebounce
              }
              startQuery={startQuery}
            />
          )}
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

  return (
    <StyledSqlEditor className="SqlEditor">
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
