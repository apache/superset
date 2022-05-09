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
import React, { useState, useEffect, CSSProperties } from 'react';
import ButtonGroup from 'src/components/ButtonGroup';
import Alert from 'src/components/Alert';
import moment from 'moment';
import { RadioChangeEvent } from 'src/components';
import Button from 'src/components/Button';
import shortid from 'shortid';
import rison from 'rison';
import {
  styled,
  t,
  makeApi,
  SupersetClient,
  JsonResponse,
} from '@superset-ui/core';
import { debounce } from 'lodash';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import ProgressBar from 'src/components/ProgressBar';
import Loading from 'src/components/Loading';
import { usePrevious } from 'src/hooks/usePrevious';
import FilterableTable, {
  MAX_COLUMNS_FOR_TABLE,
} from 'src/components/FilterableTable';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import { exploreChart } from 'src/explore/exploreUtils';
import { CtasEnum } from 'src/SqlLab/actions/sqlLab';
import { Query } from 'src/SqlLab/types';
import ExploreCtasResultsButton from '../ExploreCtasResultsButton';
import ExploreResultsButton from '../ExploreResultsButton';
import HighlightedSql from '../HighlightedSql';
import QueryStateLabel from '../QueryStateLabel';

enum DatasetRadioState {
  SAVE_NEW = 1,
  OVERWRITE_DATASET = 2,
}

const EXPLORE_CHART_DEFAULT = {
  metrics: [],
  groupby: [],
  time_range: 'No filter',
  viz_type: 'table',
};

enum LIMITING_FACTOR {
  QUERY = 'QUERY',
  QUERY_AND_DROPDOWN = 'QUERY_AND_DROPDOWN',
  DROPDOWN = 'DROPDOWN',
  NOT_LIMITED = 'NOT_LIMITED',
}

const LOADING_STYLES: CSSProperties = { position: 'relative', minHeight: 100 };

interface DatasetOwner {
  first_name: string;
  id: number;
  last_name: string;
  username: string;
}

interface DatasetOptionAutocomplete {
  value: string;
  datasetId: number;
  owners: [DatasetOwner];
}

interface ResultSetProps {
  actions: Record<string, any>;
  cache?: boolean;
  csv?: boolean;
  database?: Record<string, any>;
  displayLimit: number;
  height: number;
  query: Query;
  search?: boolean;
  showSql?: boolean;
  visualize?: boolean;
  user: UserWithPermissionsAndRoles;
  defaultQueryLimit: number;
}

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
  font-size: 13px;
  line-height: 24px;
  .limitMessage {
    color: ${({ theme }) => theme.colors.secondary.light1};
    margin-left: ${({ theme }) => theme.gridUnit * 2}px;
  }
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

const ResultSetErrorMessage = styled.div`
  padding-top: ${({ theme }) => 4 * theme.gridUnit}px;
`;

const updateDataset = async (
  dbId: number,
  datasetId: number,
  sql: string,
  columns: Array<Record<string, any>>,
  owners: [number],
  overrideColumns: boolean,
) => {
  const endpoint = `api/v1/dataset/${datasetId}?override_columns=${overrideColumns}`;
  const headers = { 'Content-Type': 'application/json' };
  const body = JSON.stringify({
    sql,
    columns,
    owners,
    database_id: dbId,
  });

  const data: JsonResponse = await SupersetClient.put({
    endpoint,
    headers,
    body,
  });
  return data.json.result;
};

