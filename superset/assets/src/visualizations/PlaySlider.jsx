import React from 'react';
import PropTypes from 'prop-types';
import { Row, Col } from 'react-bootstrap';

import Mousetrap from 'mousetrap';

import BootrapSliderWrapper from '../components/BootstrapSliderWrapper';
import './PlaySlider.css';

import { t } from '../locales';

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
  range: PropTypes.bool,
};

const defaultProps = {
  onChange: () => {},
  loopDuration: 15000,
  maxFrames: 100,
  orientation: 'horizontal',
  reversed: false,
  disabled: false,
  range: true,
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
    this.stepBackward = this.stepBackward.bind(this);
    this.stepForward = this.stepForward.bind(this);
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
      const id = setInterval(this.stepForward, this.intervalMilliseconds);
      this.setState({ intervalId: id });
    }
  }
  pause() {
    clearInterval(this.state.intervalId);
    this.setState({ intervalId: null });
  }
  stepForward() {
    const { start, end, step, values, disabled } = this.props;

    if (disabled) {
      return;
    }

    const currentValues = Array.isArray(values) ? values : [values, values + step];
    const nextValues = currentValues.map(value => value + this.increment);
    const carriageReturn = (nextValues[1] > end) ? (nextValues[0] - start) : 0;

    this.props.onChange(nextValues.map(value => value - carriageReturn));
  }
  stepBackward() {
    const { start, end, step, values, disabled } = this.props;

    if (disabled) {
      return;
    }

    const currentValues = Array.isArray(values) ? values : [values, values + step];
    const nextValues = currentValues.map(value => value - this.increment);
    const carriageReturn = (nextValues[0] < start) ? (end - nextValues[1]) : 0;

    this.props.onChange(nextValues.map(value => value + carriageReturn));
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
    const { start, end, step, orientation, reversed, disabled, range, values } = this.props;
    return (
      <Row className="play-slider">
        <Col md={1} className="padded">
          <i className="fa fa-step-backward fa-lg slider-button " onClick={this.stepBackward} />
          <i className={this.getPlayClass()} onClick={this.play} />
          <i className="fa fa-step-forward fa-lg slider-button " onClick={this.stepForward} />
        </Col>
        <Col md={11} className="padded">
          <BootrapSliderWrapper
            value={range ? values : values[0]}
            range={range}
            formatter={this.formatter}
            change={this.onChange}
            min={start}
            max={end}
            step={step}
            orientation={orientation}
            reversed={reversed}
            disabled={disabled ? 'disabled' : 'enabled'}
          />
        </Col>
      </Row>
    );
  }
}

PlaySlider.propTypes = propTypes;
PlaySlider.defaultProps = defaultProps;
