import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import './PlaySlider.css';

const propTypes = {
  start: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  intervalMilliseconds: PropTypes.number,
}

const defaultProps = {
  onChange: () => {},
  intervalMilliseconds: 500,
};

export default class PlaySlider extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {intervalId: null};

    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.step = this.step.bind(this);
    this.getPlayIcon = this.getPlayIcon.bind(this);
  }
  formatter(values) {
    if (!Array.isArray(values)) {
      values = [values];
    }
    return values.map(value => (new Date(value)).toUTCString()).join(' : ');
  }
  onChange(event) {
    this.props.onChange({values: event.target.value});
    if (this.state.intervalId != null) {
      this.pause();
    }
  }
  play() {
    if (this.state.intervalId != null) {
      this.pause();
    } else {
      const id = setInterval(this.step, this.props.intervalMilliseconds);
      this.setState({intervalId: id});
    }
  }
  pause() {
    clearInterval(this.state.intervalId);
    this.setState({intervalId: null});
  }
  step() {
    let values = this.props.values.map(value => value + this.props.step);
    if (values[1] > this.props.end) {
      const cr = values[0] - this.props.start;
      values = values.map(value => value - cr);
    }
    this.props.onChange({values: values});
  }
  getPlayIcon() {
    if (this.state.intervalId != null) {
      return '⏸️';
    } else {
      return '▶️';
    }
  }
  render() {
    return (
      <div>
        <button type="button" onClick={this.play}>{this.getPlayIcon()}</button>
        <button type="button" onClick={this.step}>⏩</button>
        <ReactBootstrapSlider
          value={this.props.values}
          formatter={this.formatter}
          change={this.onChange}
          min={this.props.start}
          max={this.props.end}
          step={this.props.step}
          orientation="horizontal"
          reversed={false}
          disabled="enabled"
        />
      </div>
    );
  }
}

PlaySlider.propTypes = propTypes;
PlaySlider.defaultProps = defaultProps;
