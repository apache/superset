import React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';

const $ = require('jquery');
const QUERY_UPDATE_FREQ = 1000;
const QUERY_UPDATE_BUFFER_MS = 5000;

class QueryAutoRefresh extends React.PureComponent {
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
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
    const url = '/superset/queries/' + (this.props.queriesLastUpdate - QUERY_UPDATE_BUFFER_MS);
    // No updates in case of failure.
    $.getJSON(url, (data) => {
      if (Object.keys(data).length > 0) {
        this.props.actions.refreshQueries(data);
      }
      this.props.actions.setNetworkStatus(true);
    })
    .fail(() => {
      this.props.actions.setNetworkStatus(false);
    });
  }
  render() {
    return null;
  }
}
QueryAutoRefresh.propTypes = {
  actions: React.PropTypes.object,
  queriesLastUpdate: React.PropTypes.number,
};
QueryAutoRefresh.defaultProps = {
  // queries: null,
};

function mapStateToProps(state) {
  return {
    queriesLastUpdate: state.queriesLastUpdate,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryAutoRefresh);
