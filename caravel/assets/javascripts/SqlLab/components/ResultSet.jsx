import React from 'react';
import { Alert, Button, ButtonGroup, ProgressBar } from 'react-bootstrap';
import { Table } from 'reactable';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';

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
};
const defaultProps = {
  search: true,
  visualize: true,
  showSql: false,
  csv: true,
  searchText: '',
  actions: {},
};


class ResultSet extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: '',
      showModal: false,
    };
  }
  getControls() {
    if (this.props.search || this.props.visualize || this.props.csv) {
      let csvButton;
      if (this.props.csv) {
        csvButton = (
          <Button bsSize="small" href={'/caravel/csv/' + this.props.query.id}>
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
  render() {
    const query = this.props.query;
    const results = query.results;
    let sql;
    if (this.props.showSql) {
      sql = <HighlightedSql sql={query.sql} />;
    }
    if (['running', 'pending', 'fetching'].includes(query.state)) {
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
            Table [<strong>{query.tempTable}</strong>] was created
          </Alert>
          <p>
            <Button
              bsSize="small"
              className="m-r-5"
              onClick={this.popSelectStar.bind(this)}
            >
              Query in a new tab
            </Button>
            <Button bsSize="small">Visualize</Button>
          </p>
        </div>);
    } else if (query.state === 'success') {
      if (results && results.data && results.data.length > 0) {
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
                data={results.data}
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
      } else if (query.resultsKey) {
        return (
          <div>
            <Alert bsStyle="warning">This query was run asynchronously</Alert>
            <Button bsSize="sm" bsStyle="primary" onClick={this.fetchResults.bind(this, query)}>
              Fetch results
            </Button>
          </div>
        );
      }
    }
    return (<Alert bsStyle="warning">The query returned no data</Alert>);
  }
}
ResultSet.propTypes = propTypes;
ResultSet.defaultProps = defaultProps;

function mapStateToProps() {
  return {};
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}
export default connect(mapStateToProps, mapDispatchToProps)(ResultSet);
