import React from 'react';
import { now, fDuration } from '../../modules/dates';

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
      const endDttm = this.props.query.endDttm || now();
      const clockStr = fDuration(this.props.query.startDttm, endDttm);
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
      const bsStyle = STATE_BSSTYLE_MAP[this.props.query.state];
      timerSpan = (
        <span className={'inlineBlock m-r-5 label label-' + bsStyle}>
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
