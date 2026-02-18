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
import {
  useCallback,
  useEffect,
  useState,
  memo,
  ChangeEvent,
  MouseEvent,
  useMemo,
} from 'react';

import AutoSizer from 'react-virtualized-auto-sizer';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { pick } from 'lodash';
import {
  Button,
  ButtonGroup,
  Divider,
  Tooltip,
  Input,
  Label,
} from '@superset-ui/core/components';
import {
  CopyToClipboard,
  FilterableTable,
  ErrorMessageWithStackTrace,
} from 'src/components';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core';
import {
  QueryState,
  usePrevious,
  getNumberFormatter,
  getExtensionsRegistry,
  ErrorTypeEnum,
} from '@superset-ui/core';
import { tn } from '@apache-superset/core';
import { styled, useTheme, css, Alert } from '@apache-superset/core/ui';
import {
  ISaveableDatasource,
  ISimpleColumn,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { EXPLORE_CHART_DEFAULT, SqlLabRootState } from 'src/SqlLab/types';
import { mountExploreUrl } from 'src/explore/exploreUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import { getItem, LocalStorageKeys } from 'src/utils/localStorageHelpers';
import {
  addQueryEditor,
  clearQueryResults,
  CtasEnum,
  fetchQueryResults,
  reFetchQueryResults,
  reRunQuery,
} from 'src/SqlLab/actions/sqlLab';
import { URL_PARAMS } from 'src/constants';
import useLogAction from 'src/logger/useLogAction';
import {
  LOG_ACTIONS_SQLLAB_COPY_RESULT_TO_CLIPBOARD,
  LOG_ACTIONS_SQLLAB_CREATE_CHART,
  LOG_ACTIONS_SQLLAB_DOWNLOAD_CSV,
} from 'src/logger/LogUtils';
import { Icons } from '@superset-ui/core/components/Icons';
import { findPermission } from 'src/utils/findPermission';
import { StreamingExportModal } from 'src/components/StreamingExportModal';
import { useStreamingExport } from 'src/components/StreamingExportModal/useStreamingExport';
import { useConfirmModal } from 'src/hooks/useConfirmModal';
import { makeUrl } from 'src/utils/pathUtils';
import ExploreCtasResultsButton from '../ExploreCtasResultsButton';
import ExploreResultsButton from '../ExploreResultsButton';
import HighlightedSql from '../HighlightedSql';
import PanelToolbar from 'src/components/PanelToolbar';
import { ViewLocations } from 'src/SqlLab/contributions';

enum LimitingFactor {
  Query = 'QUERY',
  QueryAndDropdown = 'QUERY_AND_DROPDOWN',
  Dropdown = 'DROPDOWN',
  NotLimited = 'NOT_LIMITED',
}

export interface ResultSetProps {
  cache?: boolean;
  csv?: boolean;
  database?: Record<string, any>;
  displayLimit: number;
  height?: number;
  queryId: string;
  search?: boolean;
  showSql?: boolean;
  showSqlInline?: boolean;
  visualize?: boolean;
  defaultQueryLimit: number;
  useFixedHeight?: boolean;
}

const ResultContainer = styled.div`
  display: flex;
  flex-direction: column;
  row-gap: ${({ theme }) => theme.sizeUnit * 2}px;
  height: 100%;
`;

const ResultlessStyles = styled.div`
  position: relative;
  min-height: ${({ theme }) => theme.sizeUnit * 25}px;
  [role='alert'] {
    margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  }
  .sql-result-track-job {
    margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  }
`;

// Making text render line breaks/tabs as is as monospace,
// but wrapping text too so text doesn't overflow
const MonospaceDiv = styled.div`
  font-family: ${({ theme }) => theme.fontFamilyCode};
  white-space: pre;
  word-break: break-word;
  overflow-x: auto;
  white-space: pre-wrap;
`;

const ReturnedRows = styled.div`
  font-size: ${({ theme }) => theme.fontSizeSM}px;
  line-height: 1;
`;

const ResultSetButtons = styled.div`
  display: grid;
  grid-auto-flow: column;
`;

const GAP = 8;

const extensionsRegistry = getExtensionsRegistry();
const EMPTY: string[] = [];

const ResultSet = ({
  cache = false,
  csv = true,
  database = {},
  displayLimit,
  height,
  queryId,
  search = true,
  showSql = false,
  showSqlInline = false,
  visualize = true,
  defaultQueryLimit,
  useFixedHeight = false,
}: ResultSetProps) => {
  const user = useSelector(({ user }: SqlLabRootState) => user, shallowEqual);
  const streamingThreshold = useSelector(
    (state: SqlLabRootState) =>
      state.common?.conf?.CSV_STREAMING_ROW_THRESHOLD || 1000,
  );
  const query = useSelector(
    ({ sqlLab: { queries } }: SqlLabRootState) =>
      pick(queries[queryId], [
        'id',
        'errorMessage',
        'cached',
        'results',
        'resultsKey',
        'dbId',
        'tab',
        'sql',
        'executedSql',
        'sqlEditorId',
        'sqlEditorImmutableId',
        'templateParams',
        'schema',
        'rows',
        'queryLimit',
        'limitingFactor',
        'trackingUrl',
        'state',
        'errors',
        'link',
        'ctas',
        'ctas_method',
        'tempSchema',
        'tempTable',
        'isDataPreview',
        'progress',
        'extra',
      ]),
    shallowEqual,
  );
  const ResultTable =
    extensionsRegistry.get('sqleditor.extension.resultTable') ??
    FilterableTable;
  const theme = useTheme();
  const [searchText, setSearchText] = useState('');
  const [cachedData, setCachedData] = useState<Record<string, unknown>[]>([]);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const [showStreamingModal, setShowStreamingModal] = useState(false);
  const orderedColumnKeys = useMemo(
    () => query.results?.columns?.map(col => col.column_name) ?? EMPTY,
    [query.results?.columns],
  );
  const expandedColumns = useMemo(
    () => query.results?.expanded_columns?.map(col => col.column_name) ?? EMPTY,
    [query.results?.expanded_columns],
  );

  const history = useHistory();
  const dispatch = useDispatch();
  const logAction = useLogAction({ queryId, sqlEditorId: query.sqlEditorId });
  const { showConfirm, ConfirmModal } = useConfirmModal();

  const { progress, startExport, resetExport, retryExport, cancelExport } =
    useStreamingExport({
      onComplete: () => {},
      onError: error => {
        addDangerToast(t('Export failed: %s', error));
      },
    });

  const reRunQueryIfSessionTimeoutErrorOnMount = useCallback(() => {
    if (
      query.errorMessage &&
      query.errorMessage.indexOf('session timed out') > 0
    ) {
      dispatch(reRunQuery(query));
    }
  }, []);

  useEffect(() => {
    // only do this the first time the component is rendered/mounted
    reRunQueryIfSessionTimeoutErrorOnMount();
  }, [reRunQueryIfSessionTimeoutErrorOnMount]);

  const fetchResults = (q: typeof query, timeout?: number) => {
    dispatch(fetchQueryResults(q, displayLimit, timeout));
  };

  const prevQuery = usePrevious(query);
  useEffect(() => {
    if (cache && query.cached && query?.results?.data?.length > 0) {
      setCachedData(query.results.data);
      dispatch(clearQueryResults(query));
    }
    if (query.resultsKey && query.resultsKey !== prevQuery?.resultsKey) {
      fetchResults(query);
    }
  }, [query, cache]);

  const popSelectStar = (tempSchema: string | null, tempTable: string) => {
    const qe = {
      id: nanoid(11),
      name: tempTable,
      autorun: false,
      dbId: query.dbId,
      sql: `SELECT * FROM ${tempSchema ? `${tempSchema}.` : ''}${tempTable}`,
    };
    dispatch(addQueryEditor(qe));
  };

  const changeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  const createExploreResultsOnClick = async (clickEvent: MouseEvent) => {
    const { results } = query;

    const openInNewWindow = clickEvent.metaKey;
    logAction(LOG_ACTIONS_SQLLAB_CREATE_CHART, {});
    if (results?.query_id) {
      const key = await postFormData(results.query_id, 'query', {
        ...EXPLORE_CHART_DEFAULT,
        datasource: `${results.query_id}__query`,

        all_columns: results.columns.map(column => column.column_name),
      });
      const force = false;
      const includeAppRoot = openInNewWindow;
      const url = mountExploreUrl(
        'base',
        {
          [URL_PARAMS.formDataKey.name]: key,
        },
        force,
        includeAppRoot,
      );
      if (openInNewWindow) {
        window.open(url, '_blank', 'noreferrer');
      } else {
        history.push(url);
      }
    } else {
      addDangerToast(t('Unable to create chart without a query id.'));
    }
  };

  const getExportCsvUrl = (clientId: string) =>
    makeUrl(`/api/v1/sqllab/export/${clientId}/`);

  const handleCloseStreamingModal = () => {
    cancelExport();
    setShowStreamingModal(false);
    resetExport();
  };

  const shouldUseStreamingExport = () => {
    const { rows, queryLimit, limitingFactor } = query;
    const limit = queryLimit || query.results?.query?.limit;
    const rowsCount = Math.min(rows || 0, query.results?.data?.length || 0);

    let actualRowCount = rowsCount;

    if (limitingFactor === LimitingFactor.NotLimited && rows) {
      actualRowCount = rows;
    } else if (limit) {
      actualRowCount = Math.max(actualRowCount, limit);
    }

    return actualRowCount >= streamingThreshold;
  };

  const renderControls = () => {
    if (search || visualize || csv) {
      const { limitingFactor, queryLimit, results, rows } = query;
      const limit = queryLimit || results.query.limit;
      const rowsCount = Math.min(rows || 0, results?.data?.length || 0);
      let { data } = query.results;
      if (cache && query.cached) {
        data = cachedData;
      }
      const { columns } = query.results;

      const datasource: ISaveableDatasource = {
        columns: query.results.columns as ISimpleColumn[],
        name: query?.tab || 'Untitled',
        dbId: query?.dbId,
        sql: query?.sql,
        templateParams: query?.templateParams,
        schema: query?.schema,
      };

      const canExportData = findPermission(
        'can_export_csv',
        'SQLLab',
        user?.roles,
      );

      const handleDownloadCsv = (event: React.MouseEvent<HTMLElement>) => {
        logAction(LOG_ACTIONS_SQLLAB_DOWNLOAD_CSV, {});

        if (limitingFactor === LimitingFactor.Dropdown && limit === rowsCount) {
          event.preventDefault();

          showConfirm({
            title: t('Download is on the way'),
            body: t(
              'Downloading %(rows)s rows based on the LIMIT configuration. If you want the entire result set, you need to adjust the LIMIT.',
              { rows: rowsCount.toLocaleString() },
            ),
            onConfirm: () => {
              window.location.href = getExportCsvUrl(query.id);
            },
            confirmText: t('OK'),
            cancelText: t('Close'),
          });
        }
      };

      const defaultPrimaryActions = (
        <>
          {visualize && database?.allows_virtual_table_explore && (
            <ExploreResultsButton
              database={database}
              onClick={createExploreResultsOnClick}
            />
          )}
          {csv && canExportData && (
            <Button
              buttonSize="small"
              variant="text"
              color="primary"
              icon={<Icons.DownloadOutlined iconSize="m" />}
              tooltip={t('Download to CSV')}
              aria-label={t('Download to CSV')}
              {...(!shouldUseStreamingExport() && {
                href: getExportCsvUrl(query.id),
              })}
              data-test="export-csv-button"
              onClick={e => {
                const useStreaming = shouldUseStreamingExport();

                if (useStreaming) {
                  e.preventDefault();
                  setShowStreamingModal(true);

                  startExport({
                    url: makeUrl('/api/v1/sqllab/export_streaming/'),
                    payload: { client_id: query.id },
                    exportType: 'csv',
                    expectedRows: rows,
                  });
                } else {
                  handleDownloadCsv(e);
                }
              }}
            />
          )}
          {canExportData && (
            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(
                data,
                columns.map(c => c.column_name),
              )}
              wrapped={false}
              copyNode={
                <Button
                  buttonSize="small"
                  variant="text"
                  color="primary"
                  icon={<Icons.CopyOutlined iconSize="m" />}
                  tooltip={t('Copy to Clipboard')}
                  aria-label={t('Copy to Clipboard')}
                  data-test="copy-to-clipboard-button"
                />
              }
              hideTooltip
              onCopyEnd={() =>
                logAction(LOG_ACTIONS_SQLLAB_COPY_RESULT_TO_CLIPBOARD, {})
              }
            />
          )}
        </>
      );

      return (
        <ResultSetButtons>
          <SaveDatasetModal
            visible={showSaveDatasetModal}
            onHide={() => setShowSaveDatasetModal(false)}
            buttonTextOnSave={t('Save & Explore')}
            buttonTextOnOverwrite={t('Overwrite & Explore')}
            modalDescription={t(
              'Save this query as a virtual dataset to continue exploring',
            )}
            datasource={datasource}
          />
          <PanelToolbar
            viewId={ViewLocations.sqllab.results}
            defaultPrimaryActions={defaultPrimaryActions}
          />
        </ResultSetButtons>
      );
    }
    return null;
  };

  const renderRowsReturned = () => {
    const { results, rows, queryLimit, limitingFactor } = query;
    let limitMessage = '';
    const limitReached = results?.displayLimitReached;
    const limit = queryLimit || results.query.limit;
    const shouldUseDefaultDropdownAlert =
      limit === defaultQueryLimit && limitingFactor === LimitingFactor.Dropdown;

    if (limitingFactor === LimitingFactor.Query && csv) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the query',
        { rows },
      );
    } else if (
      limitingFactor === LimitingFactor.Dropdown &&
      !shouldUseDefaultDropdownAlert
    ) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the limit dropdown.',
        { rows },
      );
    } else if (limitingFactor === LimitingFactor.QueryAndDropdown) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the query and limit dropdown.',
        { rows },
      );
    } else if (shouldUseDefaultDropdownAlert) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the dropdown.',
        { rows },
      );
    } else if (limitReached) {
      limitMessage = t(
        'The number of results displayed is limited to %(rows)d.',
        { rows },
      );
    }

    const formattedRowCount = getNumberFormatter()(rows);
    const rowsReturnedMessage = t('%(rows)d rows returned', {
      rows,
    });

    const hasWarning = !!limitMessage;
    const tooltipText = hasWarning
      ? `${rowsReturnedMessage}. ${limitMessage}`
      : rowsReturnedMessage;

    return (
      <ReturnedRows>
        <Tooltip
          id="sqllab-rowcount-tooltip"
          title={tooltipText}
          placement="left"
        >
          <Label
            monospace
            css={css`
              line-height: ${theme.fontSizeLG}px;
            `}
          >
            {hasWarning && (
              <Icons.WarningOutlined
                css={css`
                  font-size: ${theme.fontSize}px;
                  margin-right: ${theme.sizeUnit}px;
                  color: ${theme.colorWarning};
                `}
              />
            )}
            {tn('%s row', '%s rows', rows, formattedRowCount)}
          </Label>
        </Tooltip>
      </ReturnedRows>
    );
  };

  let sql;
  let exploreDBId = query.dbId;
  if (database?.explore_database_id) {
    exploreDBId = database.explore_database_id;
  }

  let trackingUrl;
  if (
    query.trackingUrl &&
    query.state !== QueryState.Success &&
    query.state !== QueryState.Fetching
  ) {
    trackingUrl = (
      <Button
        className="sql-result-track-job"
        buttonSize="small"
        href={query.trackingUrl}
        target="_blank"
      >
        {query.state === QueryState.Running
          ? t('Track job')
          : t('See query details')}
      </Button>
    );
  }

  if (showSql) {
    sql = (
      <HighlightedSql
        sql={query.sql}
        rawSql={query.executedSql}
        {...(showSqlInline && { maxLines: 1, maxWidth: 60 })}
      />
    );
  }

  if (query.state === QueryState.Stopped) {
    return <Alert type="warning" message={t('Query was stopped')} />;
  }

  if (query.state === QueryState.Failed) {
    const errors = [...(query.extra?.errors || []), ...(query.errors || [])];

    return (
      <ResultlessStyles>
        {errors.map((error, index) => (
          <ErrorMessageWithStackTrace
            key={index}
            title={t('Database error')}
            error={error}
            subtitle={<MonospaceDiv>{error.message}</MonospaceDiv>}
            copyText={error.message || undefined}
            link={query.link}
            source="sqllab"
          />
        ))}
        {errors.some(
          error => error?.error_type === ErrorTypeEnum.FRONTEND_TIMEOUT_ERROR,
        ) ? (
          <Button
            className="sql-result-track-job"
            buttonSize="small"
            onClick={() => fetchResults(query, 0)}
          >
            {t('Retry fetching results')}
          </Button>
        ) : (
          trackingUrl
        )}
      </ResultlessStyles>
    );
  }

  if (query.state === QueryState.Success && query.ctas) {
    const { tempSchema, tempTable } = query;
    let object = 'Table';
    if (query.ctas_method === CtasEnum.View) {
      object = 'View';
    }
    return (
      <div>
        <Alert
          type="info"
          message={
            <>
              {t(object)} [
              <strong>
                {tempSchema ? `${tempSchema}.` : ''}
                {tempTable}
              </strong>
              ] {t('was created')} &nbsp;
              <ButtonGroup>
                <Button
                  buttonSize="small"
                  css={{ marginRight: theme.sizeUnit }}
                  onClick={() => popSelectStar(tempSchema, tempTable)}
                >
                  {t('Query in a new tab')}
                </Button>
                <ExploreCtasResultsButton
                  table={tempTable}
                  schema={tempSchema}
                  dbId={exploreDBId}
                />
              </ButtonGroup>
            </>
          }
        />
      </div>
    );
  }

  if (query.state === QueryState.Success && query.results) {
    const { results } = query;
    let data;
    if (cache && query.cached) {
      data = cachedData;
    } else if (results?.data) {
      ({ data } = results);
    }
    if (data && data.length > 0) {
      const allowHTML = getItem(
        LocalStorageKeys.SqllabIsRenderHtmlEnabled,
        true,
      );

      const tableProps = {
        data,
        queryId: query.id,
        orderedColumnKeys,
        filterText: searchText,
        expandedColumns,
        allowHTML,
      };

      return (
        <>
          <ResultContainer>
            <div
              css={css`
                display: flex;
                align-items: center;
                gap: ${GAP}px;

                & .ant-divider {
                  height: ${theme.sizeUnit * 6}px;
                  margin: 0 ${theme.sizeUnit * 2}px 0 0;
                }
              `}
            >
              {renderControls()}
              <Divider type="vertical" />
              {showSql && (
                <>
                  <div
                    css={css`
                      flex: 0 1 auto;
                      min-width: 0;
                      overflow: hidden;
                      margin-right: ${theme.sizeUnit}px;

                      & * {
                        overflow: hidden !important;
                        white-space: nowrap !important;
                        text-overflow: ellipsis !important;
                      }

                      pre {
                        margin: 0 !important;
                      }
                    `}
                  >
                    {sql}
                  </div>
                  <Divider type="vertical" />
                </>
              )}
              {renderRowsReturned()}
              {search && (
                <Input
                  css={css`
                    flex: none;
                    width: 200px;
                  `}
                  onChange={changeSearch}
                  value={searchText}
                  placeholder={t('Filter results')}
                />
              )}
            </div>
            {useFixedHeight && height !== undefined ? (
              <ResultTable {...tableProps} height={height} />
            ) : (
              <div
                css={css`
                  flex: 1 1 auto;
                `}
              >
                <AutoSizer disableWidth>
                  {({ height: autoHeight }) => (
                    <ResultTable {...tableProps} height={autoHeight} />
                  )}
                </AutoSizer>
              </div>
            )}
          </ResultContainer>
          <StreamingExportModal
            visible={showStreamingModal}
            onCancel={handleCloseStreamingModal}
            onRetry={retryExport}
            progress={progress}
          />
          {ConfirmModal}
        </>
      );
    }
    if (data && data.length === 0) {
      return (
        <>
          <Alert type="warning" message={t('The query returned no data')} />
          <StreamingExportModal
            visible={showStreamingModal}
            onCancel={handleCloseStreamingModal}
            onRetry={retryExport}
            progress={progress}
          />
        </>
      );
    }
  }

  if (query.cached || (query.state === QueryState.Success && !query.results)) {
    if (query.isDataPreview) {
      return (
        <>
          <Button
            buttonSize="small"
            buttonStyle="primary"
            onClick={() =>
              dispatch(
                reFetchQueryResults({
                  ...query,
                  isDataPreview: true,
                }),
              )
            }
          >
            {t('Fetch data preview')}
          </Button>
          <StreamingExportModal
            visible={showStreamingModal}
            onCancel={handleCloseStreamingModal}
            onRetry={retryExport}
            progress={progress}
          />
        </>
      );
    }
    if (query.resultsKey) {
      return (
        <>
          <Button
            buttonSize="small"
            buttonStyle="primary"
            onClick={() => fetchResults(query)}
          >
            {t('Refetch results')}
          </Button>
          <StreamingExportModal
            visible={showStreamingModal}
            onCancel={handleCloseStreamingModal}
            onRetry={retryExport}
            progress={progress}
          />
        </>
      );
    }
  }

  const progressMsg = query?.extra?.progress ?? null;

  return (
    <ResultlessStyles>
      {progressMsg && (
        <Alert type="success" message={progressMsg} closable={false} />
      )}
      {trackingUrl && <div>{trackingUrl}</div>}
      <StreamingExportModal
        visible={showStreamingModal}
        onCancel={handleCloseStreamingModal}
        progress={progress}
      />
    </ResultlessStyles>
  );
};

export default memo(ResultSet);
