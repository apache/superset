import React from 'react';
import { now, fDuration } from '../modules/dates';

class Timer extends React.PureComponent {
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
    if (this.props && this.props.startTime) {
      const endDttm = this.props.endTime || now();
      if (this.props.startTime < endDttm) {
        const clockStr = fDuration(this.props.startTime, endDttm);
        this.setState({ clockStr });
      }
      if (!this.props.isRunning) {
        this.stopTimer();
      }
    }
  }
  render() {
    if (this.props && this.props.isRunning) {
      this.startTimer();
    }
    let timerSpan = null;
    if (this.props) {
      timerSpan = (
        <span
          className={`inlineBlock m-r-5 label label-${this.props.status}`}
          style={this.props.style}
        >
          {this.state.clockStr}
        </span>
      );
    }
    return timerSpan;
  }
}
Timer.propTypes = {
  startTime: React.PropTypes.number,
  endTime: React.PropTypes.number,
  isRunning: React.PropTypes.bool.isRequired,
  status: React.PropTypes.string,
  style: React.PropTypes.object,
};

Timer.defaultProps = {
  startTime: null,
  endTime: null,
  status: 'success',
  style: null,
};

export default Timer;
