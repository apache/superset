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
  FilterState,
  HandlerFunction,
  JsonObject,
  JsonValue,
  QueryFormData,
  SetDataMaskHook,
} from '@superset-ui/core';
import type { Layer } from '@deck.gl/core';
import Legend from './components/Legend';
import { hexToRGB } from './utils/colors';
import sandboxedEval from './utils/sandbox';
import fitViewport, { Viewport } from './utils/fitViewport';
import {
  DeckGLContainerHandle,
  DeckGLContainerStyledWrapper,
} from './DeckGLContainer';
import { GetLayerType } from './factory';
import { ColorBreakpointType, ColorType, Point } from './types';
import { TooltipProps } from './components/Tooltip';
import { COLOR_SCHEME_TYPES, ColorSchemeType } from './utilities/utils';
import { getColorBreakpointsBuckets } from './utils';
import { DEFAULT_DECKGL_COLOR } from './utilities/Shared_DeckGL';

const { getScale } = CategoricalColorNamespace;

function getCategories(fd: QueryFormData, data: JsonObject[]) {
  const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
  const fixedColor = [c.r, c.g, c.b, 255 * c.a];
  const appliedScheme = fd.color_scheme;
  const colorFn = getScale(appliedScheme);
  let categories: Record<any, { color: any; enabled: boolean }> = {};

  const colorSchemeType = fd.color_scheme_type;
  if (colorSchemeType === COLOR_SCHEME_TYPES.color_breakpoints) {
    categories = getColorBreakpointsBuckets(fd.color_breakpoints);
  } else {
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
  }

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
  getLayer: GetLayerType<unknown>;
  getHighlightLayer?: GetLayerType<unknown>;
  payload: JsonObject;
  onAddFilter?: HandlerFunction;
  setControlValue: (control: string, value: JsonValue) => void;
  filterState: FilterState;
  setDataMask: SetDataMaskHook;
  onContextMenu: HandlerFunction;
  emitCrossFilters: boolean;
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

  const addColor = useCallback(
    (
      data: JsonObject[],
      fd: QueryFormData,
      selectedColorScheme: ColorSchemeType,
    ) => {
      const appliedScheme = fd.color_scheme;
      const colorFn = getScale(appliedScheme);
      let color: ColorType;

      switch (selectedColorScheme) {
        case COLOR_SCHEME_TYPES.fixed_color: {
          color = fd.color_picker || { r: 0, g: 0, b: 0, a: 100 };
          const colorArray = [color.r, color.g, color.b, color.a * 255];

          return data.map(d => ({ ...d, color: colorArray }));
        }
        case COLOR_SCHEME_TYPES.categorical_palette: {
          if (!fd.dimension) {
            const fallbackColor = fd.color_picker || {
              r: 0,
              g: 0,
              b: 0,
              a: 100,
            };
            const colorArray = [
              fallbackColor.r,
              fallbackColor.g,
              fallbackColor.b,
              fallbackColor.a * 255,
            ];
            return data.map(d => ({ ...d, color: colorArray }));
          }

          return data.map(d => ({
            ...d,
            color: hexToRGB(colorFn(d.cat_color, fd.slice_id)),
          }));
        }
        case COLOR_SCHEME_TYPES.color_breakpoints: {
          const defaultBreakpointColor = fd.default_breakpoint_color
            ? [
                fd.default_breakpoint_color.r,
                fd.default_breakpoint_color.g,
                fd.default_breakpoint_color.b,
                fd.default_breakpoint_color.a * 255,
              ]
            : [
                DEFAULT_DECKGL_COLOR.r,
                DEFAULT_DECKGL_COLOR.g,
                DEFAULT_DECKGL_COLOR.b,
                DEFAULT_DECKGL_COLOR.a * 255,
              ];
          return data.map(d => {
            const breakpointForPoint: ColorBreakpointType =
              fd.color_breakpoints?.find(
                (breakpoint: ColorBreakpointType) =>
                  d.metric >= breakpoint.minValue &&
                  d.metric <= breakpoint.maxValue,
              );

            if (breakpointForPoint) {
              const pointColor = [
                breakpointForPoint.color.r,
                breakpointForPoint.color.g,
                breakpointForPoint.color.b,
                breakpointForPoint.color.a * 255,
              ];
              return { ...d, color: pointColor };
            }

            return { ...d, color: defaultBreakpointColor };
          });
        }
        default: {
          return [];
        }
      }
    },
    [],
  );

  const getLayers = useCallback(() => {
    const {
      getLayer,
      getHighlightLayer,
      payload,
      formData: fd,
      onAddFilter,
      onContextMenu,
      filterState,
      setDataMask,
      emitCrossFilters,
    } = props;
    let features = payload.data.features ? [...payload.data.features] : [];

    const selectedColorScheme = fd.color_scheme_type;

    // Add colors from categories or fixed color
    features = addColor(features, fd, selectedColorScheme);

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

    const layerProps = {
      formData: fd,
      payload: filteredPayload,
      onAddFilter,
      setTooltip,
      datasource: props.datasource,
      onContextMenu,
      filterState,
      setDataMask,
      emitCrossFilters,
    };

    const layer = getLayer(layerProps) as Layer;

    if (emitCrossFilters && filterState?.value && getHighlightLayer) {
      const highlightLayer = getHighlightLayer(layerProps) as Layer;

      return [layer, highlightLayer];
    }

    return [layer];
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
