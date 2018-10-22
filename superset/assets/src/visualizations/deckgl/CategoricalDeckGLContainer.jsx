/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import PropTypes from 'prop-types';
import AnimatableDeckGLContainer from './AnimatableDeckGLContainer';
import Legend from '../Legend';
import { getScale } from '../../modules/colors/CategoricalColorNamespace';
import { hexToRGB } from '../../modules/colors';
import { getPlaySliderParams } from '../../modules/time';
import sandboxedEval from '../../modules/sandbox';

function getCategories(fd, data) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const colorFn = getScale(fd.color_scheme).toFunction();
  const categories = {};
  data.forEach((d) => {
    if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
      let color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[d.cat_color] = { color, enabled: true };
    }
  });
  return categories;
}

const propTypes = {
  formData: PropTypes.object.isRequired,
  mapboxApiKey: PropTypes.string.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  getLayer: PropTypes.func.isRequired,
  payload: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  setTooltip: PropTypes.func,
};

export default class CategoricalDeckGLContainer extends React.PureComponent {
  /*
   * A Deck.gl container that handles categories.
   *
   * The container will have an interactive legend, populated from the
   * categories present in the data.
   */
  constructor(props) {
    super(props);

    const fd = props.formData;
    const timeGrain = fd.time_grain_sqla || fd.granularity || 'PT1M';
    const timestamps = props.payload.data.features.map(f => f.__timestamp);
    const { start, end, getStep, values, disabled } = getPlaySliderParams(timestamps, timeGrain);
    const categories = getCategories(fd, props.payload.data.features);
    this.state = { start, end, getStep, values, disabled, categories, viewport: props.viewport };

    this.getLayers = this.getLayers.bind(this);
    this.onValuesChange = this.onValuesChange.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.toggleCategory = this.toggleCategory.bind(this);
    this.showSingleCategory = this.showSingleCategory.bind(this);
  }
  onValuesChange(values) {
    this.setState({
      values: Array.isArray(values)
        ? values
        : [values, values + this.state.getStep(values)],
    });
  }
  onViewportChange(viewport) {
    this.setState({ viewport });
  }
  getLayers(values) {
    const {
      getLayer,
      payload,
      formData: fd,
      onAddFilter,
      setTooltip,
    } = this.props;
    let features = [...payload.data.features];

    // Add colors from categories or fixed color
    features = this.addColor(features, fd);

    // Apply user defined data mutator if defined
    if (fd.js_data_mutator) {
      const jsFnMutator = sandboxedEval(fd.js_data_mutator);
      features = jsFnMutator(features);
    }

    // Filter by time
    if (values[0] === values[1] || values[1] === this.end) {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp <= values[1]);
    } else {
      features = features.filter(d => d.__timestamp >= values[0] && d.__timestamp < values[1]);
    }

    // Show only categories selected in the legend
    if (fd.dimension) {
      features = features.filter(d => this.state.categories[d.cat_color].enabled);
    }

    const filteredPayload = {
      ...payload,
      data: { ...payload.data, features },
    };

    return [getLayer(fd, filteredPayload, onAddFilter, setTooltip)];
  }
  addColor(data, fd) {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const colorFn = getScale(fd.color_scheme).toFunction();
    return data.map((d) => {
      let color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color), c.a * 255);
        return { ...d, color };
      }
      return d;
    });
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
          getStep={this.state.getStep}
          values={this.state.values}
          onValuesChange={this.onValuesChange}
          disabled={this.state.disabled}
          viewport={this.state.viewport}
          onViewportChange={this.onViewportChange}
          mapboxApiAccessToken={this.props.mapboxApiKey}
          mapStyle={this.props.formData.mapbox_style}
          setControlValue={this.props.setControlValue}
        >
          <Legend
            categories={this.state.categories}
            toggleCategory={this.toggleCategory}
            showSingleCategory={this.showSingleCategory}
            position={this.props.formData.legend_position}
          />
        </AnimatableDeckGLContainer>
      </div>
    );
  }
}

CategoricalDeckGLContainer.propTypes = propTypes;
