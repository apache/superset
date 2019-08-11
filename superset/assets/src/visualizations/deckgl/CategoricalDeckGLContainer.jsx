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
/* eslint no-underscore-dangle: ["error", { "allow": ["", "__timestamp"] }] */

import React from 'react';
import PropTypes from 'prop-types';
import { CategoricalColorNamespace } from '@superset-ui/color';
import AnimatableDeckGLContainer from './AnimatableDeckGLContainer';
import Legend from '../Legend';
import { hexToRGB } from '../../modules/colors';
import { getPlaySliderParams } from '../../modules/time';
import sandboxedEval from '../../modules/sandbox';
import { fitViewport } from './layers/common';

const { getScale } = CategoricalColorNamespace;

function getCategories(fd, data) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const colorFn = getScale(fd.color_scheme);
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
  getPoints: PropTypes.func.isRequired,
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
    this.state = this.getStateFromProps(props);

    this.getLayers = this.getLayers.bind(this);
    this.onValuesChange = this.onValuesChange.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.toggleCategory = this.toggleCategory.bind(this);
    this.showSingleCategory = this.showSingleCategory.bind(this);
  }
  componentWillReceiveProps(nextProps) {
    if (nextProps.payload.form_data !== this.state.formData) {
      this.setState({ ...this.getStateFromProps(nextProps) });
    }
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
  getStateFromProps(props, state) {
    const features = props.payload.data.features || [];
    const timestamps = features.map(f => f.__timestamp);
    const categories = getCategories(props.formData, features);

    // the state is computed only from the payload; if it hasn't changed, do
    // not recompute state since this would reset selections and/or the play
    // slider position due to changes in form controls
    if (state && props.payload.form_data === state.formData) {
      return { ...state, categories };
    }

    // the granularity has to be read from the payload form_data, not the
    // props formData which comes from the instantaneous controls state
    const granularity = (
      props.payload.form_data.time_grain_sqla ||
      props.payload.form_data.granularity ||
      'P1D'
    );

    const {
      start,
      end,
      getStep,
      values,
      disabled,
    } = getPlaySliderParams(timestamps, granularity);

    const viewport = props.formData.autozoom
      ? fitViewport(props.viewport, props.getPoints(features))
      : props.viewport;

    return {
      start,
      end,
      getStep,
      values,
      disabled,
      viewport,
      selected: [],
      lastClick: 0,
      formData: props.payload.form_data,
      categories,
    };
  }
  getLayers(values) {
    const {
      getLayer,
      payload,
      formData: fd,
      onAddFilter,
      setTooltip,
    } = this.props;
    let features = payload.data.features
      ? [...payload.data.features]
      : [];

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
    const cats = this.state.categories;
    if (fd.dimension) {
      features = features.filter(d => cats[d.cat_color] && cats[d.cat_color].enabled);
    }

    const filteredPayload = {
      ...payload,
      data: { ...payload.data, features },
    };

    return [getLayer(fd, filteredPayload, onAddFilter, setTooltip)];
  }
  addColor(data, fd) {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const colorFn = getScale(fd.color_scheme);
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
    const categories = {
      ...this.state.categories,
      [category]: {
        ...categoryState,
        enabled: !categoryState.enabled,
      },
    };

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
            format={this.props.formData.legend_format}
          />
        </AnimatableDeckGLContainer>
      </div>
    );
  }
}

CategoricalDeckGLContainer.propTypes = propTypes;
