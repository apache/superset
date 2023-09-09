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
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { isEqual } from 'lodash';
import { Layer } from 'deck.gl/typed';
import {
  Datasource,
  QueryFormData,
  JsonObject,
  HandlerFunction,
  usePrevious,
} from '@superset-ui/core';

import {
  DeckGLContainerStyledWrapper,
  DeckGLContainerHandle,
} from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import fitViewport, { Viewport } from './utils/fitViewport';
import { Point } from './types';
import { TooltipProps } from './components/Tooltip';

type deckGLComponentProps = {
  datasource: Datasource;
  formData: QueryFormData;
  height: number;
  onAddFilter: HandlerFunction;
  payload: JsonObject;
  setControlValue: () => void;
  viewport: Viewport;
  width: number;
};
export interface getLayerType<T> {
  (
    formData: QueryFormData,
    payload: JsonObject,
    onAddFilter: HandlerFunction | undefined,
    setTooltip: (tooltip: TooltipProps['tooltip']) => void,
    datasource?: Datasource,
  ): T;
}
interface getPointsType {
  (data: JsonObject[]): Point[];
}

export function createDeckGLComponent(
  getLayer: getLayerType<unknown>,
  getPoints: getPointsType,
) {
  // Higher order component
  return memo((props: deckGLComponentProps) => {
    const containerRef = useRef<DeckGLContainerHandle>();
    const prevFormData = usePrevious(props.formData);
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

    const [viewport, setViewport] = useState(getAdjustedViewport());

    const setTooltip = useCallback((tooltip: TooltipProps['tooltip']) => {
      const { current } = containerRef;
      if (current) {
        current?.setTooltip(tooltip);
      }
    }, []);

    const computeLayer = useCallback(
      (props: deckGLComponentProps) => {
        const { formData, payload, onAddFilter } = props;

        return getLayer(formData, payload, onAddFilter, setTooltip) as Layer;
      },
      [setTooltip],
    );

    const [layer, setLayer] = useState(computeLayer(props));

    useEffect(() => {
      // Only recompute the layer if anything BUT the viewport has changed
      const prevFdNoVP = { ...prevFormData, viewport: null };
      const currFdNoVP = { ...props.formData, viewport: null };
      if (!isEqual(prevFdNoVP, currFdNoVP) || prevPayload !== props.payload) {
        setLayer(computeLayer(props));
      }
    }, [computeLayer, prevFormData, prevPayload, props]);

    const { formData, payload, setControlValue, height, width } = props;

    return (
      <DeckGLContainerStyledWrapper
        ref={containerRef}
        mapboxApiAccessToken={payload.data.mapboxApiKey}
        viewport={viewport}
        layers={[layer]}
        mapStyle={formData.mapbox_style}
        setControlValue={setControlValue}
        width={width}
        height={height}
        onViewportChange={setViewport}
      />
    );
  });
}

export function createCategoricalDeckGLComponent(
  getLayer: getLayerType<Layer>,
  getPoints: getPointsType,
) {
  return function Component(props: deckGLComponentProps) {
    const {
      datasource,
      formData,
      height,
      payload,
      setControlValue,
      viewport,
      width,
    } = props;

    return (
      <CategoricalDeckGLContainer
        datasource={datasource}
        formData={formData}
        mapboxApiKey={payload.data.mapboxApiKey}
        setControlValue={setControlValue}
        viewport={viewport}
        getLayer={getLayer}
        payload={payload}
        getPoints={getPoints}
        width={width}
        height={height}
      />
    );
  };
}
