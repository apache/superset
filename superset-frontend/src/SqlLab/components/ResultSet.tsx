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
import React, { CSSProperties, useState, useEffect, useRef } from 'react';
import ButtonGroup from 'src/components/ButtonGroup';
import Alert from 'src/components/Alert';
import ProgressBar from 'src/common/components/ProgressBar';
import moment from 'moment';
import { RadioChangeEvent } from 'antd/lib/radio';
import Button from 'src/components/Button';
import shortid from 'shortid';
import rison from 'rison';
import { styled, t, makeApi } from '@superset-ui/core';
import { useDispatch } from 'react-redux';

import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { useDatasetPut } from 'src/common/hooks/apiResources/dataset';
import FilterableTable from 'src/components/FilterableTable/FilterableTable';
import CopyToClipboard from 'src/components/CopyToClipboard';
import Loading from 'src/components/Loading';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import { exploreChart } from 'src/explore/exploreUtils';

import ExploreCtasResultsButton from './ExploreCtasResultsButton';
import ExploreResultsButton from './ExploreResultsButton';
import HighlightedSql from './HighlightedSql';
import QueryStateLabel from './QueryStateLabel';
import { CtasEnum, CLEAR_QUERY_RESULTS } from '../actions/sqlLab';
import { Query } from '../types';

const SEARCH_HEIGHT = 46;

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

const LOADING_STYLES: CSSProperties = { position: 'relative', minHeight: 100 };

