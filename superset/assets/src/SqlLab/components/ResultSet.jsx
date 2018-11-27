import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import shortid from 'shortid';
import { t } from '@superset-ui/translation';

import Loading from '../../components/Loading';
import ExploreResultsButton from './ExploreResultsButton';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';

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

const LOADING_STYLES = { position: 'relative', height: 50 };

export default class ResultSet extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showExploreResultsButton: false,
      data: null,
    };
    this.toggleExploreResultsButton = this.toggleExploreResultsButton.bind(this);
  }
  componentDidMount() {
    // only do this the first time the component is rendered/mounted
    this.reRunQueryIfSessionTimeoutErrorOnMount();
  }
  componentWillReceiveProps(nextProps) {
    // when new results comes in, save them locally and clear in store
    if (this.props.cache && (!nextProps.query.cached)
      && nextProps.query.results
      && nextProps.query.results.data.length > 0) {
      this.setState(
        { data: nextProps.query.results.data },
        this.clearQueryResults(nextProps.query),
      );
    }
    if (nextProps.query.resultsKey
      && nextProps.query.resultsKey !== this.props.query.resultsKey) {
      this.fetchResults(nextProps.query);
    }
  }
  clearQueryResults(query) {
    this.props.actions.clearQueryResults(query);
  }
  popSelectStar() {
    const qe = {
      id: shortid.generate(),
      title: this.props.query.tempTable,
      autorun: false,
      dbId: this.props.query.dbId,
      sql: `SELECT * FROM ${this.props.query.tempTable}`,
    };
    this.props.actions.addQueryEditor(qe);
  }
  toggleExploreResultsButton() {
    this.setState({ showExploreResultsButton: !this.state.showExploreResultsButton });
  }
  changeSearch(event) {
    this.setState({ searchText: event.target.value });
  }
  fetchResults(query) {
    this.props.actions.fetchQueryResults(query);
  }
  reFetchQueryResults(query) {
    this.props.actions.reFetchQueryResults(query);
  }
  reRunQueryIfSessionTimeoutErrorOnMount() {
    const { query } = this.props;
    if (query.errorMessage && query.errorMessage.indexOf('session timed out') > 0) {
      this.props.actions.runQuery(query, true);
    }
  }
  renderControls() {
    if (this.props.search || this.props.visualize || this.props.csv) {
      return (
        <div className="ResultSetControls">
          <div className="clearfix">
            <div className="pull-left">
              <ButtonGroup>
                {this.props.visualize &&
                  <ExploreResultsButton
                    query={this.props.query}
                    database={this.props.database}
                    actions={this.props.actions}
                  />}
                {this.props.csv &&
                  <Button bsSize="small" href={'/superset/csv/' + this.props.query.id}>
                    <i className="fa fa-file-text-o" /> {t('.CSV')}
                  </Button>}
              </ButtonGroup>
            </div>
            <div className="pull-right">
              {this.props.search &&
                <input
                  type="text"
                  onChange={this.changeSearch.bind(this)}
                  className="form-control input-sm"
                  placeholder={t('Search Results')}
                />
              }
            </div>
          </div>
        </div>
      );
    }
    return <div className="noControls" />;
  }
  render() {
    const query = this.props.query;
    const height = Math.max(0,
      (this.props.search ? this.props.height - SEARCH_HEIGHT : this.props.height));
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
          {query.link && <a href={query.link}> {t('(Request Access)')} </a>}
        </Alert>);
    } else if (query.state === 'success' && query.ctas) {
      return (
        <div>
          <Alert bsStyle="info">
            {t('Table')} [<strong>{query.tempTable}</strong>] {t('was ' +
            'created')} &nbsp;
            <Button
              bsSize="small"
              className="m-r-5"
              onClick={this.popSelectStar.bind(this)}
            >
              {t('Query in a new tab')}
            </Button>
          </Alert>
        </div>);
    } else if (query.state === 'success') {
      const results = query.results;
      let data;
      if (this.props.cache && query.cached) {
        data = this.state.data;
      } else if (results && results.data) {
        data = results.data;
      }
      if (data && data.length > 0) {
        return (
          <div>
            {this.renderControls.bind(this)()}
            {sql}
            <FilterableTable
              data={data}
              orderedColumnKeys={results.columns.map(col => col.name)}
              height={height}
              filterText={this.state.searchText}
            />
          </div>
        );
      } else if (data && data.length === 0) {
        return <Alert bsStyle="warning">The query returned no data</Alert>;
      }
    }
    if (query.cached) {
      return (
        <Button
          bsSize="sm"
          bsStyle="primary"
          onClick={this.reFetchQueryResults.bind(this, query)}
        >
          {t('Fetch data preview')}
        </Button>
      );
    }
    let progressBar;
    let trackingUrl;
    if (query.progress > 0) {
      progressBar = (
        <ProgressBar
          striped
          now={query.progress}
          label={`${query.progress}%`}
        />);
    }
    if (query.trackingUrl) {
      trackingUrl = (
        <Button
          bsSize="small"
          onClick={() => { window.open(query.trackingUrl); }}
        >
          {t('Track Job')}
        </Button>
      );
    }
    return (
      <div style={LOADING_STYLES}>
        <QueryStateLabel query={query} />
        {!progressBar && <Loading />}
        {progressBar}
        <div>
          {trackingUrl}
        </div>
      </div>
    );
  }
}
ResultSet.propTypes = propTypes;
ResultSet.defaultProps = defaultProps;
