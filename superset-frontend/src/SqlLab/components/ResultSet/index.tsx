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
import ButtonGroup from 'src/components/ButtonGroup';
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';
import shortid from 'shortid';
import { styled, t, QueryResponse } from '@superset-ui/core';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import { SaveDatasetModal } from 'src/SqlLab/components/SaveDatasetModal';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import ProgressBar from 'src/components/ProgressBar';
import Loading from 'src/components/Loading';
import FilterableTable, {
  MAX_COLUMNS_FOR_TABLE,
} from 'src/components/FilterableTable';
import CopyToClipboard from 'src/components/CopyToClipboard';
import { prepareCopyToClipboardTabularData } from 'src/utils/common';
import { CtasEnum } from 'src/SqlLab/actions/sqlLab';
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

const LOADING_STYLES: CSSProperties = { position: 'relative', minHeight: 100 };

interface ResultSetProps {
  showControls?: boolean;
  actions: Record<string, any>;
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

interface ResultSetState {
  searchText: string;
  showExploreResultsButton: boolean;
  data: Record<string, any>[];
  showSaveDatasetModal: boolean;
  alertIsOpen: boolean;
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
      alertIsOpen: false,
    };
    this.changeSearch = this.changeSearch.bind(this);
    this.fetchResults = this.fetchResults.bind(this);
    this.popSelectStar = this.popSelectStar.bind(this);
    this.reFetchQueryResults = this.reFetchQueryResults.bind(this);
    this.toggleExploreResultsButton =
      this.toggleExploreResultsButton.bind(this);
  }

  async componentDidMount() {
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

  calculateAlertRefHeight = (alertElement: HTMLElement | null) => {
    if (alertElement) {
      this.setState({ alertIsOpen: true });
    } else {
      this.setState({ alertIsOpen: false });
    }
  };

  clearQueryResults(query: QueryResponse) {
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

  fetchResults(query: QueryResponse) {
    this.props.actions.fetchQueryResults(query, this.props.displayLimit);
  }

  reFetchQueryResults(query: QueryResponse) {
    this.props.actions.reFetchQueryResults(query);
  }

  reRunQueryIfSessionTimeoutErrorOnMount() {
    const { query } = this.props;
    if (
      query.errorMessage &&
      query.errorMessage.indexOf('session timed out') > 0
    ) {
      this.props.actions.reRunQuery(query);
    }
  }

  renderControls() {
    if (this.props.search || this.props.visualize || this.props.csv) {
      let { data } = this.props.query.results;
      if (this.props.cache && this.props.query.cached) {
        ({ data } = this.state);
      }
      const { columns } = this.props.query.results;
      // Added compute logic to stop user from being able to Save & Explore
      const { showSaveDatasetModal } = this.state;
      const { query } = this.props;

      return (
        <ResultSetControls>
          <SaveDatasetModal
            visible={showSaveDatasetModal}
            onHide={() => this.setState({ showSaveDatasetModal: false })}
            buttonTextOnSave={t('Save & Explore')}
            buttonTextOnOverwrite={t('Overwrite & Explore')}
            modalDescription={t(
              'Save this query as a virtual dataset to continue exploring',
            )}
            datasource={query}
          />
          <ResultSetButtons>
            {this.props.visualize &&
              this.props.database?.allows_virtual_table_explore && (
                <ExploreResultsButton
                  database={this.props.database}
                  onClick={() => this.setState({ showSaveDatasetModal: true })}
                />
              )}
            {this.props.csv && (
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
          {this.props.search && (
            <input
              type="text"
              onChange={this.changeSearch}
              value={this.state.searchText}
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
  }

  renderRowsReturned() {
    const { results, rows, queryLimit, limitingFactor } = this.props.query;
    let limitMessage;
    const limitReached = results?.displayLimitReached;
    const limit = queryLimit || results.query.limit;
    const isAdmin = !!this.props.user?.roles?.Admin;
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
      limit === this.props.defaultQueryLimit &&
      limitingFactor === LIMITING_FACTOR.DROPDOWN;

    if (limitingFactor === LIMITING_FACTOR.QUERY && this.props.csv) {
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
            <span>{limitMessage}</span>
          </span>
        )}
        {!limitReached && shouldUseDefaultDropdownAlert && (
          <div ref={this.calculateAlertRefHeight}>
            <Alert
              type="warning"
              message={t('%(rows)d rows returned', { rows })}
              onClose={() => this.setState({ alertIsOpen: false })}
              description={t(
                'The number of rows displayed is limited to %s by the dropdown.',
                rows,
              )}
            />
          </div>
        )}
        {limitReached && (
          <div ref={this.calculateAlertRefHeight}>
            <Alert
              type="warning"
              onClose={() => this.setState({ alertIsOpen: false })}
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
  }

  render() {
    const { query } = this.props;
    const limitReached = query?.results?.displayLimitReached;
    let sql;
    let exploreDBId = query.dbId;
    if (this.props.database && this.props.database.explore_database_id) {
      exploreDBId = this.props.database.explore_database_id;
    }

    if (this.props.showSql) sql = <HighlightedSql sql={query.sql} />;

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
                    onClick={() => this.popSelectStar(tempSchema, tempTable)}
                  >
                    {t('Query in a new tab')}
                  </Button>
                  <ExploreCtasResultsButton
                    // @ts-ignore Redux types are difficult to work with, ignoring for now
                    actions={this.props.actions}
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
      // if we want results panel to be propper height because the
      // FilterTable component nedds an explcit height to render
      // react-virtualized Table component
      const height = this.state.alertIsOpen
        ? this.props.height - alertContainerHeight
        : this.props.height - rowMessageHeight;
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
            {this.renderRowsReturned()}
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
          <Alert type="warning" message={t('The query returned no data')} />
        );
      }
    }
    if (query.cached || (query.state === 'success' && !query.results)) {
      if (query.isDataPreview) {
        return (
          <Button
            buttonSize="small"
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
            buttonStyle="primary"
            onClick={() => this.fetchResults(query)}
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
        {/* show loading bar whenever progress bar is completed but needs time to render */}
        <div>{query.progress === 100 && <Loading position="normal" />}</div>
        <QueryStateLabel query={query} />
        <div>
          {progressMsg && <Alert type="success" message={progressMsg} />}
        </div>
        <div>{query.progress !== 100 && progressBar}</div>
        <div>{trackingUrl}</div>
      </div>
    );
  }
}
