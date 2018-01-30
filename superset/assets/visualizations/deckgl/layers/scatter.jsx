import React from 'react';
import ReactDOM from 'react-dom';

import DeckGLContainer from '../DeckGLContainer';
import BootstrapSlider from 'bootstrap-slider/dist/css/bootstrap-slider.min.css';
import ReactBootstrapSlider from 'react-bootstrap-slider';

import { ScatterplotLayer } from 'deck.gl';

import * as common from './common';
import { getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';
import { unitToRadius } from '../../../javascripts/modules/geo';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getStep(time_grain) {
  // grain in microseconds
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  const milliseconds = {
    'min': MIN,
    'hour': HOUR,
    'day': DAY,
    'week': WEEK,
    'month': MONTH,
    'year': YEAR,
  }

  return milliseconds[time_grain];
}

class Slider extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {value: this.props.start, intervalId: null};

    this.onChange = this.onChange.bind(this);
    this.play = this.play.bind(this);
    this.pause = this.pause.bind(this);
    this.step = this.step.bind(this);
    this.getPlayIcon = this.getPlayIcon.bind(this);
  }
  onChange(event) {
    this.setState({value: event.target.value});
    if (this.state.intervalId != null) {
      this.pause();
    }
  }
  formatter(value) {
    return (new Date(value)).toUTCString();
  }
  play() {
    if (this.state.intervalId != null) {
      this.pause();
    } else {
      const id = setInterval(this.step, 500);
      this.setState({intervalId: id});
    }
  }
  pause() {
    clearInterval(this.state.intervalId);
    this.setState({intervalId: null});
  }
  step() {
    let newTimestamp = this.state.value + this.props.step;
    if (newTimestamp > this.props.end) {
      // wrap around
      newTimestamp -= this.props.end - this.props.start;
    }
    this.setState({value: newTimestamp});
  }
  getPlayIcon() {
    if (this.state.intervalId != null) {
      return '⏸️';
    } else {
      return '▶️';
    }
  }
  render() {
    let payload = Object.assign({}, this.props.payload);
    payload.data = Object.assign({}, this.props.payload.data);
    let features = payload.data.features.slice();
    payload.data.features = features.filter(feature => feature.__timestamp === this.state.value);
    const layer = getLayer(this.props.slice.formData, payload, this.props.slice);
    return (
      <div>
        <DeckGLContainer
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={this.props.viewport}
          layers={[layer]}
          mapStyle={this.props.slice.formData.mapbox_style}
          setControlValue={this.props.setControlValue}
        />
        <button type="button" onClick={this.play}>{this.getPlayIcon()}</button>
        <button type="button" onClick={this.step}>⏩</button>
        <ReactBootstrapSlider
          value={this.state.value}
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

function deckScatter(slice, payload, setControlValue) {
  const viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  const start = Date.parse(slice.formData.since + 'Z');
  const end = Date.parse(slice.formData.until + 'Z');
  const step = getStep(slice.formData.time_grain_sqla);
  console.log(slice);
  ReactDOM.render(
    <Slider
      viewport={viewport}
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      start={start}
      end={end}
      step={step}
      />,
    document.getElementById(slice.containerId),
  );
}

function getLayer(formData, payload, slice) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];

  let data = payload.data.features;

  // filter data if a time frame is set
  //if (fd.time_grain_sqla != null && fd.time_frame != null) {
  //  data = data.filter(feature => feature.__timestamp === fd.time_frame);
  //}

  data = data.map((d) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    let color;
    if (fd.dimension) {
      color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
    } else {
      color = fixedColor;
    }
    return {
      ...d,
      radius,
      color,
    };
  });

  if (fd.js_data_mutator) {
    // Applying user defined data mutator if defined
    const jsFnMutator = sandboxedEval(fd.js_data_mutator);
    data = jsFnMutator(data);
  }

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data,
    fp64: true,
    outline: false,
    ...common.commonLayerProps(fd, slice),
  });
}

module.exports = {
  default: deckScatter,
  getLayer: getLayer,
};
