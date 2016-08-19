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
      this.timer = setInterval(this.stopwatch.bind(this), 2000);
    }
  }
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }
  stopwatch() {
    // TODO $.get((data) => {
    //  
    //  this.props.actions.refreshQueries(data);
    // });
    console.log(new Date());
  }
  render() {
    return null;
  }
}
QueryAutoRefresh.propTypes = {
  query: React.PropTypes.object,
};
QueryAutoRefresh.defaultProps = {
  query: null,
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
