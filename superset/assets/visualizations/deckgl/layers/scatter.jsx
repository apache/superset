/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import parseIsoDuration from 'parse-iso-duration';
import { ScatterplotLayer } from 'deck.gl';

import AnimatableDeckGLContainer from '../AnimatableDeckGLContainer';
import Legend from '../../Legend';

import * as common from './common';
import { getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';
import { unitToRadius } from '../../../javascripts/modules/geo';
import sandboxedEval from '../../../javascripts/modules/sandbox';


function getPoints(data) {
  return data.map(d => d.position);
}

function getCategories(formData, payload) {
  const fd = formData;
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const categories = {};

  payload.data.features.forEach((d) => {
    if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
      let color;
      if (fd.dimension) {
        color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[d.cat_color] = { color, enabled: true };
    }
  });
  return categories;
}

function getLayer(formData, payload, slice, filters) {
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

  if (filters != null) {
    filters.forEach((f) => {
      data = data.filter(f);
    });
  }

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}`,
    data,
    fp64: true,
    radiusMinPixels: fd.min_radius || null,
    radiusMaxPixels: fd.max_radius || null,
    outline: false,
    ...common.commonLayerProps(fd, slice),
  });
}

const propTypes = {
  slice: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
};

class DeckGLScatter extends React.PureComponent {
  /* eslint-disable no-unused-vars */
  static getDerivedStateFromProps(nextProps, prevState) {
    const fd = nextProps.slice.formData;
    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';

    // find start and end based on the data
    const timestamps = nextProps.payload.data.features.map(f => f.__timestamp);
    let start = Math.min(...timestamps);
    let end = Math.max(...timestamps);

    // lock start and end to the closest steps
    const step = parseIsoDuration(timeGrain);
    start -= start % step;
    end += step - end % step;

    const values = timeGrain != null ? [start, start + step] : [start, end];
    const disabled = timestamps.every(timestamp => timestamp === null);

    const categories = getCategories(fd, nextProps.payload);

    return { start, end, step, values, disabled, categories };
  }
  constructor(props) {
    super(props);
    this.state = DeckGLScatter.getDerivedStateFromProps(props);

    this.getLayers = this.getLayers.bind(this);
    this.toggleCategory = this.toggleCategory.bind(this);
    this.showSingleCategory = this.showSingleCategory.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState(DeckGLScatter.getDerivedStateFromProps(nextProps, this.state));
  }
  getLayers(values) {
    const filters = [];

    // time filter
    if (values[0] === values[1] || values[1] === this.end) {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      filters.push(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    // legend filter
    if (this.props.slice.formData.dimension) {
      filters.push(d => this.state.categories[d.cat_color].enabled);
    }

    const layer = getLayer(
      this.props.slice.formData,
      this.props.payload,
      this.props.slice,
      filters);

    return [layer];
  }
  toggleCategory(category) {
    const categoryState = this.state.categories[category];
    categoryState.enabled = !categoryState.enabled;
    const categories = { ...this.state.categories, [category]: categoryState };

    // if all categories are disabled, enable all -- similar to nvd3
    if (Object.values(categories).every(v => !v.enabled)) {
      /* eslint-disable no-param-reassign */
      Object.values(categories).forEach((v) => { v.enabled = true; });
    }

    this.setState({ categories });
  }
  showSingleCategory(category) {
    const categories = { ...this.state.categories };
    /* eslint-disable no-param-reassign */
    Object.values(categories).forEach((v) => { v.enabled = false; });
    categories[category].enabled = true;
    this.setState({ categories });
  }
  render() {
    return (
      <div>
        <AnimatableDeckGLContainer
          getLayers={this.getLayers}
          start={this.state.start}
          end={this.state.end}
          step={this.state.step}
          values={this.state.values}
          disabled={this.state.disabled}
          viewport={this.props.viewport}
          mapboxApiAccessToken={this.props.payload.data.mapboxApiKey}
          mapStyle={this.props.slice.formData.mapbox_style}
          setControlValue={this.props.setControlValue}
        >
          <Legend
            categories={this.state.categories}
            toggleCategory={this.toggleCategory}
            showSingleCategory={this.showSingleCategory}
            position={this.props.slice.formData.legend_position}
          />
        </AnimatableDeckGLContainer>
      </div>
    );
  }
}

DeckGLScatter.propTypes = propTypes;

function deckScatter(slice, payload, setControlValue) {
  const layer = getLayer(slice.formData, payload, slice);
  const fd = slice.formData;
  const width = slice.width();
  const height = slice.height();
  let viewport = {
    ...fd.viewport,
    width,
    height,
  };

  if (fd.autozoom) {
    viewport = common.fitViewport(viewport, getPoints(payload.data.features));
  }

  ReactDOM.render(
    <DeckGLScatter
      slice={slice}
      payload={payload}
      setControlValue={setControlValue}
      viewport={viewport}
    />,
    document.getElementById(slice.containerId),
  );
}

module.exports = {
  default: deckScatter,
  getLayer,
};
