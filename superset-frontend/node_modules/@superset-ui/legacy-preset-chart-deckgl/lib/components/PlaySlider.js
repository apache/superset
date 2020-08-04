"use strict";

exports.__esModule = true;
exports.default = void 0;

var _react = _interopRequireDefault(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

var _mousetrap = _interopRequireDefault(require("mousetrap"));

var _translation = require("@superset-ui/translation");

var _BootstrapSliderWrapper = _interopRequireDefault(require("./BootstrapSliderWrapper"));

require("./PlaySlider.css");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-disable react/jsx-sort-default-props */

/* eslint-disable react/sort-prop-types */

/* eslint-disable react/jsx-handler-names */

/* eslint-disable jsx-a11y/click-events-have-key-events */

/* eslint-disable jsx-a11y/no-static-element-interactions */

/* eslint-disable no-negated-condition */

/* eslint-disable react/forbid-prop-types */

/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
const propTypes = {
  start: _propTypes.default.number.isRequired,
  step: _propTypes.default.number.isRequired,
  end: _propTypes.default.number.isRequired,
  values: _propTypes.default.array.isRequired,
  onChange: _propTypes.default.func,
  loopDuration: _propTypes.default.number,
  maxFrames: _propTypes.default.number,
  orientation: _propTypes.default.oneOf(['horizontal', 'vertical']),
  reversed: _propTypes.default.bool,
  disabled: _propTypes.default.bool,
  range: _propTypes.default.bool
};
const defaultProps = {
  onChange: () => {},
  loopDuration: 15000,
  maxFrames: 100,
  orientation: 'horizontal',
  reversed: false,
  disabled: false,
  range: true
};

class PlaySlider extends _react.default.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      intervalId: null
    };
    const range = props.end - props.start;
    const frames = Math.min(props.maxFrames, range / props.step);
    const width = range / frames;
    this.intervalMilliseconds = props.loopDuration / frames;
    this.increment = width < props.step ? props.step : width - width % props.step;
    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.stepBackward = this.stepBackward.bind(this);
    this.stepForward = this.stepForward.bind(this);
    this.getPlayClass = this.getPlayClass.bind(this);
    this.formatter = this.formatter.bind(this);
  }

  componentDidMount() {
    _mousetrap.default.bind(['space'], this.play);
  }

  componentWillUnmount() {
    _mousetrap.default.unbind(['space']);
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
      this.setState({
        intervalId: id
      });
    }
  }

  pause() {
    clearInterval(this.state.intervalId);
    this.setState({
      intervalId: null
    });
  }

  stepForward() {
    const {
      start,
      end,
      step,
      values,
      disabled
    } = this.props;

    if (disabled) {
      return;
    }

    const currentValues = Array.isArray(values) ? values : [values, values + step];
    const nextValues = currentValues.map(value => value + this.increment);
    const carriageReturn = nextValues[1] > end ? nextValues[0] - start : 0;
    this.props.onChange(nextValues.map(value => value - carriageReturn));
  }

  stepBackward() {
    const {
      start,
      end,
      step,
      values,
      disabled
    } = this.props;

    if (disabled) {
      return;
    }

    const currentValues = Array.isArray(values) ? values : [values, values + step];
    const nextValues = currentValues.map(value => value - this.increment);
    const carriageReturn = nextValues[0] < start ? end - nextValues[1] : 0;
    this.props.onChange(nextValues.map(value => value + carriageReturn));
  }

  formatter(values) {
    if (this.props.disabled) {
      return (0, _translation.t)('Data has no time steps');
    }

    let parts = values;

    if (!Array.isArray(values)) {
      parts = [values];
    } else if (values[0] === values[1]) {
      parts = [values[0]];
    }

    return parts.map(value => new Date(value).toUTCString()).join(' : ');
  }

  render() {
    const {
      start,
      end,
      step,
      orientation,
      reversed,
      disabled,
      range,
      values
    } = this.props;
    return _react.default.createElement("div", {
      className: "play-slider"
    }, _react.default.createElement("div", {
      className: "play-slider-controls padded"
    }, _react.default.createElement("i", {
      className: "fa fa-step-backward fa-lg slider-button ",
      onClick: this.stepBackward
    }), _react.default.createElement("i", {
      className: this.getPlayClass(),
      onClick: this.play
    }), _react.default.createElement("i", {
      className: "fa fa-step-forward fa-lg slider-button ",
      onClick: this.stepForward
    })), _react.default.createElement("div", {
      className: "play-slider-scrobbler padded"
    }, _react.default.createElement(_BootstrapSliderWrapper.default, {
      value: range ? values : values[0],
      range: range,
      formatter: this.formatter,
      change: this.onChange,
      min: start,
      max: end,
      step: step,
      orientation: orientation,
      reversed: reversed,
      disabled: disabled ? 'disabled' : 'enabled'
    })));
  }

}

exports.default = PlaySlider;
PlaySlider.propTypes = propTypes;
PlaySlider.defaultProps = defaultProps;