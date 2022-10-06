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
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import ButtonGroup from 'src/components/ButtonGroup';
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';
import shortid from 'shortid';
import { styled, t, QueryResponse } from '@superset-ui/core';
import { usePrevious } from 'src/hooks/usePrevious';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import {
  ISaveableDatasource,
  ISimpleColumn,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { EXPLORE_CHART_DEFAULT } from 'src/SqlLab/types';
import { mountExploreUrl } from 'src/explore/exploreUtils';
import { postFormData } from 'src/explore/exploreUtils/formData';
import ProgressBar from 'src/components/ProgressBar';
import Loading from 'src/components/Loading';
import FilterableTable, {
  MAX_COLUMNS_FOR_TABLE,
} from 'src/components/FilterableTable';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import {
  CtasEnum,
  clearQueryResults,
  addQueryEditor,
  fetchQueryResults,
  reFetchQueryResults,
  reRunQuery,
} from 'src/SqlLab/actions/sqlLab';
import { URL_PARAMS } from 'src/constants';
import ExploreCtasResultsButton from '../ExploreCtasResultsButton';
import ExploreResultsButton from '../ExploreResultsButton';
import HighlightedSql from '../HighlightedSql';
import QueryStateLabel from '../QueryStateLabel';

enum LIMITING_FACTOR {
  QUERY = 'QUERY',
  QUERY_AND_DROPDOWN = 'QUERY_AND_DROPDOWN',
  DROPDOWN = 'DROPDOWN',
  NOT_LIMITED = 'NOT_LIMITED',
}

export interface ResultSetProps {
  cache?: boolean;
  csv?: boolean;
  database?: Record<string, any>;
  displayLimit: number;
  height: number;
  query: QueryResponse;
  search?: boolean;
  showSql?: boolean;
  visualize?: boolean;
  user: UserWithPermissionsAndRoles;
  defaultQueryLimit: number;
}

const ResultlessStyles = styled.div`
  position: relative;
  min-height: ${({ theme }) => theme.gridUnit * 25}px;
  [role='alert'] {
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  }
  .sql-result-track-job {
    margin-top: ${({ theme }) => theme.gridUnit * 2}px;
  }
`;

// Making text render line breaks/tabs as is as monospace,
// but wrapping text too so text doesn't overflow
const MonospaceDiv = styled.div`
  font-family: ${({ theme }) => theme.typography.families.monospace};
  white-space: pre;
  word-break: break-word;
  overflow-x: auto;
  white-space: pre-wrap;
`;

const ReturnedRows = styled.div`
  font-size: ${({ theme }) => theme.typography.sizes.s}px;
  line-height: ${({ theme }) => theme.gridUnit * 6}px;
`;

const ResultSetControls = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => 2 * theme.gridUnit}px 0;
`;

const ResultSetButtons = styled.div`
  display: grid;
  grid-auto-flow: column;
  padding-right: ${({ theme }) => 2 * theme.gridUnit}px;
`;

const LimitMessage = styled.span`
  color: ${({ theme }) => theme.colors.secondary.light1};
  margin-left: ${({ theme }) => theme.gridUnit * 2}px;
