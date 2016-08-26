import React from 'react';
import moment from 'moment';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import * as Actions from '../actions';

$ = require('jquery');


class QueryAutoRefresh extends React.Component {
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  startTimer() {
    if (!(this.timer)) {
      this.timer = setInterval(this.stopwatch.bind(this), 5000);
    }
  }
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }
  stopwatch() {
    const url = '/caravel/queries/0';
    // No updates in case of failure.
    $.getJSON(
      url,
      (data, status, xhr) => {
        if (status === "success") {
          this.props.actions.refreshQueries(data);
        }
    });
  }
  render() {
    return null;
  }
}
QueryAutoRefresh.propTypes = {
  // queries: React.PropTypes.object,
};
QueryAutoRefresh.defaultProps = {
  // queries: null,
};

function mapStateToProps() {
  return {};
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(Actions, dispatch),
  };
}

export default connect(mapStateToProps, mapDispatchToProps)(QueryAutoRefresh);
