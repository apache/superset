import React from 'react';
import PropTypes from 'prop-types';

import 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
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
};

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

    this.state = { intervalId: null };

    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.step = this.step.bind(this);
    this.getPlayClass = this.getPlayClass.bind(this);
    this.formatter = this.formatter.bind(this);
  }
  onChange(event) {
    this.props.onChange({ values: event.target.value });
    if (this.state.intervalId != null) {
      this.pause();
    }
  }
  getPlayClass() {
    if (this.state.intervalId == null) {
      return 'fa fa-play fa-lg slider-button';
    }
    return 'fa fa-pause fa-lg slider-button';
  }
  play() {
    if (this.props.disabled) {
      return;
    }
    if (this.state.intervalId != null) {
      this.pause();
    } else {
      const id = setInterval(this.step, this.props.intervalMilliseconds);
      this.setState({ intervalId: id });
    }
  }
  pause() {
    clearInterval(this.state.intervalId);
    this.setState({ intervalId: null });
  }
  step() {
    if (this.props.disabled) {
      return;
    }
    let values = this.props.values.map(value => value + this.props.step);
    if (values[1] > this.props.end) {
      const cr = values[0] - this.props.start;
      values = values.map(value => value - cr);
    }
    this.props.onChange({ values });
  }
  formatter(values) {
    if (this.props.step == null) {
      return t('Please select a time grain in order to play through time');
    }
    const parts = Array.isArray(values) ? values : [values];
    return parts.map(value => (new Date(value)).toUTCString()).join(' : ');
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
