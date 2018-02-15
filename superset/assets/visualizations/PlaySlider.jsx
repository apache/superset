import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';

import Mousetrap from 'mousetrap';

import 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';
import './PlaySlider.css';

import { t } from '../javascripts/locales';

const propTypes = {
  start: PropTypes.number.isRequired,
  step: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  values: PropTypes.array.isRequired,
  onChange: PropTypes.func,
  loopDuration: PropTypes.number,
  maxFrames: PropTypes.number,
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  reversed: PropTypes.bool,
  disabled: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
  loopDuration: 15000,
  maxFrames: 100,
  orientation: 'horizontal',
  reversed: false,
  disabled: false,
};

export default class PlaySlider extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { intervalId: null };

    const range = props.end - props.start;
    const frames = Math.min(props.maxFrames, range / props.step);
    const width = range / frames;
    this.intervalMilliseconds = props.loopDuration / frames;
    this.increment = width < props.step ? props.step : width - (width % props.step);

    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.step = this.step.bind(this);
    this.getPlayClass = this.getPlayClass.bind(this);
    this.formatter = this.formatter.bind(this);
  }
  componentDidMount() {
    Mousetrap.bind(['space'], this.play);
  }
  componentWillUnmount() {
    Mousetrap.unbind(['space']);
  }
  onChange(event) {
    this.props.onChange(event.target.value);
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
      const id = setInterval(this.step, this.intervalMilliseconds);
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
    let values = this.props.values.map(value => value + this.increment);
    if (values[1] > this.props.end) {
      const cr = values[0] - this.props.start;
      values = values.map(value => value - cr);
    }
    this.props.onChange(values);
  }
  formatter(values) {
    if (this.props.disabled) {
      return t('Data has no time steps');
    }

    let parts = values;
    if (!Array.isArray(values)) {
      parts = [values];
    } else if (values[0] === values[1]) {
      parts = [values[0]];
    }
    return parts.map(value => (new Date(value)).toUTCString()).join(' : ');
  }
  render() {
    return (
      <Row className="play-slider">
        <Col md={1} className="padded">
          <i className={this.getPlayClass()} onClick={this.play} />
          <i className="fa fa-step-forward fa-lg slider-button " onClick={this.step} />
        </Col>
        <Col md={11} className="padded">
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
        </Col>
      </Row>
    );
  }
}

PlaySlider.propTypes = propTypes;
PlaySlider.defaultProps = defaultProps;
