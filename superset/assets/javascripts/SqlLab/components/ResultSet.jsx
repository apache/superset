import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import shortid from 'shortid';

import VisualizeModal from './VisualizeModal';
import HighlightedSql from './HighlightedSql';
import FilterableTable from '../../components/FilterableTable/FilterableTable';
import QueryStateLabel from './QueryStateLabel';
import { t } from '../../locales';

const propTypes = {
  actions: PropTypes.object,
  csv: PropTypes.bool,
  query: PropTypes.object,
  search: PropTypes.bool,
  showSql: PropTypes.bool,
  visualize: PropTypes.bool,
  cache: PropTypes.bool,
  height: PropTypes.number.isRequired,
};
const defaultProps = {
  search: true,
  visualize: true,
  showSql: false,
  csv: true,
  actions: {},
  cache: false,
};

const SEARCH_HEIGHT = 46;

export default class ResultSet extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showModal: false,
      data: null,
    };
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
  getControls() {
    if (this.props.search || this.props.visualize || this.props.csv) {
      let csvButton;
      if (this.props.csv) {
        csvButton = (
          <Button bsSize="small" href={'/superset/csv/' + this.props.query.id}>
            <i className="fa fa-file-text-o" /> {t('.CSV')}
          </Button>
        );
      }
      let visualizeButton;
      if (this.props.visualize) {
        visualizeButton = (
          <Button
            bsSize="small"
            onClick={this.showModal.bind(this)}
          >
            <i className="fa fa-line-chart m-l-1" /> {t('Visualize')}
          </Button>
        );
      }
      let searchBox;
      if (this.props.search) {
        searchBox = (
          <input
            type="text"
            onChange={this.changeSearch.bind(this)}
            className="form-control input-sm"
            placeholder={t('Search Results')}
          />
        );
      }
      return (
        <div className="ResultSetControls">
          <div className="clearfix">
            <div className="pull-left">
              <ButtonGroup>
                {visualizeButton}
                {csvButton}
              </ButtonGroup>
            </div>
            <div className="pull-right">
              {searchBox}
            </div>
          </div>
        </div>
      );
    }
    return <div className="noControls" />;
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
  showModal() {
    this.setState({ showModal: true });
  }
  hideModal() {
    this.setState({ showModal: false });
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
  render() {
    const query = this.props.query;
    const height = this.props.search ? this.props.height - SEARCH_HEIGHT : this.props.height;
    let sql;

    if (this.props.showSql) {
      sql = <HighlightedSql sql={query.sql} />;
    }

    if (query.state === 'stopped') {
      return <Alert bsStyle="warning">Query was stopped</Alert>;
    } else if (query.state === 'failed') {
      return <Alert bsStyle="danger">{query.errorMessage}</Alert>;
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
            <VisualizeModal
              show={this.state.showModal}
              query={this.props.query}
              onHide={this.hideModal.bind(this)}
            />
            {this.getControls.bind(this)()}
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
    if (query.progress > 0 && query.state === 'running') {
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
      <div>
        <img className="loading" alt={t('Loading...')} src="/static/assets/images/loading.gif" />
        <QueryStateLabel query={query} />
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
