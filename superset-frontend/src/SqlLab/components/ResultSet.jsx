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
import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import shortid from 'shortid';
import { t } from '@superset-ui/translation';

import Loading from '../../components/Loading';
import ExploreCtasResultsButton from './ExploreCtasResultsButton';
import ExploreResultsButton from './ExploreResultsButton';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';
import CopyToClipboard from '../../components/CopyToClipboard';
import { prepareCopyToClipboardTabularData } from '../../utils/common';
import { CtasEnum } from '../actions/sqlLab';

const propTypes = {
  actions: PropTypes.object,
  csv: PropTypes.bool,
  query: PropTypes.object,
  search: PropTypes.bool,
  showSql: PropTypes.bool,
  visualize: PropTypes.bool,
  cache: PropTypes.bool,
  height: PropTypes.number.isRequired,
  database: PropTypes.object,
  displayLimit: PropTypes.number.isRequired,
};
const defaultProps = {
  search: true,
  visualize: true,
  showSql: false,
  csv: true,
  actions: {},
  cache: false,
  database: {},
};

const SEARCH_HEIGHT = 46;

const LOADING_STYLES = { position: 'relative', minHeight: 100 };

export default class ResultSet extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showExploreResultsButton: false,
      data: null,
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
  UNSAFE_componentWillReceiveProps(nextProps) {
    // when new results comes in, save them locally and clear in store
    if (
      this.props.cache &&
      !nextProps.query.cached &&
      nextProps.query.results &&
      nextProps.query.results.data &&
      nextProps.query.results.data.length > 0
    ) {
      this.setState(
        { data: nextProps.query.results.data },
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
  clearQueryResults(query) {
    this.props.actions.clearQueryResults(query);
  }
  popSelectStar(tmpSchema, tmpTable) {
    const qe = {
      id: shortid.generate(),
      title: tmpTable,
      autorun: false,
      dbId: this.props.query.dbId,
      sql: `SELECT * FROM ${tmpSchema}.${tmpTable}`,
    };
    this.props.actions.addQueryEditor(qe);
  }
  toggleExploreResultsButton() {
    this.setState({
      showExploreResultsButton: !this.state.showExploreResultsButton,
    });
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  fetchResults(query) {
    this.props.actions.fetchQueryResults(query, this.props.displayLimit);
  }
  reFetchQueryResults(query) {
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
            {this.props.visualize && (
              <ExploreResultsButton
                query={this.props.query}
                database={this.props.database}
                actions={this.props.actions}
              />
            )}
            {this.props.csv && (
              <Button
                bsSize="small"
                href={'/superset/csv/' + this.props.query.id}
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

    if (this.props.showSql) {
      sql = <HighlightedSql sql={query.sql} />;
    }

    if (query.state === 'stopped') {
      return <Alert bsStyle="warning">Query was stopped</Alert>;
    } else if (query.state === 'failed') {
      return (
        <Alert bsStyle="danger">
          {query.errorMessage}
          {query.link && (
            <a href={query.link} target="_blank" rel="noopener noreferrer">
              {' '}
              {t('(Request Access)')}{' '}
            </a>
          )}
        </Alert>
      );
    } else if (query.state === 'success' && query.ctas) {
      // Async queries
      let tmpSchema = query.tempSchema;
      let tmpTable = query.tempTableName;
      // Sync queries, query.results.query contains the source of truth for them.
      if (query.results && query.results.query) {
        tmpTable = query.results.query.tempTable;
        tmpSchema = query.results.query.tempSchema;
      }
      let object = 'Table';
      if (query.ctas_method === CtasEnum.VIEW) {
        object = 'View';
      }
      return (
        <div>
          <Alert bsStyle="info">
            {t(object)} [
            <strong>
              {tmpSchema}.{tmpTable}
            </strong>
            ] {t('was created')} &nbsp;
            <ButtonGroup>
              <Button
                bsSize="small"
                className="m-r-5"
                onClick={() => this.popSelectStar(tmpSchema, tmpTable)}
              >
                {t('Query in a new tab')}
              </Button>
              <ExploreCtasResultsButton
                table={tmpTable}
                schema={tmpSchema}
                dbId={query.dbId}
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
          onClick={() => {
            window.open(query.trackingUrl);
          }}
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
ResultSet.propTypes = propTypes;
ResultSet.defaultProps = defaultProps;
