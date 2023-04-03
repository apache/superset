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
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { CSSTransition } from 'react-transition-group';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import Split from 'react-split';
import { css, FeatureFlag, styled, t, useTheme } from '@superset-ui/core';
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import Modal from 'src/components/Modal';
import Mousetrap from 'mousetrap';
import Button from 'src/components/Button';
import Timer from 'src/components/Timer';
import ResizableSidebar from 'src/components/ResizableSidebar';
import { AntdDropdown, AntdSwitch } from 'src/components';
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
  queryEditorSetAndSaveSql,
  queryEditorSetTemplateParams,
  runQueryFromSqlEditor,
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
  SQL_EDITOR_LEFTBAR_WIDTH,
  SQL_EDITOR_PADDING,
  INITIAL_NORTH_PERCENT,
  INITIAL_SOUTH_PERCENT,
  SET_QUERY_EDITOR_SQL_DEBOUNCE_MS,
  VALIDATION_DEBOUNCE_MS,
  WINDOW_RESIZE_THROTTLE_MS,
} from 'src/SqlLab/constants';
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { isFeatureEnabled } from 'src/featureFlags';
import { EmptyStateBig } from 'src/components/EmptyState';
import getBootstrapData from 'src/utils/getBootstrapData';
import { isEmpty } from 'lodash';
import TemplateParamsEditor from '../TemplateParamsEditor';
import SouthPane from '../SouthPane';
import SaveQuery from '../SaveQuery';
import ScheduleQueryButton from '../ScheduleQueryButton';
import EstimateQueryCostButton from '../EstimateQueryCostButton';
import ShareSqlLabQuery from '../ShareSqlLabQuery';
import SqlEditorLeftBar from '../SqlEditorLeftBar';
import AceEditorWrapper from '../AceEditorWrapper';
import RunQueryActionButton from '../RunQueryActionButton';
import QueryLimitSelect from '../QueryLimitSelect';

const bootstrapData = getBootstrapData();
const validatorMap =
  bootstrapData?.common?.conf?.SQL_VALIDATORS_BY_ENGINE || {};
const scheduledQueriesConf = bootstrapData?.common?.conf?.SCHEDULED_QUERIES;

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

