import React from 'react';
import moment from 'moment';


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
      let fromDttm = this.props.query.endDttm || new Date();
      fromDttm = moment(fromDttm);
      let duration = fromDttm - moment(this.props.query.startDttm).valueOf();
      duration = moment.utc(duration);
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
        <span className={'label label-warning inlineBlock m-r-5 ' + this.props.query.state}>
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