const ResultSet = ({
  actions,
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
  const [saveDatasetRadioBtnState, setSaveDatasetRadioBtnState] = useState(
    DatasetRadioState.SAVE_NEW,
  );
  const [shouldOverwriteDataSet, setShouldOverwriteDataSet] = useState(false);
  const [datasetToOverwrite, setDatasetToOverwrite] = useState<
    Record<string, any>
  >({});
  const [userDatasetOptions, setUserDatasetOptions] = useState<
    DatasetOptionAutocomplete[]
  >([]);
  const [alertIsOpen, setAlertIsOpen] = useState(false);

  const reRunQueryIfSessionTimeoutErrorOnMount = () => {
    if (
      query.errorMessage &&
      query.errorMessage.indexOf('session timed out') > 0
    ) {
      actions.reRunQuery(query);
    }
  };

  useEffect(() => {
    (async () => {
      reRunQueryIfSessionTimeoutErrorOnMount();
      const userDatasetsOwned = await getUserDatasets();
      setUserDatasetOptions(userDatasetsOwned);
    })();
  }, []);

  const prevQuery = usePrevious(query);
  useEffect(() => {
    if (
      cache &&
      query.cached &&
      query?.results?.data &&
      query.results.data.length > 0
    ) {
      setCachedData(query.results.data);
      actions.clearQueryResults(query);
    }
    if (
      query.resultsKey &&
      prevQuery &&
      prevQuery.resultsKey &&
      query.resultsKey !== prevQuery.resultsKey
    ) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
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

  const getDefaultDatasetName = () =>
    `${query.tab} ${moment().format('MM/DD/YYYY HH:mm:ss')}`;

  const [newSaveDatasetName, setNewSaveDatasetName] = useState(
    getDefaultDatasetName(),
  );

  const handleOnChangeAutoComplete = () => {
    setDatasetToOverwrite({});
  };

  const handleOverwriteDataset = async () => {
    const { sql, results, dbId } = query;

    await updateDataset(
      dbId,
      datasetToOverwrite.datasetId,
      sql,
      results.selected_columns.map(d => ({
        column_name: d.name,
        type: d.type,
        is_dttm: d.is_dttm,
      })),
      datasetToOverwrite.owners.map((o: DatasetOwner) => o.id),
      true,
    );

    setShowSaveDatasetModal(false);
    setNewSaveDatasetName(getDefaultDatasetName());
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});

    exploreChart({
      ...EXPLORE_CHART_DEFAULT,
      datasource: `${datasetToOverwrite.datasetId}__table`,
      all_columns: results.selected_columns.map(d => d.name),
    });
  };

  const handleSaveInDataset = () => {
    // if user wants to overwrite a dataset we need to prompt them
    if (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET) {
      setShouldOverwriteDataSet(true);
      return;
    }

    const { schema, sql, dbId } = query;
    let { templateParams } = query;
    const selectedColumns = query?.results?.selected_columns || [];

    // The filters param is only used to test jinja templates.
    // Remove the special filters entry from the templateParams
    // before saving the dataset.
    if (templateParams) {
      const p = JSON.parse(templateParams);
      /* eslint-disable-next-line no-underscore-dangle */
      if (p._filters) {
        /* eslint-disable-next-line no-underscore-dangle */
        delete p._filters;
        templateParams = JSON.stringify(p);
      }
    }

    actions
      .createDatasource({
        schema,
        sql,
        dbId,
        templateParams,
        datasourceName: newSaveDatasetName,
        columns: selectedColumns,
      })
      .then((data: { table_id: number }) => {
        exploreChart({
          datasource: `${data.table_id}__table`,
          metrics: [],
          groupby: [],
          time_range: 'No filter',
          viz_type: 'table',
          all_columns: selectedColumns.map(c => c.name),
          row_limit: 1000,
        });
      })
      .catch(() => {
        actions.addDangerToast(t('An error occurred saving dataset'));
      });

    setShowSaveDatasetModal(false);
    setNewSaveDatasetName(getDefaultDatasetName());
  };

  const handleOverwriteDatasetOption = (
    _data: string,
    option: Record<string, any>,
  ) => {
    setDatasetToOverwrite(option);
  };

  const handleDatasetNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    setNewSaveDatasetName(e.target.value);
  };

  const handleHideSaveModal = () => {
    setShowSaveDatasetModal(false);
    setShouldOverwriteDataSet(false);
  };

  const handleSaveDatasetRadioBtnState = (e: RadioChangeEvent) => {
    setSaveDatasetRadioBtnState(Number(e.target.value));
  };

  const handleOverwriteCancel = () => {
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});
  };

  const handleExploreBtnClick = () => {
    setShowSaveDatasetModal(true);
  };

  const getUserDatasets = async (searchText = '') => {
    // Making sure that autocomplete input has a value before rendering the dropdown
    // Transforming the userDatasetsOwned data for SaveModalComponent)
    const { userId } = user;
    if (userId) {
      const queryParams = rison.encode({
        filters: [
          {
            col: 'table_name',
            opr: 'ct',
            value: searchText,
          },
          {
            col: 'owners',
            opr: 'rel_m_m',
            value: userId,
          },
        ],
        order_column: 'changed_on_delta_humanized',
        order_direction: 'desc',
      });

      const response = await makeApi({
        method: 'GET',
        endpoint: '/api/v1/dataset',
      })(`q=${queryParams}`);

      return response.result.map(
        (r: { table_name: string; id: number; owners: [DatasetOwner] }) => ({
          value: r.table_name,
          datasetId: r.id,
          owners: r.owners,
        }),
      );
    }

    return null;
  };

  const handleSaveDatasetModalSearch = async (searchText: string) => {
    const userDatasetsOwned = await getUserDatasets(searchText);
    setUserDatasetOptions(userDatasetsOwned);
  };

  const handleSaveDatasetModalSearchWithDebounce = debounce(
    handleSaveDatasetModalSearch,
    1000,
  );

  const handleFilterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetId: number },
  ) => option.value.toLowerCase().includes(inputValue.toLowerCase());

  const popSelectStar = (tempSchema: string | null, tempTable: string) => {
    const qe = {
      id: shortid.generate(),
      title: tempTable,
      autorun: false,
      dbId: query.dbId,
      sql: `SELECT * FROM ${tempSchema ? `${tempSchema}.` : ''}${tempTable}`,
    };
    actions.addQueryEditor(qe);
  };

  const changeSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(event.target.value);
  };

  const fetchResults = (query: Query) => {
    actions.fetchQueryResults(query, displayLimit);
  };

  const reFetchQueryResults = (query: Query) => {
    actions.reFetchQueryResults(query);
  };

  const renderControls = () => {
    if (search || visualize || csv) {
      let { data } = query.results;
      if (cache && query.cached) {
        data = cachedData;
      }
      const { columns } = query.results;
      // Added compute logic to stop user from being able to Save & Explore

      const disableSaveAndExploreBtn =
        (saveDatasetRadioBtnState === DatasetRadioState.SAVE_NEW &&
          newSaveDatasetName.length === 0) ||
        (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET &&
          Object.keys(datasetToOverwrite).length === 0);

      return (
        <ResultSetControls>
          <SaveDatasetModal
            visible={showSaveDatasetModal}
            onOk={handleSaveInDataset}
            saveDatasetRadioBtnState={saveDatasetRadioBtnState}
            shouldOverwriteDataset={shouldOverwriteDataSet}
            defaultCreateDatasetValue={newSaveDatasetName}
            userDatasetOptions={userDatasetOptions}
            disableSaveAndExploreBtn={disableSaveAndExploreBtn}
            onHide={handleHideSaveModal}
            handleDatasetNameChange={handleDatasetNameChange}
            handleSaveDatasetRadioBtnState={handleSaveDatasetRadioBtnState}
            handleOverwriteCancel={handleOverwriteCancel}
            handleOverwriteDataset={handleOverwriteDataset}
            handleOverwriteDatasetOption={handleOverwriteDatasetOption}
            handleSaveDatasetModalSearch={
              handleSaveDatasetModalSearchWithDebounce
            }
            filterAutocompleteOption={handleFilterAutocompleteOption}
            onChangeAutoComplete={handleOnChangeAutoComplete}
          />
          <ResultSetButtons>
            {visualize && database?.allows_virtual_table_explore && (
              <ExploreResultsButton
                database={database}
                onClick={handleExploreBtnClick}
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

  const onAlertClose = () => {
    setAlertIsOpen(false);
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
      limitMessage = (
        <span className="limitMessage">
          {t(
            'The number of rows displayed is limited to %(rows)d by the query',
            { rows },
          )}
        </span>
      );
    } else if (
      limitingFactor === LIMITING_FACTOR.DROPDOWN &&
      !shouldUseDefaultDropdownAlert
    ) {
      limitMessage = (
        <span className="limitMessage">
          {t(
            'The number of rows displayed is limited to %(rows)d by the limit dropdown.',
            { rows },
          )}
        </span>
      );
    } else if (limitingFactor === LIMITING_FACTOR.QUERY_AND_DROPDOWN) {
      limitMessage = (
        <span className="limitMessage">
          {t(
            'The number of rows displayed is limited to %(rows)d by the query and limit dropdown.',
            { rows },
          )}
        </span>
      );
    }
    return (
      <ReturnedRows>
        {!limitReached && !shouldUseDefaultDropdownAlert && (
          <span>
            {t('%(rows)d rows returned', { rows })} {limitMessage}
          </span>
        )}
        {!limitReached && shouldUseDefaultDropdownAlert && (
          <div ref={calculateAlertRefHeight}>
            <Alert
              type="warning"
              message={t('%(rows)d rows returned', { rows })}
              onClose={onAlertClose}
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
              onClose={onAlertClose}
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

  let sql;
  let exploreDBId = query.dbId;
  if (database?.explore_database_id) {
    exploreDBId = database.explore_database_id;
  }

  if (showSql) {
    sql = <HighlightedSql sql={query.sql} />;
  }

  if (query.state === 'stopped') {
    return <Alert type="warning" message={t('Query was stopped')} />;
  }

  if (query.state === 'failed') {
    return (
      <ResultSetErrorMessage>
        <ErrorMessageWithStackTrace
          title={t('Database error')}
          error={query?.errors?.[0]}
          subtitle={<MonospaceDiv>{query.errorMessage}</MonospaceDiv>}
          copyText={query.errorMessage || undefined}
          link={query.link}
          source="sqllab"
        />
      </ResultSetErrorMessage>
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
                  // @ts-ignore Redux types are difficult to work with, ignoring for now
                  actions={actions}
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
    let data;
    if (cache && query.cached) {
      data = cachedData;
    } else if (results && results.data) {
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
            height={alertIsOpen ? height - 70 : height}
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
            reFetchQueryResults({
              ...query,
              isDataPreview: true,
            })
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

  let trackingUrl;
  let progressBar;
  if (query.progress > 0) {
    progressBar = (
      <ProgressBar percent={parseInt(query.progress.toFixed(0), 10)} striped />
    );
  }

  if (query.trackingUrl) {
    trackingUrl = (
      <Button
        buttonSize="small"
        onClick={() => query.trackingUrl && window.open(query.trackingUrl)}
      >
        {t('Track job')}
      </Button>
    );
  }
  const progressMsg = query?.extra?.progress ? query.extra.progress : null;

  return (
    <div style={LOADING_STYLES}>
      <div>{!progressBar && <Loading position="normal" />}</div>
      {/* show loading bar whenever progress bar is completed but needs time to render */}
      <div>{query.progress === 100 && <Loading position="normal" />}</div>
      <QueryStateLabel query={query} />
      <div>{progressMsg && <Alert type="success" message={progressMsg} />}</div>
      <div>{query.progress !== 100 && progressBar}</div>
      <div>{trackingUrl}</div>
    </div>
  );
};

export default ResultSet;
