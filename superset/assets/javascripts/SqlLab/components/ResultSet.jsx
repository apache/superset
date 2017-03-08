import React from 'react';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import { Table } from 'reactable';
import shortid from 'shortid';

import VisualizeModal from './VisualizeModal';
import HighlightedSql from './HighlightedSql';

const propTypes = {
  actions: React.PropTypes.object,
  csv: React.PropTypes.bool,
  query: React.PropTypes.object,
  search: React.PropTypes.bool,
  searchText: React.PropTypes.string,
  showSql: React.PropTypes.bool,
  visualize: React.PropTypes.bool,
  cache: React.PropTypes.bool,
};
const defaultProps = {
  search: true,
  visualize: true,
  showSql: false,
  csv: true,
  searchText: '',
  actions: {},
  cache: false,
};


class ResultSet extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showModal: false,
      data: [],
    };
  }
  componentWillReceiveProps(nextProps) {
    // when new results comes in, save them locally and clear in store
    if (this.props.cache && (!nextProps.query.cached)
      && nextProps.query.results
      && nextProps.query.results.data.length > 0) {
      this.setState(
        { data: nextProps.query.results.data },
        this.clearQueryResults(nextProps.query)
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
            <i className="fa fa-file-text-o" /> .CSV
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
            <i className="fa fa-line-chart m-l-1" /> Visualize
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
            placeholder="Search Results"
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
  render() {
    const query = this.props.query;
    const results = query.results;
    let data;
    if (this.props.cache && query.cached) {
      data = this.state.data;
    } else {
      data = results ? results.data : [];
    }

    let sql;

    if (query.state === 'stopped') {
      return <Alert bsStyle="warning">Query was stopped</Alert>;
    }

    if (this.props.showSql) {
      sql = <HighlightedSql sql={query.sql} />;
    }
    if (['running', 'pending', 'fetching'].indexOf(query.state) > -1) {
      let progressBar;
      if (query.progress > 0 && query.state === 'running') {
        progressBar = (
          <ProgressBar
            striped
            now={query.progress}
            label={`${query.progress}%`}
          />);
      }
      return (
        <div>
          <img className="loading" alt="Loading..." src="/static/assets/images/loading.gif" />
          {progressBar}
        </div>
      );
    } else if (query.state === 'failed') {
      return <Alert bsStyle="danger">{query.errorMessage}</Alert>;
    } else if (query.state === 'success' && query.ctas) {
      return (
        <div>
          <Alert bsStyle="info">
            Table [<strong>{query.tempTable}</strong>] was
            created &nbsp;
            <Button
              bsSize="small"
              className="m-r-5"
              onClick={this.popSelectStar.bind(this)}
            >
              Query in a new tab
            </Button>
          </Alert>
        </div>);
    } else if (query.state === 'success') {
      if (results && data && data.length > 0) {
        return (
          <div>
            <VisualizeModal
              show={this.state.showModal}
              query={this.props.query}
              onHide={this.hideModal.bind(this)}
            />
            {this.getControls.bind(this)()}
            {sql}
            <div className="ResultSet">
              <Table
                data={data.map(function (row) {
                  const newRow = {};
                  for (const k in row) {
                    const val = row[k];
                    if (typeof(val) === 'string') {
                      newRow[k] = val;
                    } else {
                      newRow[k] = JSON.stringify(val);
                    }
                  }
                  return newRow;
                })}
                columns={results.columns.map((col) => col.name)}
                sortable
                className="table table-condensed table-bordered"
                filterBy={this.state.searchText}
                filterable={results.columns.map((c) => c.name)}
                hideFilterInput
              />
            </div>
          </div>
        );
      }
    }
    if (query.cached) {
      return (
        <Button
          bsSize="sm"
          bsStyle="primary"
          onClick={this.reFetchQueryResults.bind(this, query)}
        >
          Fetch data preview
        </Button>
      );
    }
    return <Alert bsStyle="warning">The query returned no data</Alert>;
  }
}
ResultSet.propTypes = propTypes;
ResultSet.defaultProps = defaultProps;

export default ResultSet;
