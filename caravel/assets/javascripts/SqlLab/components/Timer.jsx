import React from 'react';
import moment from 'moment';

import { STATE_BSSTYLE_MAP } from '../common.js';

class Timer extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clockStr: '',
    };
  }
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  startTimer() {
    if (!(this.timer)) {
      this.timer = setInterval(this.stopwatch.bind(this), 30);
    }
  }
  stopTimer() {
    clearInterval(this.timer);
    this.timer = null;
  }
  stopwatch() {
    if (this.props && this.props.query) {
      let fromDttm = (this.props.query.endDttm) ? this.props.query.endDttm : new Date().getTime();
      const since = (this.props.query.endDttm) ? this.props.query.endDttm : new Date().getTime();
      const duration = moment.utc(since - this.props.query.startDttm);
      const clockStr = duration.format('HH:mm:ss.SS');
      this.setState({ clockStr });
      if (this.props.query.state !== 'running') {
        this.stopTimer();
      }
    }
  }
  render() {
    if (this.props.query && this.props.query.state === 'running') {
      this.startTimer();
    }
    let timerSpan = null;
    if (this.props && this.props.query) {
      timerSpan = (
        <span className={'inlineBlock m-r-5 label label-' + STATE_BSSTYLE_MAP[this.props.query.state]}>
          {this.state.clockStr}
        </span>
      );
    }
    return timerSpan;
  }
}
Timer.propTypes = {
  query: React.PropTypes.object,
};
Timer.defaultProps = {
  query: null,
};

export default Timer;
