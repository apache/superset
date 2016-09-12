const $ = window.$ = require('jquery');
import React from 'react';

import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import * as Actions from '../actions';
import QuerySearchTable from './QuerySearchTable';
import QuerySearchBar from './QuerySearchBar';

class QuerySearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      queriesArray: [],
    };
  }
  componentWillMount() {
    this.refreshQueries(this.props);
  }
  componentWillReceiveProps(nextProps) {
    this.refreshQueries(nextProps);
  }
  getQueryState(val) {
    let status;
    switch (val) {
      case 1:
        status = 'success';
        break;
      case 2:
        status = 'failed';
        break;
      case 3:
        status = 'running';
        break;
      default:
        status = null;
    }
    return status;
  }
  refreshQueries(nextProps) {
    const userId = nextProps.queryFilter.userId;
    const dbId = nextProps.queryFilter.queryDbId;
    let sql = nextProps.queryFilter.searchText;
    if (sql === '') sql = 'null';
    const showState = this.getQueryState(nextProps.queryFilter.queryState);
    const url = `
      /caravel/search_queries/userId=${userId}&dbId=${dbId}&sql=${sql}&state=${showState}
      `;
    $.getJSON(url, (data, status) => {
      if (status === 'success') {
        let newQueriesArray = [];
        for (const id in data) {
          const q = data[id];
          newQueriesArray.push(q);
        }
        this.setState({ queriesArray: newQueriesArray });
      }
    });
  }
  render() {
    return (
      <div>
        <QuerySearchBar />
        <QuerySearchTable
          columns={[
            'state', 'dbId', 'userId',
            'progress', 'rows', 'sql',
          ]}
          queries={this.state.queriesArray}
        />
      </div>
    );
  }
}
QuerySearch.propTypes = {
  queryFilter: React.PropTypes.object,
};
QuerySearch.defaultProps = {
  queryFilter: {},
};

function mapStateToProps(state) {
  return {
    queryFilter: state.queryFilter,
  };
}
function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuerySearch);