const StyledSidebar = styled.div`
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

const propTypes = {
  tables: PropTypes.array.isRequired,
  queryEditor: PropTypes.object.isRequired,
  defaultQueryLimit: PropTypes.number.isRequired,
  maxRow: PropTypes.number.isRequired,
  displayLimit: PropTypes.number.isRequired,
  saveQueryWarning: PropTypes.string,
  scheduleQueryWarning: PropTypes.string,
};

const SqlEditor = ({
  tables,
  queryEditor,
  defaultQueryLimit,
  maxRow,
  displayLimit,
  saveQueryWarning,
  scheduleQueryWarning = null,
}) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const { database, latestQuery, hideLeftBar } = useSelector(
    ({ sqlLab: { unsavedQueryEditor, databases, queries } }) => {
      let { dbId, latestQueryId, hideLeftBar } = queryEditor;
      if (unsavedQueryEditor.id === queryEditor.id) {
        dbId = unsavedQueryEditor.dbId || dbId;
        latestQueryId = unsavedQueryEditor.latestQueryId || latestQueryId;
        hideLeftBar = unsavedQueryEditor.hideLeftBar || hideLeftBar;
      }
      return {
        database: databases[dbId],
        latestQuery: queries[latestQueryId],
        hideLeftBar,
      };
    },
  );

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
    getItem(LocalStorageKeys.sqllab__is_autocomplete_enabled, true),
  );
  const [showCreateAsModal, setShowCreateAsModal] = useState(false);
  const [createAs, setCreateAs] = useState('');
  const [showEmptyState, setShowEmptyState] = useState(false);

  const sqlEditorRef = useRef(null);
  const northPaneRef = useRef(null);

  const startQuery = useCallback(
    (ctasArg = false, ctas_method = CtasEnum.TABLE) => {
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
    const base = [
      {
        name: 'runQuery1',
        key: 'ctrl+r',
        descr: t('Run query'),
        func: () => {
          if (queryEditor.sql.trim() !== '') {
            startQuery();
          }
        },
      },
      {
        name: 'runQuery2',
        key: 'ctrl+enter',
        descr: t('Run query'),
        func: () => {
          if (queryEditor.sql.trim() !== '') {
            startQuery();
          }
        },
      },
      {
        name: 'newTab',
        key: userOS === 'Windows' ? 'ctrl+q' : 'ctrl+t',
        descr: t('New tab'),
        func: () => {
          dispatch(addNewQueryEditor());
        },
      },
      {
        name: 'stopQuery',
        key: userOS === 'MacOS' ? 'ctrl+x' : 'ctrl+e',
        descr: t('Stop query'),
        func: stopQuery,
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
  }, [dispatch, queryEditor.sql, startQuery, stopQuery]);

  const handleWindowResize = useCallback(() => {
    setHeight(getSqlEditorHeight());
  }, []);

  const handleWindowResizeWithThrottle = useMemo(
    () => throttle(handleWindowResize, WINDOW_RESIZE_THROTTLE_MS),
    [handleWindowResize],
  );

  const onBeforeUnload = useCallback(
    event => {
      if (
        database?.extra_json?.cancel_query_on_windows_unload &&
        latestQuery?.state === 'running'
      ) {
        event.preventDefault();
        stopQuery();
      }
    },
    [
      database?.extra_json?.cancel_query_on_windows_unload,
      latestQuery?.state,
      stopQuery,
    ],
  );

  useEffect(() => {
    // We need to measure the height of the sql editor post render to figure the height of
    // the south pane so it gets rendered properly
    setHeight(getSqlEditorHeight());
    if (!database || isEmpty(database)) {
      setShowEmptyState(true);
    }

    window.addEventListener('resize', handleWindowResizeWithThrottle);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('resize', handleWindowResizeWithThrottle);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [database, handleWindowResizeWithThrottle, onBeforeUnload]);

  useEffect(() => {
    // setup hotkeys
    Mousetrap.reset();
    const hotkeys = getHotkeyConfig();
    hotkeys.forEach(keyConfig => {
      Mousetrap.bind([keyConfig.key], keyConfig.func);
    });
  }, [getHotkeyConfig, latestQuery]);

  const onResizeStart = () => {
    // Set the heights on the ace editor and the ace content area after drag starts
    // to smooth out the visual transition to the new heights when drag ends
    document.getElementsByClassName('ace_content')[0].style.height = '100%';
  };

  const onResizeEnd = ([northPercent, southPercent]) => {
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

  const canValidateQuery = () => {
    // Check whether or not we can validate the current query based on whether
    // or not the backend has a validator configured for it.
    if (database) {
      return validatorMap.hasOwnProperty(database.backend);
    }
    return false;
  };

  const requestValidation = useCallback(
    sql => {
      if (database) {
        dispatch(validateQuery(queryEditor, sql));
      }
    },
    [database, dispatch, queryEditor],
  );

  const requestValidationWithDebounce = useMemo(
    () => debounce(requestValidation, VALIDATION_DEBOUNCE_MS),
    [requestValidation],
  );

  const onSqlChanged = sql => {
    dispatch(queryEditorSetSql(queryEditor, sql));
    setQueryEditorAndSaveSqlWithDebounce(sql);
    // Request server-side validation of the query text
    if (canValidateQuery()) {
      // NB. requestValidation is debounced
      requestValidationWithDebounce(sql);
    }
  };

  // Return the heights for the ace editor and the south pane as an object
  // given the height of the sql editor, north pane percent and south pane percent.
  const getAceEditorAndSouthPaneHeights = (
    height,
    northPercent,
    southPercent,
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
    if (database) {
      dispatch(estimateQueryCost(queryEditor));
    }
  };

  const handleToggleAutocompleteEnabled = () => {
    setItem(
      LocalStorageKeys.sqllab__is_autocomplete_enabled,
      !autocompleteEnabled,
    );
    setAutocompleteEnabled(!autocompleteEnabled);
  };

  const elementStyle = (dimension, elementSize, gutterSize) => ({
    [dimension]: `calc(${elementSize}% - ${
      gutterSize + SQL_EDITOR_GUTTER_MARGIN
    }px)`,
  });

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

  const ctasChanged = event => {
    setCtas(event.target.value);
  };

  const renderDropdown = () => {
    const qe = queryEditor;
    const successful = latestQuery?.state === 'success';
    const scheduleToolTip = successful
      ? t('Schedule the query periodically')
      : t('You must run the query successfully first');
    return (
      <Menu css={{ width: theme.gridUnit * 44 }}>
        <Menu.Item css={{ display: 'flex', justifyContent: 'space-between' }}>
          {' '}
          <span>{t('Autocomplete')}</span>{' '}
          <AntdSwitch
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
              queryEditorId={qe.id}
            />
          </Menu.Item>
        )}
        {!isEmpty(scheduledQueriesConf) && (
          <Menu.Item>
            <ScheduleQueryButton
              defaultLabel={qe.name}
              sql={qe.sql}
              onSchedule={query => dispatch(scheduleQuery(query))}
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

  const onSaveQuery = async (query, clientId) => {
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
              queryEditorId={queryEditor.id}
              queryState={latestQuery?.state}
              runQuery={runQuery}
              stopQuery={stopQuery}
              overlayCreateAsMenu={showMenu ? runMenuBtn : null}
            />
          </span>
          {isFeatureEnabled(FeatureFlag.ESTIMATE_QUERY_COST) &&
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
              state={STATE_TYPE_MAP[latestQuery.state]}
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
              onUpdate={(query, remoteId, id) =>
                dispatch(updateSavedQuery(query, remoteId, id))
              }
              saveQueryWarning={saveQueryWarning}
              database={database}
            />
          </span>
          <span>
            <ShareSqlLabQuery queryEditorId={queryEditor.id} />
          </span>
          <AntdDropdown overlay={renderDropdown()} trigger="click">
            <Icons.MoreHoriz iconColor={theme.colors.grayscale.base} />
          </AntdDropdown>
        </div>
      </StyledToolbar>
    );
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
            autocomplete={autocompleteEnabled}
            onBlur={setQueryEditorAndSaveSql}
            onChange={onSqlChanged}
            queryEditorId={queryEditor.id}
            database={database}
            extendedTables={tables}
            height={`${aceEditorHeight}px`}
            hotkeys={hotkeys}
          />
          {renderEditorBottomBar(hotkeys)}
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
    createAs === CtasEnum.VIEW ? 'CREATE VIEW AS' : 'CREATE TABLE AS';

  const createModalPlaceHolder =
    createAs === CtasEnum.VIEW
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
                tables={tables}
                setEmptyState={bool => setShowEmptyState(bool)}
              />
            </StyledSidebar>
          )}
        </ResizableSidebar>
      </CSSTransition>
      {showEmptyState ? (
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
        visible={showCreateAsModal}
        title={t(createViewModalTitle)}
        onHide={() => setShowCreateAsModal(false)}
        footer={
          <>
            <Button onClick={() => setShowCreateAsModal(false)}>
              {t('Cancel')}
            </Button>
            {createAs === CtasEnum.TABLE && (
              <Button
                buttonStyle="primary"
                disabled={ctas.length === 0}
                onClick={createTableAs}
              >
                {t('Create')}
              </Button>
            )}
            {createAs === CtasEnum.VIEW && (
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

SqlEditor.propTypes = propTypes;

export default SqlEditor;
