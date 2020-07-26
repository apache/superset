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
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import shortid from 'shortid';
import { t } from '@superset-ui/translation';

import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import Loading from '../../components/Loading';
import ExploreCtasResultsButton from './ExploreCtasResultsButton';
import ExploreResultsButton from './ExploreResultsButton';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';
import CopyToClipboard from '../../components/CopyToClipboard';
import { prepareCopyToClipboardTabularData } from '../../utils/common';
import { CtasEnum } from '../actions/sqlLab';
import { Query } from '../types';

const SEARCH_HEIGHT = 46;

const LOADING_STYLES: CSSProperties = { position: 'relative', minHeight: 100 };

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
}

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
    };

    this.changeSearch = this.changeSearch.bind(this);
    this.fetchResults = this.fetchResults.bind(this);
    this.popSelectStar = this.popSelectStar.bind(this);
    this.reFetchQueryResults = this.reFetchQueryResults.bind(this);
    this.toggleExploreResultsButton = this.toggleExploreResultsButton.bind(
      this,
    );
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
    this.setState({
      showExploreResultsButton: !this.state.showExploreResultsButton,
    });
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
      let data = this.props.query.results.data;
      if (this.props.cache && this.props.query.cached) {
        data = this.state.data;
      }
      return (
        <div className="ResultSetControls">
          <div className="ResultSetButtons">
            {this.props.visualize &&
              this.props.database &&
              this.props.database.allows_virtual_table_explore && (
                <ExploreResultsButton
                  // @ts-ignore Redux types are difficult to work with, ignoring for now
                  query={this.props.query}
                  database={this.props.database}
                  actions={this.props.actions}
                />
              )}
            {this.props.csv && (
              <Button
                bsSize="small"
                href={`/superset/csv/${this.props.query.id}`}
              >
                <i className="fa fa-file-text-o" /> {t('.CSV')}
              </Button>
            )}

            <CopyToClipboard
              text={prepareCopyToClipboardTabularData(data)}
              wrapped={false}
              copyNode={
                <Button bsSize="small">
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
              placeholder={t('Filter Results')}
            />
          )}
        </div>
      );
    }
    return <div className="noControls" />;
  }
  render() {
    const query = this.props.query;
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
    } else if (query.state === 'failed') {
      return (
        <div className="result-set-error-message">
          <ErrorMessageWithStackTrace
            error={query?.errors?.[0]}
            message={query.errorMessage || undefined}
            link={query.link}
            source="sqllab"
          />
        </div>
      );
    } else if (query.state === 'success' && query.ctas) {
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
                bsSize="small"
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
    } else if (query.state === 'success' && query.results) {
      const results = query.results;
      let data;
      if (this.props.cache && query.cached) {
        data = this.state.data;
      } else if (results && results.data) {
        data = results.data;
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
      } else if (data && data.length === 0) {
        return (
          <Alert bsStyle="warning">{t('The query returned no data')}</Alert>
        );
      }
    }
    if (query.cached || (query.state === 'success' && !query.results)) {
      if (query.isDataPreview) {
        return (
          <Button
            bsSize="sm"
            className="fetch"
            bsStyle="primary"
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
      } else if (query.resultsKey) {
        return (
          <Button
            bsSize="sm"
            className="fetch"
            bsStyle="primary"
            onClick={() => this.fetchResults(query)}
          >
            {t('Refetch Results')}
          </Button>
        );
      }
    }
    let progressBar;
    let trackingUrl;
    if (query.progress > 0) {
      progressBar = (
        <ProgressBar
          striped
          now={query.progress}
          label={`${query.progress.toFixed(0)}%`}
        />
      );
    }
    if (query.trackingUrl) {
      trackingUrl = (
        <Button
          bsSize="small"
          onClick={() => query.trackingUrl && window.open(query.trackingUrl)}
        >
          {t('Track Job')}
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
