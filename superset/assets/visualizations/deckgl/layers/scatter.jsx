import React from 'react';
import ReactDOM from 'react-dom';

import DeckGLContainer from '../DeckGLContainer';
import PlaySlider from '../../PlaySlider';

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

class DeckGLScatter extends React.PureComponent {
  constructor(props) {
    super(props);

    const start = Date.parse(props.slice.formData.since + 'Z');
    const end = Date.parse(props.slice.formData.until + 'Z');
    const step = getStep(props.slice.formData.time_grain_sqla);
      
    this.state = {
      start,
      end,
      step,
      values: [start, step != null ? start + step: end],
    };
  }
  filterPayload() {
    const payload = Object.assign({}, this.props.payload);
    payload.data = Object.assign({}, this.props.payload.data);
    const features = payload.data.features;

    const values = this.state.values;
    let valid;
    if (values[0] === values[1] || values[1] === this.props.end) {
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
          disabled={this.state.step == null}
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

module.exports = {
  default: deckScatter,
  getLayer,
};
