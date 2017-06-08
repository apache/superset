import React from 'react';
import PropTypes from 'prop-types';
import { now, fDuration } from '../modules/dates';

const propTypes = {
  endTime: PropTypes.number,
  isRunning: PropTypes.bool.isRequired,
  startTime: PropTypes.number,
  status: PropTypes.string,
  style: PropTypes.object,
};

const defaultProps = {
  endTime: null,
  startTime: null,
  status: 'success',
  style: null,
};

export default class Timer extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      clockStr: '',
    };
    this.stopwatch = this.stopwatch.bind(this);
  }
  componentWillMount() {
    this.startTimer();
  }
  componentWillUnmount() {
    this.stopTimer();
  }
  startTimer() {
    if (!this.timer) {
      this.timer = setInterval(this.stopwatch, 30);
    }
  }
  stopTimer() {
    this.timer = clearInterval(this.timer);
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

Timer.propTypes = propTypes;
Timer.defaultProps = defaultProps;