interface DatasetOptionAutocomplete {
  value: string;
  datasetId: number;
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

const ResultSetControls = styled.div`
  display: flex;
  justify-content: space-between;
  padding: ${({ theme }) => 2 * theme.gridUnit}px 0;
  position: fixed;
`;

const ResultSetButtons = styled.div`
  display: grid;
  grid-auto-flow: column;
  padding-right: ${({ theme }) => 2 * theme.gridUnit}px;
`;

const ResultSetErrorMessage = styled.div`
  padding-top: ${({ theme }) => 4 * theme.gridUnit}px;
`;

const getDefaultDatasetName = (tab: string | null) =>
  `${tab} ${moment().format('MM/DD/YYYY HH:mm:ss')}`;

export default function ResultSet({
  cache = false,
  csv = true,
  database = {},
  search = true,
  showSql = false,
  visualize = true,
  query,
  ...props
}: ResultSetProps) {
  const [searchText, setSearchText] = useState<string>('');
  const [stateData, setData] = useState<Record<string, any>[]>([]);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState<boolean>(
    false,
  );
  const [newSaveDatasetName, setNewSaveDatasetName] = useState<string>(
    getDefaultDatasetName(query.tab),
  );
  const [
    saveDatasetRadioBtnState,
    setSaveDatasetRadioBtnState,
  ] = useState<DatasetRadioState>(DatasetRadioState.SAVE_NEW);
  const [shouldOverwriteDataSet, setShouldOverwriteDataSet] = useState<boolean>(
    false,
  );
  const [datasetToOverwrite, setDatasetToOverwrite] = useState<
    Record<string, any> | { datasetId: string }
  >({});
  const [userDatasetOptions, setUserDatasetOptions] = useState<
    DatasetOptionAutocomplete[]
  >([]);
  const cacheRef = useRef(cache);
  const resultsKeyRef = useRef(query.resultsKey);
  const putDataset = useDatasetPut({
    datasetId: datasetToOverwrite.datasetId,
    overrideColumns: true,
  });
  const saveModalAutocompleteValue = '';
  const dispatch = useDispatch();

  function reRunQueryIfSessionTimeoutErrorOnMount() {
    if (
      query.errorMessage &&
      query.errorMessage.indexOf('session timed out') > 0
    ) {
      dispatch(props.actions.runQuery(query, true));
    }
  }

  async function getUserDatasets(searchText = '') {
    // Making sure that autocomplete input has a value before rendering the dropdown
    // Transforming the userDatasetsOwned data for SaveModalComponent)
    const appContainer = document.getElementById('app');
    const bootstrapData = JSON.parse(
      appContainer?.getAttribute('data-bootstrap') || '{}',
    );

    if (bootstrapData.user && bootstrapData.user.userId) {
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
            value: bootstrapData.user.userId,
          },
        ],
        order_column: 'changed_on_delta_humanized',
        order_direction: 'desc',
      });

      const response = await makeApi({
        method: 'GET',
        endpoint: '/api/v1/dataset',
      })(`q=${queryParams}`);

      return response.result.map((r: { table_name: string; id: number }) => ({
        value: r.table_name,
        datasetId: r.id,
      }));
    }

    return null;
  }

  function fetchResults(query: Query) {
    dispatch(props.actions.fetchQueryResults(query, props.displayLimit));
  }

  function clearQueryResults(query: Query) {
    dispatch(props.actions.clearQueryResults(query));
  }

  useEffect(() => {
    // only do this the first time the component is rendered/mounted
    async function fetchData() {
      reRunQueryIfSessionTimeoutErrorOnMount();
      const userDatasetsOwned = await getUserDatasets();
      setUserDatasetOptions(userDatasetsOwned);
    }
    fetchData();
  }, []);

  useEffect(() => {
    // when new results comes in, save them locally and clear in store
    if (cacheRef.current && !query.cached && query.results?.data?.length > 0) {
      setData(query.results.data);
    }
    if (query.resultsKey && query.resultsKey !== resultsKeyRef.current) {
      fetchResults(query);
    }
  }, [query]);

  useEffect(() => {
    clearQueryResults(query);
  }, [stateData]);

  useEffect(() => {
    cacheRef.current = cache;
    resultsKeyRef.current = query.resultsKey;
  });

  function handleOnChangeAutoComplete() {
    setDatasetToOverwrite({});
  }

  async function handleOverwriteDataset() {
    const { sql, results, dbId } = query;

    await putDataset({
      dbId,
      sql,
      columns: results.selected_columns.map(d => ({ column_name: d.name })),
    });

    setShowSaveDatasetModal(false);
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});
    setNewSaveDatasetName(getDefaultDatasetName(query.tab));

    exploreChart({
      ...EXPLORE_CHART_DEFAULT,
      datasource: `${datasetToOverwrite.datasetId}__table`,
      all_columns: results.selected_columns.map(d => d.name),
    });
  }

  async function handleSaveInDataset() {
    // if user wants to overwrite a dataset we need to prompt them
    if (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET) {
      setShouldOverwriteDataSet(true);
      return;
    }

    const { schema, sql, dbId, templateParams } = query;
    const selectedColumns = query?.results?.selected_columns || [];

    try {
      const {
        data: { table_id },
      }: { data: { table_id: number } } = await dispatch(
        props.actions.createDatasource({
          schema,
          sql,
          dbId,
          templateParams,
          datasourceName: newSaveDatasetName,
          columns: selectedColumns,
        }),
      );
      exploreChart({
        datasource: `${table_id}__table`,
        metrics: [],
        groupby: [],
        time_range: 'No filter',
        viz_type: 'table',
        all_columns: selectedColumns.map(c => c.name),
        row_limit: 1000,
      });
    } catch (e) {
      props.actions.addDangerToast(t('An error occurred saving dataset'));
    }

    setShowSaveDatasetModal(false);
    setNewSaveDatasetName(getDefaultDatasetName(query.tab));
  }

  function handleOverwriteDatasetOption(
    _data: string,
    option: Record<string, any>,
  ) {
    setDatasetToOverwrite(option);
  }

  function handleDatasetNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNewSaveDatasetName(e.target.value);
  }

  function handleHideSaveModal() {
    setShowSaveDatasetModal(false);
    setShouldOverwriteDataSet(false);
  }

  function handleSaveDatasetRadioBtnState(e: RadioChangeEvent) {
    setSaveDatasetRadioBtnState(Number(e.target.value));
  }

  function handleOverwriteCancel() {
    setShouldOverwriteDataSet(false);
    setDatasetToOverwrite({});
  }

  function handleExploreBtnClick() {
    setShowSaveDatasetModal(true);
  }

  async function handleSaveDatasetModalSearch(searchText: string) {
    const userDatasetsOwned = await getUserDatasets(searchText);
    setUserDatasetOptions(userDatasetsOwned);
  }

  function handleFilterAutocompleteOption(
    inputValue: string,
    { value }: { value: string; datasetId: number },
  ) {
    return value.toLowerCase().includes(inputValue.toLowerCase());
  }

  function popSelectStar(tempSchema: string | null, tempTable: string) {
    const qe = {
      id: shortid.generate(),
      title: tempTable,
      autorun: false,
      dbId: query.dbId,
      sql: `SELECT * FROM ${tempSchema ? `${tempSchema}.` : ''}${tempTable}`,
    };
    dispatch(props.actions.addQueryEditor(qe));
  }

  function changeSearch(event: React.ChangeEvent<HTMLInputElement>) {
    setSearchText(event.target.value);
  }

  function reFetchQueryResults(query: Query) {
    dispatch(reFetchQueryResults(query));
  }

  function renderControls() {
    if (search || visualize || csv) {
      let { data } = query.results;
      if (cache && query.cached) {
        data = stateData;
      }

      // Added compute logic to stop user from being able to Save & Explore
      const disableSaveAndExploreBtn =
        (saveDatasetRadioBtnState === DatasetRadioState.SAVE_NEW &&
          newSaveDatasetName.length === 0) ||
        (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET &&
          Object.keys(datasetToOverwrite).length === 0 &&
          saveModalAutocompleteValue.length === 0);

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
            handleSaveDatasetModalSearch={handleSaveDatasetModalSearch}
            filterAutocompleteOption={handleFilterAutocompleteOption}
            onChangeAutoComplete={handleOnChangeAutoComplete}
          />
          <ResultSetButtons>
            {visualize && database?.allows_virtual_table_explore && (
              <ExploreResultsButton
                // @ts-ignore Redux types are difficult to work with, ignoring for now
                query={query}
                database={database}
                actions={props.actions}
                onClick={handleExploreBtnClick}
              />
            )}
            {csv && (
              <Button buttonSize="small" href={`/superset/csv/${query.id}`}>
                <i className="fa fa-file-text-o" /> {t('Download to CSV')}
              </Button>
            )}

            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(data)}
              wrapped={false}
              copyNode={
                <Button buttonSize="small">
                  <i className="fa fa-clipboard" /> {t('Copy to Clipboard')}
                </Button>
              }
            />
          </ResultSetButtons>
          {search && (
            <input
              type="text"
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
  }

  const height = Math.max(
    0,
    search ? props.height - SEARCH_HEIGHT : props.height,
  );
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
                  table={tempTable}
                  schema={tempSchema}
                  dbId={exploreDBId}
                  database={database}
                  actions={props.actions}
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
      data = stateData;
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
          {sql}
          <FilterableTable
            data={data}
            orderedColumnKeys={results.columns.map(col => col.name)}
            height={height}
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
  let progressBar;
  let trackingUrl;
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
  const progressMsg =
    query && query.extra && query.extra.progress ? query.extra.progress : null;
  return (
    <div style={LOADING_STYLES}>
      <div>{!progressBar && <Loading position="normal" />}</div>
      <QueryStateLabel query={query} />
      <div>{progressMsg && <Alert type="success" message={progressMsg} />}</div>
      <div>{progressBar}</div>
      <div>{trackingUrl}</div>
    </div>
  );
}