`;

const ResultSet = ({
  cache = false,
  csv = true,
  database = {},
  displayLimit,
  height,
  query,
  search = true,
  showSql = false,
  visualize = true,
  user,
  defaultQueryLimit,
}: ResultSetProps) => {
  const [searchText, setSearchText] = useState('');
  const [cachedData, setCachedData] = useState<Record<string, unknown>[]>([]);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const [alertIsOpen, setAlertIsOpen] = useState(false);

  const dispatch = useDispatch();

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

  const fetchResults = (query: QueryResponse) => {
    dispatch(fetchQueryResults(query, displayLimit));
  };

  const prevQuery = usePrevious(query);
  useEffect(() => {
    if (cache && query.cached && query?.results?.data?.length > 0) {
      setCachedData(query.results.data);
      dispatch(clearQueryResults(query));
    }
    if (
      query.resultsKey &&
      prevQuery?.resultsKey &&
      query.resultsKey !== prevQuery.resultsKey
    ) {
      fetchResults(query);
    }
  }, [query, cache]);

  const calculateAlertRefHeight = (alertElement: HTMLElement | null) => {
    if (alertElement) {
      setAlertIsOpen(true);
    } else {
      setAlertIsOpen(false);
    }
  };

  const popSelectStar = (tempSchema: string | null, tempTable: string) => {
    const qe = {
      id: shortid.generate(),
      name: tempTable,
      autorun: false,
      dbId: query.dbId,
      sql: `SELECT * FROM ${tempSchema ? `${tempSchema}.` : ''}${tempTable}`,
    };
    dispatch(addQueryEditor(qe));
  };

  const changeSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  const createExploreResultsOnClick = async () => {
    const { results } = query;

    if (results?.query_id) {
      const key = await postFormData(results.query_id, 'query', {
        ...EXPLORE_CHART_DEFAULT,
        datasource: `${results.query_id}__query`,
        ...{
          all_columns: results.columns.map(column => column.name),
        },
      });
      const url = mountExploreUrl(null, {
        [URL_PARAMS.formDataKey.name]: key,
      });
      window.open(url, '_blank', 'noreferrer');
    } else {
      addDangerToast(t('Unable to create chart without a query id.'));
    }
  };

  const renderControls = () => {
    if (search || visualize || csv) {
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
            {csv && (
              <Button buttonSize="small" href={`/superset/csv/${query.id}`}>
                <i className="fa fa-file-text-o" /> {t('Download to CSV')}
              </Button>
            )}

            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(data, columns)}
              wrapped={false}
              copyNode={
                <Button buttonSize="small">
                  <i className="fa fa-clipboard" /> {t('Copy to Clipboard')}
                </Button>
              }
              hideTooltip
            />
          </ResultSetButtons>
          {search && (
            <input
              type="text"
              onChange={changeSearch}
              value={searchText}
              className="form-control input-sm"
              disabled={columns.length > MAX_COLUMNS_FOR_TABLE}
              placeholder={
                columns.length > MAX_COLUMNS_FOR_TABLE
                  ? t('Too many columns to filter')
                  : t('Filter results')
              }
            />
          )}
        </ResultSetControls>
      );
    }
    return <div />;
  };

  const renderRowsReturned = () => {
    const { results, rows, queryLimit, limitingFactor } = query;
    let limitMessage;
    const limitReached = results?.displayLimitReached;
    const limit = queryLimit || results.query.limit;
    const isAdmin = !!user?.roles?.Admin;
    const rowsCount = Math.min(rows || 0, results?.data?.length || 0);

    const displayMaxRowsReachedMessage = {
      withAdmin: t(
        'The number of results displayed is limited to %(rows)d by the configuration DISPLAY_MAX_ROWS. ' +
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
      limit === defaultQueryLimit &&
      limitingFactor === LIMITING_FACTOR.DROPDOWN;

    if (limitingFactor === LIMITING_FACTOR.QUERY && csv) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the query',
        { rows },
      );
    } else if (
      limitingFactor === LIMITING_FACTOR.DROPDOWN &&
      !shouldUseDefaultDropdownAlert
    ) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the limit dropdown.',
        { rows },
      );
    } else if (limitingFactor === LIMITING_FACTOR.QUERY_AND_DROPDOWN) {
      limitMessage = t(
        'The number of rows displayed is limited to %(rows)d by the query and limit dropdown.',
        { rows },
      );
    }

    const rowsReturnedMessage = t('%(rows)d rows returned', {
      rows,
    });

    const tooltipText = `${rowsReturnedMessage}. ${limitMessage}`;

    return (
      <ReturnedRows>
        {!limitReached && !shouldUseDefaultDropdownAlert && (
          <span title={tooltipText}>
            {rowsReturnedMessage}
            <LimitMessage>{limitMessage}</LimitMessage>
          </span>
        )}
        {!limitReached && shouldUseDefaultDropdownAlert && (
          <div ref={calculateAlertRefHeight}>
            <Alert
              type="warning"
              message={t('%(rows)d rows returned', { rows })}
              onClose={() => setAlertIsOpen(false)}
              description={t(
                'The number of rows displayed is limited to %s by the dropdown.',
                rows,
              )}
            />
          </div>
        )}
        {limitReached && (
          <div ref={calculateAlertRefHeight}>
            <Alert
              type="warning"
              onClose={() => setAlertIsOpen(false)}
              message={t('%(rows)d rows returned', { rows: rowsCount })}
              description={
                isAdmin
                  ? displayMaxRowsReachedMessage.withAdmin
                  : displayMaxRowsReachedMessage.withoutAdmin
              }
            />
          </div>
        )}
      </ReturnedRows>
    );
  };

  const limitReached = query?.results?.displayLimitReached;
  let sql;
  let exploreDBId = query.dbId;
  if (database?.explore_database_id) {
    exploreDBId = database.explore_database_id;
  }

  let trackingUrl;
  if (
    query.trackingUrl &&
    query.state !== 'success' &&
    query.state !== 'fetching'
  ) {
    trackingUrl = (
      <Button
        className="sql-result-track-job"
        buttonSize="small"
        href={query.trackingUrl}
        target="_blank"
      >
        {query.state === 'running' ? t('Track job') : t('See query details')}
      </Button>
    );
  }

  if (showSql) {
    sql = <HighlightedSql sql={query.sql} />;
  }

  if (query.state === 'stopped') {
    return <Alert type="warning" message={t('Query was stopped')} />;
  }

  if (query.state === 'failed') {
    return (
      <ResultlessStyles>
        <ErrorMessageWithStackTrace
          title={t('Database error')}
          error={query?.errors?.[0]}
          subtitle={<MonospaceDiv>{query.errorMessage}</MonospaceDiv>}
          copyText={query.errorMessage || undefined}
          link={query.link}
          source="sqllab"
        />
        {trackingUrl}
      </ResultlessStyles>
    );
  }

  if (query.state === 'success' && query.ctas) {
    const { tempSchema, tempTable } = query;
    let object = 'Table';
    if (query.ctas_method === CtasEnum.VIEW) {
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
                  className="m-r-5"
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

  if (query.state === 'success' && query.results) {
    const { results } = query;
    // Accounts for offset needed for height of ResultSetRowsReturned component if !limitReached
    const rowMessageHeight = !limitReached ? 32 : 0;
    // Accounts for offset needed for height of Alert if this.state.alertIsOpen
    const alertContainerHeight = 70;
    // We need to calculate the height of this.renderRowsReturned()
    // if we want results panel to be proper height because the
    // FilterTable component needs an explicit height to render
    // react-virtualized Table component
    const rowsHeight = alertIsOpen
      ? height - alertContainerHeight
      : height - rowMessageHeight;
    let data;
    if (cache && query.cached) {
      data = cachedData;
    } else if (results?.data) {
      ({ data } = results);
    }
    if (data && data.length > 0) {
      const expandedColumns = results.expanded_columns
        ? results.expanded_columns.map(col => col.name)
        : [];
      return (
        <>
          {renderControls()}
          {renderRowsReturned()}
          {sql}
          <FilterableTable
            data={data}
            orderedColumnKeys={results.columns.map(col => col.name)}
            height={rowsHeight}
            filterText={searchText}
            expandedColumns={expandedColumns}
          />
        </>
      );
    }
    if (data && data.length === 0) {
      return <Alert type="warning" message={t('The query returned no data')} />;
    }
  }

  if (query.cached || (query.state === 'success' && !query.results)) {
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

export default ResultSet;
