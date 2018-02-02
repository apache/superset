/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { ScatterplotLayer } from 'deck.gl';

import DeckGLContainer from '../DeckGLContainer';
import PlaySlider from '../../PlaySlider';

import * as common from './common';
import { getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';
import { unitToRadius } from '../../../javascripts/modules/geo';
import sandboxedEval from '../../../javascripts/modules/sandbox';

function getStep(timeGrain) {
  // grain in microseconds
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  const milliseconds = {
    'Time Column': MINUTE,
    min: MINUTE,
    hour: HOUR,
    day: DAY,
    week: WEEK,
    month: MONTH,
    year: YEAR,
  };

  return milliseconds[timeGrain];
}

function getLayer(formData, payload, slice) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];

  let data = payload.data.features.map((d) => {
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

const propTypes = {
  viewport: PropTypes.object.isRequired,
  slice: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
};

class DeckGLScatter extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = this.getStateFromProps(props);
  }
  componentWillReceiveProps(nextProps) {
    const nextState = this.getStateFromProps(nextProps);
    if (
      nextState.start !== this.state.start ||
      nextState.end !== this.state.end ||
      nextState.step !== this.state.step
    ) {
      this.setState(nextState);
    }
  }
  getStateFromProps(props) {
    const fd = props.slice.formData;
    const timeGrain = fd.time_grain_sqla || fd.granularity;
    const step = timeGrain ? getStep(timeGrain) : getStep('min');

    // find start and end based on the data
    let start = props.payload.data.features[0].__timestamp;
    let end = start;
    props.payload.data.features.forEach((feature) => {
      if (feature.__timestamp < start) {
        start = feature.__timestamp;
      }
      if (feature.__timestamp > end) {
        end = feature.__timestamp;
      }
    });
    // truncate start and end to the closest step
    start -= start % step;
    end -= end % step - step;

    const values = timeGrain != null ? [start, start + step] : [start, end];
    return {
      start,
      end,
      step,
      values,
    };
  }
  filterPayload() {
    const payload = Object.assign({}, this.props.payload);
    payload.data = Object.assign({}, this.props.payload.data);
    const features = payload.data.features;

    const values = this.state.values;
    let valid;
    if (values[0] === values[1] || values[1] === this.state.end) {
      valid = t => t.__timestamp >= values[0] && t.__timestamp <= values[1];
    } else {
      valid = t => t.__timestamp >= values[0] && t.__timestamp < values[1];
    }
    payload.data.features = features.filter(valid);

    return payload;
  }
  render() {
    const payload = this.filterPayload();
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
        <PlaySlider
          start={this.state.start}
          end={this.state.end}
          step={this.state.step}
          values={this.state.values}
          onChange={newState => this.setState(newState)}
        />
      </div>
    );
  }
}

DeckGLScatter.propTypes = propTypes;

function deckScatter(slice, payload, setControlValue) {
  const viewport = {
    ...slice.formData.viewport,
    width: slice.width(),
    height: slice.height(),
  };
  ReactDOM.render(
    <DeckGLScatter
      viewport={viewport}
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckScatter,
  getLayer,
};
