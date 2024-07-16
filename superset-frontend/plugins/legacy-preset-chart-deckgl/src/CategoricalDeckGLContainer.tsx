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

import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  DeckGLContainerHandle,
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
        color = hexToRGB(
          colorFn(d.cat_color, fd.sliceId, fd.color_scheme),
          c.a * 255,
        );
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

const CategoricalDeckGLContainer = (props: CategoricalDeckGLContainerProps) => {
  const containerRef = useRef<DeckGLContainerHandle>(null);

  const getAdjustedViewport = useCallback(() => {
    let viewport = { ...props.viewport };
    if (props.formData.autozoom) {
      viewport = fitViewport(viewport, {
        width: props.width,
        height: props.height,
        points: props.getPoints(props.payload.data.features || []),
      });
    }
    if (viewport.zoom < 0) {
      viewport.zoom = 0;
    }
    return viewport;
  }, [props]);

  const [categories, setCategories] = useState<JsonObject>(
    getCategories(props.formData, props.payload.data.features || []),
  );
  const [stateFormData, setStateFormData] = useState<JsonObject>(
    props.payload.form_data,
  );
  const [viewport, setViewport] = useState(getAdjustedViewport());

  useEffect(() => {
    if (props.payload.form_data !== stateFormData) {
      const features = props.payload.data.features || [];
      const categories = getCategories(props.formData, features);

      setViewport(getAdjustedViewport());
      setStateFormData(props.payload.form_data);
      setCategories(categories);
    }
  }, [getAdjustedViewport, props, stateFormData]);

  const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
    const { current } = containerRef;
    if (current) {
      current.setTooltip(tooltip);
    }
  }, []);

  const addColor = useCallback((data: JsonObject[], fd: QueryFormData) => {
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const colorFn = getScale(fd.color_scheme);

    return data.map(d => {
      let color;
      if (fd.dimension) {
        color = hexToRGB(
          colorFn(d.cat_color, fd.sliceId, fd.color_scheme),
          c.a * 255,
        );

        return { ...d, color };
      }

      return d;
    });
  }, []);

  const getLayers = useCallback(() => {
    const { getLayer, payload, formData: fd, onAddFilter } = props;
    let features = payload.data.features ? [...payload.data.features] : [];

    // Add colors from categories or fixed color
    features = addColor(features, fd);

    // Apply user defined data mutator if defined
    if (fd.js_data_mutator) {
      const jsFnMutator = sandboxedEval(fd.js_data_mutator);
      features = jsFnMutator(features);
    }

    // Show only categories selected in the legend
    if (fd.dimension) {
      features = features.filter(d => categories[d.cat_color]?.enabled);
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
        setTooltip,
        props.datasource,
      ) as Layer,
    ];
  }, [addColor, categories, props, setTooltip]);

  const toggleCategory = useCallback(
    (category: string) => {
      const categoryState = categories[category];
      const categoriesExtended = {
        ...categories,
        [category]: {
          ...categoryState,
          enabled: !categoryState.enabled,
        },
      };

      // if all categories are disabled, enable all -- similar to nvd3
      if (Object.values(categoriesExtended).every(v => !v.enabled)) {
        /* eslint-disable no-param-reassign */
        Object.values(categoriesExtended).forEach(v => {
          v.enabled = true;
        });
      }
      setCategories(categoriesExtended);
    },
    [categories],
  );

  const showSingleCategory = useCallback(
    (category: string) => {
      const modifiedCategories = { ...categories };
      Object.values(modifiedCategories).forEach(v => {
        v.enabled = false;
      });
      modifiedCategories[category].enabled = true;
      setCategories(modifiedCategories);
    },
    [categories],
  );

  return (
    <div style={{ position: 'relative' }}>
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        viewport={viewport}
        layers={getLayers()}
        setControlValue={props.setControlValue}
        mapStyle={props.formData.mapbox_style}
        mapboxApiAccessToken={props.mapboxApiKey}
        width={props.width}
        height={props.height}
      />
      <Legend
        forceCategorical
        categories={categories}
        format={props.formData.legend_format}
        position={props.formData.legend_position}
        showSingleCategory={showSingleCategory}
        toggleCategory={toggleCategory}
      />
    </div>
  );
};

export default memo(CategoricalDeckGLContainer);
