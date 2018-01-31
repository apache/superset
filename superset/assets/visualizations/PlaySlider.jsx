import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import './PlaySlider.css';

import { t } from '../javascripts/locales';

const propTypes = {
  start: PropTypes.number.isRequired,
  step: PropTypes.number,
  end: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  intervalMilliseconds: PropTypes.number,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  reversed: PropTypes.bool,
  disabled: PropTypes.bool,
}

const defaultProps = {
  onChange: () => {},
  intervalMilliseconds: 500,
  orientation: 'horizontal',
  reversed: false,
  disabled: false,
};

export default class PlaySlider extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {intervalId: null};

    this.formatter = this.formatter.bind(this);
    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.step = this.step.bind(this);
    this.getPlayClass = this.getPlayClass.bind(this);
  }
  formatter(values) {
    if (this.state.step == null) {
      return t('Please select a time grain in order to play through time');
    }
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
  getPlayClass() {
    if (this.state.intervalId == null) {
      return 'fa fa-play fa-lg slider-button';
    } else {
      return 'fa fa-pause fa-lg slider-button';
    }
  }
  render() {
    return (
      <div className="row play-slider">
        <div className="col-8 col-sm-1 padded">
          <i className={this.getPlayClass()} onClick={this.play} />
          <i className="fa fa-step-forward fa-lg slider-button " onClick={this.step} />
        </div>
        <div className="col-4 col-sm-11 padded">
          <ReactBootstrapSlider
            value={this.props.values}
            formatter={this.formatter}
            change={this.onChange}
            min={this.props.start}
            max={this.props.end}
            step={this.props.step}
            orientation={this.props.orientation}
            reversed={this.props.reversed}
            disabled={this.props.disabled ? 'disabled' : 'enabled'}
          />
        </div>
      </div>
    );
  }
}

PlaySlider.propTypes = propTypes;
PlaySlider.defaultProps = defaultProps;
