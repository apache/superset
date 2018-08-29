/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import PropTypes from 'prop-types';

import AnimatableDeckGLContainer from './AnimatableDeckGLContainer';
import Legend from '../Legend';

import { getColorFromScheme, hexToRGB } from '../../modules/colors';
import { getPlaySliderParams } from '../../modules/time';
import sandboxedEval from '../../modules/sandbox';

function getCategories(fd, data) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const categories = {};
  data.forEach((d) => {
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

const propTypes = {
  slice: PropTypes.object.isRequired,
  mapboxApiKey: PropTypes.string.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  getLayer: PropTypes.func.isRequired,
  payload: PropTypes.object.isRequired,
};

export default class CategoricalDeckGLContainer extends React.PureComponent {
  /*
   * A Deck.gl container that handles categories.
   *
   * The container will have an interactive legend, populated from the
   * categories present in the data.
   */

  /* eslint-disable-next-line react/sort-comp */
  static getDerivedStateFromProps(nextProps) {
    const fd = nextProps.slice.formData;

    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
    const timestamps = nextProps.payload.data.features.map(f => f.__timestamp);
    const { start, end, step, values, disabled } = getPlaySliderParams(timestamps, timeGrain);
    const categories = getCategories(fd, nextProps.payload.data.features);

    return { start, end, step, values, disabled, categories };
  }
  constructor(props) {
    super(props);
    this.state = CategoricalDeckGLContainer.getDerivedStateFromProps(props);

    this.getLayers = this.getLayers.bind(this);
    this.toggleCategory = this.toggleCategory.bind(this);
    this.showSingleCategory = this.showSingleCategory.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    this.setState(CategoricalDeckGLContainer.getDerivedStateFromProps(nextProps, this.state));
  }
  addColor(data, fd) {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    return data.map((d) => {
      let color;
      if (fd.dimension) {
        color = hexToRGB(getColorFromScheme(d.cat_color, fd.color_scheme), c.a * 255);
        return { ...d, color };
      }
      return d;
    });
  }
  getLayers(values) {
    const { getLayer, payload, slice } = this.props;
    const fd = slice.formData;
    let data = [...payload.data.features];

    // Add colors from categories or fixed color
    data = this.addColor(data, fd);

    // Apply user defined data mutator if defined
    if (fd.js_data_mutator) {
      const jsFnMutator = sandboxedEval(fd.js_data_mutator);
      data = jsFnMutator(data);
    }

    // Filter by time
    if (values[0] === values[1] || values[1] === this.end) {
      data = data.filter(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      data = data.filter(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    // Show only categories selected in the legend
    if (fd.dimension) {
      data = data.filter(d => this.state.categories[d.cat_color].enabled);
    }

    payload.data.features = data;
    return [getLayer(fd, payload, slice)];
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
      <div style={{ position: 'relative' }}>
        <AnimatableDeckGLContainer
          getLayers={this.getLayers}
          start={this.state.start}
          end={this.state.end}
          step={this.state.step}
          values={this.state.values}
          disabled={this.state.disabled}
          viewport={this.props.viewport}
          mapboxApiAccessToken={this.props.mapboxApiKey}
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

CategoricalDeckGLContainer.propTypes = propTypes;
