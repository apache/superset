import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';

const $ = require('jquery');
const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;

class QueryAutoRefresh extends React.PureComponent {
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  shouldCheckForQueries() {
    // if there are started or running queries, this method should return true
    const { queries } = this.props;
    const queryKeys = Object.keys(queries);
    const queriesAsArray = queryKeys.map(key => queries[key]);
    return queriesAsArray.some(q => ['running', 'started', 'pending', 'fetching'].indexOf(q.state) >= 0);
  }
  startTimer() {
    if (!(this.timer)) {
      this.timer = setInterval(this.stopwatch.bind(this), QUERY_UPDATE_FREQ);
    }
  }
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }
  stopwatch() {
    // only poll /superset/queries/ if there are started or running queries
    if (this.shouldCheckForQueries()) {
      const url = '/superset/queries/' + (this.props.queriesLastUpdate - QUERY_UPDATE_BUFFER_MS);
      $.getJSON(url, (data) => {
        if (Object.keys(data).length > 0) {
          this.props.actions.refreshQueries(data);
        }
      });
    }
  }
  render() {
    return null;
  }
}
QueryAutoRefresh.propTypes = {
  queries: React.PropTypes.object.isRequired,
  actions: React.PropTypes.object.isRequired,
  queriesLastUpdate: React.PropTypes.number.isRequired,
};

function mapStateToProps(state) {
  return {
    queries: state.queries,
    queriesLastUpdate: state.queriesLastUpdate,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryAutoRefresh);
