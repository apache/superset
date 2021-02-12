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
import React, { CSSProperties } from 'react';
import { Alert } from 'react-bootstrap';
import ButtonGroup from 'src/components/ButtonGroup';
import ProgressBar from 'src/common/components/ProgressBar';
import moment from 'moment';
import { RadioChangeEvent } from 'antd/lib/radio';
import Button from 'src/components/Button';
import shortid from 'shortid';
import rison from 'rison';
import { styled, t, makeApi } from '@superset-ui/core';
import { debounce } from 'lodash';

import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { put as updateDatset } from 'src/api/dataset';
import Loading from '../../components/Loading';
import ExploreCtasResultsButton from './ExploreCtasResultsButton';
import ExploreResultsButton from './ExploreResultsButton';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';
import CopyToClipboard from '../../components/CopyToClipboard';
import { prepareCopyToClipboardTabularData } from '../../utils/common';
import { exploreChart } from '../../explore/exploreUtils';
import { CtasEnum } from '../actions/sqlLab';
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

interface ResultSetState {
  searchText: string;
  showExploreResultsButton: boolean;
  data: Record<string, any>[];
  showSaveDatasetModal: boolean;
  newSaveDatasetName: string;
  saveDatasetRadioBtnState: number;
  shouldOverwriteDataSet: boolean;
  datasetToOverwrite: Record<string, any>;
  saveModalAutocompleteValue: string;
  userDatasetOptions: DatasetOptionAutocomplete[];
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

export default class ResultSet extends React.PureComponent<
  ResultSetProps,
  ResultSetState
> {
  static defaultProps = {
    cache: false,
    csv: true,
    database: {},
    search: true,
    showSql: false,
    visualize: true,
  };

  constructor(props: ResultSetProps) {
    super(props);
    this.state = {
      searchText: '',
      showExploreResultsButton: false,
      data: [],
      showSaveDatasetModal: false,
      newSaveDatasetName: this.getDefaultDatasetName(),
      saveDatasetRadioBtnState: DatasetRadioState.SAVE_NEW,
      shouldOverwriteDataSet: false,
      datasetToOverwrite: {},
      saveModalAutocompleteValue: '',
      userDatasetOptions: [],
    };

    this.changeSearch = this.changeSearch.bind(this);
    this.fetchResults = this.fetchResults.bind(this);
    this.popSelectStar = this.popSelectStar.bind(this);
    this.reFetchQueryResults = this.reFetchQueryResults.bind(this);
    this.toggleExploreResultsButton = this.toggleExploreResultsButton.bind(
      this,
    );
    this.handleSaveInDataset = this.handleSaveInDataset.bind(this);
    this.handleHideSaveModal = this.handleHideSaveModal.bind(this);
    this.handleDatasetNameChange = this.handleDatasetNameChange.bind(this);
    this.handleSaveDatasetRadioBtnState = this.handleSaveDatasetRadioBtnState.bind(
      this,
    );
    this.handleOverwriteCancel = this.handleOverwriteCancel.bind(this);
    this.handleOverwriteDataset = this.handleOverwriteDataset.bind(this);
    this.handleOverwriteDatasetOption = this.handleOverwriteDatasetOption.bind(
      this,
    );
    this.handleSaveDatasetModalSearch = debounce(
      this.handleSaveDatasetModalSearch.bind(this),
      1000,
    );
    this.handleFilterAutocompleteOption = this.handleFilterAutocompleteOption.bind(
      this,
    );
    this.handleOnChangeAutoComplete = this.handleOnChangeAutoComplete.bind(
      this,
    );
    this.handleExploreBtnClick = this.handleExploreBtnClick.bind(this);
  }

  componentDidMount() {
    // only do this the first time the component is rendered/mounted
    this.reRunQueryIfSessionTimeoutErrorOnMount();
  }

  UNSAFE_componentWillReceiveProps(nextProps: ResultSetProps) {
    // when new results comes in, save them locally and clear in store
    if (
      this.props.cache &&
      !nextProps.query.cached &&
      nextProps.query.results &&
      nextProps.query.results.data &&
      nextProps.query.results.data.length > 0
    ) {
      this.setState({ data: nextProps.query.results.data }, () =>
        this.clearQueryResults(nextProps.query),
      );
    }
    if (
      nextProps.query.resultsKey &&
      nextProps.query.resultsKey !== this.props.query.resultsKey
    ) {
      this.fetchResults(nextProps.query);
    }
  }

  getDefaultDatasetName = () =>
    `${this.props.query.tab} ${moment().format('MM/DD/YYYY HH:mm:ss')}`;

  handleOnChangeAutoComplete = () => {
    this.setState({ datasetToOverwrite: {} });
  };

  handleOverwriteDataset = async () => {
    const { sql, results, dbId } = this.props.query;
    const { datasetToOverwrite } = this.state;

    await updateDatset(
      datasetToOverwrite.datasetId,
      dbId,
      sql,
      results.selected_columns.map(d => ({ column_name: d.name })),
      true,
    );

    this.setState({
      showSaveDatasetModal: false,
      shouldOverwriteDataSet: false,
      datasetToOverwrite: {},
      newSaveDatasetName: this.getDefaultDatasetName(),
    });

    exploreChart({
      ...EXPLORE_CHART_DEFAULT,
      datasource: `${datasetToOverwrite.datasetId}__table`,
      all_columns: results.selected_columns.map(d => d.name),
    });
  };

  handleSaveInDataset = () => {
    // if user wants to overwrite a dataset we need to prompt them
    if (
      this.state.saveDatasetRadioBtnState ===
      DatasetRadioState.OVERWRITE_DATASET
    ) {
      this.setState({ shouldOverwriteDataSet: true });
      return;
    }

    const { schema, sql, dbId, templateParams } = this.props.query;
    const selectedColumns = this.props.query?.results?.selected_columns || [];

    this.props.actions
      .createDatasource({
        schema,
        sql,
        dbId,
        templateParams,
        datasourceName: this.state.newSaveDatasetName,
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
        this.props.actions.addDangerToast(
          t('An error occurred saving dataset'),
        );
      });

    this.setState({
      showSaveDatasetModal: false,
      newSaveDatasetName: this.getDefaultDatasetName(),
    });
  };

  handleOverwriteDatasetOption = (
    _data: string,
    option: Record<string, any>,
  ) => {
    this.setState({ datasetToOverwrite: option });
  };

  handleDatasetNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    this.setState({ newSaveDatasetName: e.target.value });
  };

