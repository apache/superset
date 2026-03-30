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
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import type { Layer } from '@deck.gl/core';
import {
  Datasource,
  QueryFormData,
  JsonObject,
  HandlerFunction,
  usePrevious,
  SetDataMaskHook,
  DataMask,
  FilterState,
  JsonValue,
  ContextMenuFilters,
} from '@superset-ui/core';

import {
  DeckGLContainerStyledWrapper,
  DeckGLContainerHandle,
} from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import fitViewport, { Viewport } from './utils/fitViewport';
import { Point } from './types';
import { TooltipProps } from './components/Tooltip';
import { getColorBreakpointsBuckets } from './utils';
import Legend from './components/Legend';

type DeckGLComponentProps = {
  datasource: Datasource;
  formData: QueryFormData;
  height: number;
  onAddFilter: HandlerFunction;
  onContextMenu: HandlerFunction;
  payload: JsonObject;
  setControlValue: () => void;
  viewport: Viewport;
  width: number;
  filterState: FilterState;
  setDataMask: SetDataMaskHook;
  emitCrossFilters: boolean;
};

export interface GetLayerTypeParams {
  formData: QueryFormData;
  payload: JsonObject;
  onAddFilter?: HandlerFunction;
  setTooltip: (tooltip: TooltipProps['tooltip']) => void;
  setDataMask?: (dataMask: DataMask) => void;
  onContextMenu?: (
    clientX: number,
    clientY: number,
    filters?: ContextMenuFilters,
  ) => void;
  datasource?: Datasource;
  filterState?: FilterState;
  selected?: JsonObject[];
  onSelect?: (value: JsonValue) => void;
  emitCrossFilters?: boolean;
}

export interface GetLayerType<T> {
  (params: GetLayerTypeParams): T;
}

interface GetPointsType {
  (data: JsonObject[]): Point[];
}

export function createDeckGLComponent(
  getLayer: GetLayerType<unknown>,
  getPoints: GetPointsType,
  getHighlightLayer?: GetLayerType<unknown>,
) {
  // Higher order component
  return memo((props: DeckGLComponentProps) => {
    const containerRef = useRef<DeckGLContainerHandle>();
    const prevFormData = usePrevious(props.formData);
    const prevFilterState = usePrevious(props.filterState);
    const prevPayload = usePrevious(props.payload);
    const getAdjustedViewport = () => {
      const { width, height, formData } = props;
      if (formData.autozoom) {
        return fitViewport(props.viewport, {
          width,
          height,
          points: getPoints(props.payload.data.features),
        }) as Viewport;
      }
      return props.viewport;
    };
    const [categories, setCategories] = useState<JsonObject>(
      getColorBreakpointsBuckets(props.formData.color_breakpoints) || [],
    );

    const [viewport, setViewport] = useState(getAdjustedViewport());

    const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
      const { current } = containerRef;
      if (current) {
        current?.setTooltip(tooltip);
      }
    }, []);

    const computeLayers = useCallback(
      (props: DeckGLComponentProps) => {
        const {
          formData,
          payload,
          onAddFilter,
          filterState,
          setDataMask,
          onContextMenu,
          emitCrossFilters,
        } = props;

        const layerProps = {
          formData,
          payload,
          onAddFilter,
          setTooltip,
          setDataMask,
          onContextMenu,
          filterState,
          emitCrossFilters,
        };

        const layer = getLayer(layerProps) as Layer;

        if (emitCrossFilters && filterState?.value && getHighlightLayer) {
          const highlightLayer = getHighlightLayer(layerProps) as Layer;

          return [layer, highlightLayer];
        }

        return [layer];
      },
      [setTooltip],
    );

    useEffect(() => {
      const categories = getColorBreakpointsBuckets(
        props.formData.color_breakpoints,
      );

      setCategories(categories);
    }, [props]);

    const [layers, setLayers] = useState(computeLayers(props));

    useEffect(() => {
      // Only recompute the layer if anything BUT the viewport has changed
      const prevFdNoVP = {
        ...prevFormData,
        ...prevFilterState,
        viewport: null,
      };
      const currFdNoVP = {
        ...props.formData,
        ...props.filterState,
        viewport: null,
      };
      if (!isEqual(prevFdNoVP, currFdNoVP) || prevPayload !== props.payload) {
        setLayers(computeLayers(props));
      }
    }, [computeLayers, prevFormData, prevFilterState, prevPayload, props]);

    const { formData, payload, setControlValue, height, width } = props;

    return (
      <div style={{ position: 'relative' }}>
        <DeckGLContainerStyledWrapper
          ref={containerRef}
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          layers={layers}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
          width={width}
          height={height}
          onViewportChange={setViewport}
        />
        <Legend
          forceCategorical
          categories={categories}
          format={props.formData.legend_format}
          position={props.formData.legend_position}
        />
      </div>
    );
  });
}

export function createCategoricalDeckGLComponent(
  getLayer: GetLayerType<Layer>,
  getPoints: GetPointsType,
  getHighlightLayer?: GetLayerType<Layer>,
) {
  return function Component(props: DeckGLComponentProps) {
    const {
      datasource,
      formData,
      height,
      payload,
      setControlValue,
      viewport,
      width,
      setDataMask,
      filterState,
      onContextMenu,
      emitCrossFilters,
    } = props;

    return (
      <CategoricalDeckGLContainer
        datasource={datasource}
        formData={formData}
        mapboxApiKey={payload.data.mapboxApiKey}
        setControlValue={setControlValue}
        viewport={viewport}
        getLayer={getLayer}
        getHighlightLayer={getHighlightLayer}
        payload={payload}
        getPoints={getPoints}
        width={width}
        height={height}
        setDataMask={setDataMask}
        onContextMenu={onContextMenu}
        filterState={filterState}
        emitCrossFilters={emitCrossFilters}
      />
    );
  };
}
