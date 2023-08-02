/* eslint-disable react/sort-prop-types */
/* eslint-disable react/require-default-props */
/* eslint-disable react/no-unused-prop-types */
/* eslint-disable react/no-access-state-in-setstate */
/* eslint-disable camelcase */
/* eslint-disable no-prototype-builtins */
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
import {
  CategoricalColorNamespace,
  Datasource,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
} from '@superset-ui/core';
import { Layer } from 'deck.gl/typed';
import Legend from './components/Legend';
import { hexToRGB } from './utils/colors';
import sandboxedEval from './utils/sandbox';
// eslint-disable-next-line import/extensions
import fitViewport, { Viewport } from './utils/fitViewport';
import {
  DeckGLContainer,
  DeckGLContainerStyledWrapper,
} from './DeckGLContainer';
import { Point } from './types';
import { getLayerType } from './factory';
import { TooltipProps } from './components/Tooltip';

const { getScale } = CategoricalColorNamespace;

function getCategories(fd: QueryFormData, data: JsonObject[]) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const colorFn = getScale(fd.color_scheme);
  const categories = {};
  data.forEach(d => {
    if (d.cat_color != null && !categories.hasOwnProperty(d.cat_color)) {
      let color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color, fd.sliceId), c.a * 255);
      } else {
        color = fixedColor;
      }
      categories[d.cat_color] = { color, enabled: true };
    }
  });

  return categories;
}

export type CategoricalDeckGLContainerProps = {
  datasource: Datasource;
  formData: QueryFormData;
  mapboxApiKey: string;
  getPoints: (data: JsonObject[]) => Point[];
  height: number;
  width: number;
  viewport: Viewport;
  getLayer: getLayerType<unknown>;
  payload: JsonObject;
  onAddFilter?: HandlerFunction;
  setControlValue: (control: string, value: JsonValue) => void;
};

export type CategoricalDeckGLContainerState = {
  formData?: QueryFormData;
  viewport: Viewport;
  categories: JsonObject;
};

export default class CategoricalDeckGLContainer extends React.PureComponent<
  CategoricalDeckGLContainerProps,
  CategoricalDeckGLContainerState
> {
  containerRef = React.createRef<DeckGLContainer>();

  /*
   * A Deck.gl container that handles categories.
   *
   * The container will have an interactive legend, populated from the
   * categories present in the data.
   */
  constructor(props: CategoricalDeckGLContainerProps) {
    super(props);
    this.state = this.getStateFromProps(props);

    this.getLayers = this.getLayers.bind(this);
    this.toggleCategory = this.toggleCategory.bind(this);
    this.showSingleCategory = this.showSingleCategory.bind(this);
  }

  UNSAFE_componentWillReceiveProps(nextProps: CategoricalDeckGLContainerProps) {
    if (nextProps.payload.form_data !== this.state.formData) {
      this.setState({ ...this.getStateFromProps(nextProps) });
    }
  }

  // eslint-disable-next-line class-methods-use-this
  getStateFromProps(
    props: CategoricalDeckGLContainerProps,
    state?: CategoricalDeckGLContainerState,
  ) {
    const features = props.payload.data.features || [];
    const categories = getCategories(props.formData, features);

    // the state is computed only from the payload; if it hasn't changed, do
    // not recompute state since this would reset selections and/or the play
    // slider position due to changes in form controls
    if (state && props.payload.form_data === state.formData) {
      return { ...state, categories };
    }

    const { width, height, formData } = props;
    let { viewport } = props;
    if (formData.autozoom) {
      viewport = fitViewport(viewport, {
        width,
        height,
        points: props.getPoints(features),
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }

    return {
      viewport,
      selected: [],
      lastClick: 0,
      formData: props.payload.form_data,
      categories,
    };
  }

  getLayers() {
    const { getLayer, payload, formData: fd, onAddFilter } = this.props;
    let features = payload.data.features ? [...payload.data.features] : [];

    // Add colors from categories or fixed color
    features = this.addColor(features, fd);

    // Apply user defined data mutator if defined
    if (fd.js_data_mutator) {
      const jsFnMutator = sandboxedEval(fd.js_data_mutator);
      features = jsFnMutator(features);
    }

    // Show only categories selected in the legend
    const cats = this.state.categories;
    if (fd.dimension) {
      features = features.filter(d => cats[d.cat_color]?.enabled);
    }

    const filteredPayload = {
      ...payload,
      data: { ...payload.data, features },
    };

    return [
      getLayer(
        fd,
        filteredPayload,
        onAddFilter,
        this.setTooltip,
        this.props.datasource,
      ) as Layer,
    ];
  }

  // eslint-disable-next-line class-methods-use-this
  addColor(data: JsonObject[], fd: QueryFormData) {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const colorFn = getScale(fd.color_scheme);

    return data.map(d => {
      let color;
      if (fd.dimension) {
        color = hexToRGB(colorFn(d.cat_color, fd.sliceId), c.a * 255);

        return { ...d, color };
      }

      return d;
    });
  }

  toggleCategory(category: string) {
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
      Object.values(categories).forEach(v => {
        v.enabled = true;
      });
    }
    this.setState({ categories });
  }

  showSingleCategory(category: string) {
    const categories = { ...this.state.categories };
    /* eslint-disable no-param-reassign */
    Object.values(categories).forEach(v => {
      v.enabled = false;
    });
    categories[category].enabled = true;
    this.setState({ categories });
  }

  setTooltip = (tooltip: TooltipProps['tooltip']) => {
    const { current } = this.containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  };

  render() {
    return (
      <div style={{ position: 'relative' }}>
        <DeckGLContainerStyledWrapper
          ref={this.containerRef}
          viewport={this.state.viewport}
          layers={this.getLayers()}
          setControlValue={this.props.setControlValue}
          mapStyle={this.props.formData.mapbox_style}
          mapboxApiAccessToken={this.props.mapboxApiKey}
          width={this.props.width}
          height={this.props.height}
        />
        <Legend
          forceCategorical
          categories={this.state.categories}
          format={this.props.formData.legend_format}
          position={this.props.formData.legend_position}
          showSingleCategory={this.showSingleCategory}
          toggleCategory={this.toggleCategory}
        />
      </div>
    );
  }
}
