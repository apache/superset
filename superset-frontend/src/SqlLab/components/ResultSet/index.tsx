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
} from 'react';

import AutoSizer from 'react-virtualized-auto-sizer';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { pick } from 'lodash';
import {
  Alert,
  Button,
  ButtonGroup,
  Tooltip,
  Card,
  Modal,
  Input,
  Label,
  Loading,
} from '@superset-ui/core/components';
import {
  CopyToClipboard,
  FilterableTable,
  ErrorMessageWithStackTrace,
} from 'src/components';
import { nanoid } from 'nanoid';
import {
  QueryState,
  styled,
  t,
  tn,
  useTheme,
  usePrevious,
  css,
  getNumberFormatter,
  getExtensionsRegistry,
  ErrorTypeEnum,
} from '@superset-ui/core';
import {
  ISaveableDatasource,
  ISimpleColumn,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { EXPLORE_CHART_DEFAULT, SqlLabRootState } from 'src/SqlLab/types';
import { mountExploreUrl } from 'src/explore/exploreUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import ProgressBar from '@superset-ui/core/components/ProgressBar';
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
import { ensureAppRoot } from 'src/utils/pathUtils';
import ExploreCtasResultsButton from '../ExploreCtasResultsButton';
import ExploreResultsButton from '../ExploreResultsButton';
import HighlightedSql from '../HighlightedSql';
import QueryStateLabel from '../QueryStateLabel';

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
  height: number;
  queryId: string;
  search?: boolean;
  showSql?: boolean;
  showSqlInline?: boolean;
  visualize?: boolean;
  defaultQueryLimit: number;
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

const ResultSetControls = styled.div`
  display: flex;
  justify-content: space-between;
  padding-left: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const ResultSetButtons = styled.div`
  display: grid;
  grid-auto-flow: column;
  padding-right: ${({ theme }) => 2 * theme.sizeUnit}px;
`;

const copyButtonStyles = css`
  &:hover {
    text-decoration: unset;
  }
  span > :first-of-type {
    margin: 0px;
  }
`;

const ROWS_CHIP_WIDTH = 100;
const GAP = 8;

const extensionsRegistry = getExtensionsRegistry();

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
}: ResultSetProps) => {
  const user = useSelector(({ user }: SqlLabRootState) => user, shallowEqual);
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

  const history = useHistory();
  const dispatch = useDispatch();
  const logAction = useLogAction({ queryId, sqlEditorId: query.sqlEditorId });

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
        ...{
          all_columns: results.columns.map(column => column.column_name),
        },
      });
      const url = mountExploreUrl(null, {
        [URL_PARAMS.formDataKey.name]: key,
      });
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
    ensureAppRoot(`/api/v1/sqllab/export/${clientId}/`);

  const renderControls = () => {
    if (search || visualize || csv) {
      const { results, queryLimit, limitingFactor, rows } = query;
      const limit = queryLimit || results.query.limit;
      const rowsCount = Math.min(rows || 0, results?.data?.length || 0);
      let { data } = query.results;
      if (cache && query.cached) {
        data = cachedData;
      }
      const { columns } = query.results;
      // Added compute logic to stop user from being able to Save & Explore

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

      return (
        <ResultSetControls>
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
          <ResultSetButtons>
            {visualize && database?.allows_virtual_table_explore && (
              <ExploreResultsButton
                database={database}
                onClick={createExploreResultsOnClick}
              />
            )}
            {csv && canExportData && (
              <Button
                css={copyButtonStyles}
                buttonSize="small"
                buttonStyle="secondary"
                href={getExportCsvUrl(query.id)}
                data-test="export-csv-button"
                onClick={() => {
                  logAction(LOG_ACTIONS_SQLLAB_DOWNLOAD_CSV, {});
                  if (
                    limitingFactor === LimitingFactor.Dropdown &&
                    limit === rowsCount
                  ) {
                    Modal.warning({
                      title: t('Download is on the way'),
                      content: t(
                        'Downloading %(rows)s rows based on the LIMIT configuration. If you want the entire result set, you need to adjust the LIMIT.',
                        { rows: rowsCount.toLocaleString() },
                      ),
                    });
                  }
                }}
              >
                <Icons.DownloadOutlined iconSize="m" /> {t('Download to CSV')}
              </Button>
            )}

            {canExportData && (
              <CopyToClipboard
                text={prepareCopyToClipboardTabularData(data, columns)}
                wrapped={false}
                copyNode={
                  <Button
                    css={copyButtonStyles}
                    buttonSize="small"
                    buttonStyle="secondary"
                    data-test="copy-to-clipboard-button"
                  >
                    <Icons.CopyOutlined iconSize="s" /> {t('Copy to Clipboard')}
                  </Button>
                }
                hideTooltip
                onCopyEnd={() =>
                  logAction(LOG_ACTIONS_SQLLAB_COPY_RESULT_TO_CLIPBOARD, {})
                }
              />
            )}
          </ResultSetButtons>
          {search && (
            <Input
              onChange={changeSearch}
              value={searchText}
              className="form-control input-sm"
              placeholder={t('Filter results')}
            />
          )}
        </ResultSetControls>
      );
    }
    return <div />;
  };

  const renderRowsReturned = (alertMessage: boolean) => {
    const { results, rows, queryLimit, limitingFactor } = query;
    let limitMessage = '';
    const limitReached = results?.displayLimitReached;
    const limit = queryLimit || results.query.limit;
    const isAdmin = !!user?.roles?.Admin;
    const rowsCount = Math.min(rows || 0, results?.data?.length || 0);

    const displayMaxRowsReachedMessage = {
      withAdmin: t(
        'The number of results displayed is limited to %(rows)d by the configuration DISPLAY_MAX_ROW. ' +
          'Please add additional limits/filters or download to csv to see more rows up to ' +
          'the %(limit)d limit.',
        { rows: rowsCount, limit },
      ),
      withoutAdmin: t(
        'The number of results displayed is limited to %(rows)d. ' +
          'Please add additional limits/filters, download to csv, or contact an admin ' +
          'to see more rows up to the %(limit)d limit.',
        { rows: rowsCount, limit },
      ),
    };
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
    }
    const formattedRowCount = getNumberFormatter()(rows);
    const rowsReturnedMessage = t('%(rows)d rows returned', {
      rows,
    });

    const tooltipText = `${rowsReturnedMessage}. ${limitMessage}`;

    if (alertMessage) {
      return (
        <>
          {!limitReached && shouldUseDefaultDropdownAlert && (
            <div>
              <Alert
                closable
                type="warning"
                message={t(
                  'The number of rows displayed is limited to %(rows)d by the dropdown.',
                  { rows },
                )}
              />
            </div>
          )}
          {limitReached && (
            <div>
              <Alert
                closable
                type="warning"
                message={
                  isAdmin
                    ? displayMaxRowsReachedMessage.withAdmin
                    : displayMaxRowsReachedMessage.withoutAdmin
                }
              />
            </div>
          )}
        </>
      );
    }
    const showRowsReturned =
      showSqlInline || (!limitReached && !shouldUseDefaultDropdownAlert);

    return (
      <>
        {showRowsReturned && (
          <ReturnedRows>
            <Tooltip
              id="sqllab-rowcount-tooltip"
              title={tooltipText}
              placement="left"
            >
              <Label
                css={css`
                  line-height: ${theme.fontSizeLG}px;
                `}
              >
                {limitMessage && (
                  <Icons.ExclamationCircleOutlined
                    css={css`
                      font-size: ${theme.fontSize}px;
                      margin-right: ${theme.sizeUnit}px;
                    `}
                  />
                )}
                {tn('%s row', '%s rows', rows, formattedRowCount)}
              </Label>
            </Tooltip>
          </ReturnedRows>
        )}
      </>
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
      const expandedColumns = results.expanded_columns
        ? results.expanded_columns.map(col => col.column_name)
        : [];
      const allowHTML = getItem(
        LocalStorageKeys.SqllabIsRenderHtmlEnabled,
        true,
      );
      return (
        <ResultContainer>
          {renderControls()}
          {showSql && showSqlInline ? (
            <>
              <div
                css={css`
                  display: flex;
                  justify-content: space-between;
                  padding-left: ${theme.sizeUnit * 4}px;
                  align-items: center;
                  gap: ${GAP}px;
                `}
              >
                <Card
                  css={[
                    css`
                      height: 28px;
                      width: calc(100% - ${ROWS_CHIP_WIDTH + GAP}px);
                      code {
                        width: 100%;
                        overflow: hidden;
                        white-space: nowrap !important;
                        text-overflow: ellipsis;
                        display: block;
                      }
                    `,
                  ]}
                >
                  {sql}
                </Card>
                {renderRowsReturned(false)}
              </div>
              {renderRowsReturned(true)}
            </>
          ) : (
            <>
              {renderRowsReturned(false)}
              {renderRowsReturned(true)}
              {sql}
            </>
          )}
          <div
            css={css`
              flex: 1 1 auto;
              padding-left: ${theme.sizeUnit * 4}px;
            `}
          >
            <AutoSizer disableWidth>
              {({ height }) => (
                <ResultTable
                  data={data}
                  queryId={query.id}
                  orderedColumnKeys={results.columns.map(
                    col => col.column_name,
                  )}
                  height={height}
                  filterText={searchText}
                  expandedColumns={expandedColumns}
                  allowHTML={allowHTML}
                />
              )}
            </AutoSizer>
          </div>
        </ResultContainer>
      );
    }
    if (data && data.length === 0) {
      return <Alert type="warning" message={t('The query returned no data')} />;
    }
  }

  if (query.cached || (query.state === QueryState.Success && !query.results)) {
    if (query.isDataPreview) {
      return (
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
      );
    }
    if (query.resultsKey) {
      return (
        <Button
          buttonSize="small"
          buttonStyle="primary"
          onClick={() => fetchResults(query)}
        >
          {t('Refetch results')}
        </Button>
      );
    }
  }

  let progressBar;
  if (query.progress > 0) {
    progressBar = (
      <ProgressBar percent={parseInt(query.progress.toFixed(0), 10)} striped />
    );
  }

  const progressMsg = query?.extra?.progress ?? null;

  return (
    <ResultlessStyles>
      <div>{!progressBar && <Loading position="normal" />}</div>
      {/* show loading bar whenever progress bar is completed but needs time to render */}
      <div>{query.progress === 100 && <Loading position="normal" />}</div>
      <QueryStateLabel query={query} />
      <div>{progressMsg && <Alert type="success" message={progressMsg} />}</div>
      <div>{query.progress !== 100 && progressBar}</div>
      {trackingUrl && <div>{trackingUrl}</div>}
    </ResultlessStyles>
  );
};

export default memo(ResultSet);
