import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';

const $ = require('jquery');

const QUERY_UPDATE_FREQ = 2000;
const QUERY_UPDATE_BUFFER_MS = 5000;
const QUERY_POLL_WINDOW = 21600000; // 6 hours.

class QueryAutoRefresh extends React.PureComponent {
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  shouldCheckForQueries() {
    // if there are started or running queries < 6 hours old, this method should return true
    const { queries } = this.props;
    return Object.values(queries)
      .filter(q => (q.startDttm >= this.props.queriesLastUpdate - QUERY_POLL_WINDOW))
      .some(q =>
      ['running', 'started', 'pending', 'fetching'].indexOf(q.state) >= 0);
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
    // only poll /superset/queries/ if there are started or running queries started <6 hours ago
    if (this.shouldCheckForQueries()) {
      const url = `/superset/queries/${this.props.queriesLastUpdate - QUERY_UPDATE_BUFFER_MS}`;
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
  queries: PropTypes.object.isRequired,
  actions: PropTypes.object.isRequired,
  queriesLastUpdate: PropTypes.number.isRequired,
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