  handleHideSaveModal = () => {
    this.setState({
      showSaveDatasetModal: false,
      shouldOverwriteDataSet: false,
    });
  };

  handleSaveDatasetRadioBtnState = (e: RadioChangeEvent) => {
    this.setState({ saveDatasetRadioBtnState: Number(e.target.value) });
  };

  handleOverwriteCancel = () => {
    this.setState({ shouldOverwriteDataSet: false, datasetToOverwrite: {} });
  };

  handleExploreBtnClick = () => {
    this.setState({
      showSaveDatasetModal: true,
    });
  };

  handleSaveDatasetModalSearch = async (searchText: string) => {
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

      const userDatasetsOwned = response.result.map(
        (r: { table_name: string; id: number }) => ({
          value: r.table_name,
          datasetId: r.id,
        }),
      );

      this.setState({ userDatasetOptions: userDatasetsOwned });
    }
  };

  handleFilterAutocompleteOption = (
    inputValue: string,
    option: { value: string; datasetId: number },
  ) => option.value.toLowerCase().includes(inputValue.toLowerCase());

  clearQueryResults(query: Query) {
    this.props.actions.clearQueryResults(query);
  }

  popSelectStar(tempSchema: string | null, tempTable: string) {
    const qe = {
      id: shortid.generate(),
      title: tempTable,
      autorun: false,
      dbId: this.props.query.dbId,
      sql: `SELECT * FROM ${tempSchema ? `${tempSchema}.` : ''}${tempTable}`,
    };
    this.props.actions.addQueryEditor(qe);
  }

  toggleExploreResultsButton() {
    this.setState(prevState => ({
      showExploreResultsButton: !prevState.showExploreResultsButton,
    }));
  }

  changeSearch(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ searchText: event.target.value });
  }

  fetchResults(query: Query) {
    this.props.actions.fetchQueryResults(query, this.props.displayLimit);
  }

  reFetchQueryResults(query: Query) {
    this.props.actions.reFetchQueryResults(query);
  }

  reRunQueryIfSessionTimeoutErrorOnMount() {
    const { query } = this.props;
    if (
      query.errorMessage &&
      query.errorMessage.indexOf('session timed out') > 0
    ) {
      this.props.actions.runQuery(query, true);
    }
  }

  renderControls() {
    if (this.props.search || this.props.visualize || this.props.csv) {
      let { data } = this.props.query.results;
      if (this.props.cache && this.props.query.cached) {
        ({ data } = this.state);
      }

      // Added compute logic to stop user from being able to Save & Explore
      const {
        saveDatasetRadioBtnState,
        newSaveDatasetName,
        datasetToOverwrite,
        saveModalAutocompleteValue,
        shouldOverwriteDataSet,
        userDatasetOptions,
        showSaveDatasetModal,
      } = this.state;
      const disableSaveAndExploreBtn =
        (saveDatasetRadioBtnState === DatasetRadioState.SAVE_NEW &&
          newSaveDatasetName.length === 0) ||
        (saveDatasetRadioBtnState === DatasetRadioState.OVERWRITE_DATASET &&
          Object.keys(datasetToOverwrite).length === 0 &&
          saveModalAutocompleteValue.length === 0);

      return (
        <div className="ResultSetControls">
          <SaveDatasetModal
            visible={showSaveDatasetModal}
            onOk={this.handleSaveInDataset}
            saveDatasetRadioBtnState={saveDatasetRadioBtnState}
            shouldOverwriteDataset={shouldOverwriteDataSet}
            defaultCreateDatasetValue={newSaveDatasetName}
            userDatasetOptions={userDatasetOptions}
            disableSaveAndExploreBtn={disableSaveAndExploreBtn}
            onHide={this.handleHideSaveModal}
            handleDatasetNameChange={this.handleDatasetNameChange}
            handleSaveDatasetRadioBtnState={this.handleSaveDatasetRadioBtnState}
            handleOverwriteCancel={this.handleOverwriteCancel}
            handleOverwriteDataset={this.handleOverwriteDataset}
            handleOverwriteDatasetOption={this.handleOverwriteDatasetOption}
            handleSaveDatasetModalSearch={this.handleSaveDatasetModalSearch}
            filterAutocompleteOption={this.handleFilterAutocompleteOption}
            onChangeAutoComplete={this.handleOnChangeAutoComplete}
          />
          <div className="ResultSetButtons">
            {this.props.visualize &&
              this.props.database &&
              this.props.database.allows_virtual_table_explore && (
                <ExploreResultsButton
                  // @ts-ignore Redux types are difficult to work with, ignoring for now
                  query={this.props.query}
                  database={this.props.database}
                  actions={this.props.actions}
                  onClick={this.handleExploreBtnClick}
                />
              )}
            {this.props.csv && (
              <Button
                buttonSize="small"
                href={`/superset/csv/${this.props.query.id}`}
              >
                <i className="fa fa-file-text-o" /> {t('.CSV')}
              </Button>
            )}

            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(data)}
              wrapped={false}
              copyNode={
                <Button buttonSize="small">
                  <i className="fa fa-clipboard" /> {t('Clipboard')}
                </Button>
              }
            />
          </div>
          {this.props.search && (
            <input
              type="text"
              onChange={this.changeSearch}
              value={this.state.searchText}
              className="form-control input-sm"
              placeholder={t('Filter results')}
            />
          )}
        </div>
      );
    }
    return <div className="noControls" />;
  }

  render() {
    const { query } = this.props;
    const height = Math.max(
      0,
      this.props.search ? this.props.height - SEARCH_HEIGHT : this.props.height,
    );
    let sql;
    let exploreDBId = query.dbId;
    if (this.props.database && this.props.database.explore_database_id) {
      exploreDBId = this.props.database.explore_database_id;
    }

    if (this.props.showSql) {
      sql = <HighlightedSql sql={query.sql} />;
    }

    if (query.state === 'stopped') {
      return <Alert bsStyle="warning">Query was stopped</Alert>;
    }
    if (query.state === 'failed') {
      return (
        <div className="result-set-error-message">
          <ErrorMessageWithStackTrace
            title={t('Database error')}
            error={query?.errors?.[0]}
            subtitle={<MonospaceDiv>{query.errorMessage}</MonospaceDiv>}
            copyText={query.errorMessage || undefined}
            link={query.link}
            source="sqllab"
          />
        </div>
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
          <Alert bsStyle="info">
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
                onClick={() => this.popSelectStar(tempSchema, tempTable)}
              >
                {t('Query in a new tab')}
              </Button>
              <ExploreCtasResultsButton
                // @ts-ignore Redux types are difficult to work with, ignoring for now
                table={tempTable}
                schema={tempSchema}
                dbId={exploreDBId}
                database={this.props.database}
                actions={this.props.actions}
              />
            </ButtonGroup>
          </Alert>
        </div>
      );
    }
    if (query.state === 'success' && query.results) {
      const { results } = query;
      let data;
      if (this.props.cache && query.cached) {
        ({ data } = this.state);
      } else if (results && results.data) {
        ({ data } = results);
      }
      if (data && data.length > 0) {
        const expandedColumns = results.expanded_columns
          ? results.expanded_columns.map(col => col.name)
          : [];
        return (
          <>
            {this.renderControls()}
            {sql}
            <FilterableTable
              data={data}
              orderedColumnKeys={results.columns.map(col => col.name)}
              height={height}
              filterText={this.state.searchText}
              expandedColumns={expandedColumns}
            />
          </>
        );
      }
      if (data && data.length === 0) {
        return (
          <Alert bsStyle="warning">{t('The query returned no data')}</Alert>
        );
      }
    }
    if (query.cached || (query.state === 'success' && !query.results)) {
      if (query.isDataPreview) {
        return (
          <Button
            buttonSize="small"
            className="fetch"
            buttonStyle="primary"
            onClick={() =>
              this.reFetchQueryResults({
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
            className="fetch"
            buttonStyle="primary"
            onClick={() => this.fetchResults(query)}
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
        <ProgressBar
          percent={parseInt(query.progress.toFixed(0), 10)}
          striped
        />
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
      query && query.extra && query.extra.progress
        ? query.extra.progress
        : null;
    return (
      <div style={LOADING_STYLES}>
        <div>{!progressBar && <Loading position="normal" />}</div>
        <QueryStateLabel query={query} />
        <div>
          {progressMsg && <Alert bsStyle="success">{progressMsg}</Alert>}
        </div>
        <div>{progressBar}</div>
        <div>{trackingUrl}</div>
      </div>
    );
  }
}
