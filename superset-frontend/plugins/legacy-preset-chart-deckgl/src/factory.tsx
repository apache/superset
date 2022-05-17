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
import React from 'react';
import { isEqual } from 'lodash';
import { Datasource, QueryFormData, JsonObject } from '@superset-ui/core';

import {
  DeckGLContainerStyledWrapper,
  DeckGLContainer,
} from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import fitViewport, { Viewport } from './utils/fitViewport';
import { Point } from './types';

type deckGLComponentProps = {
  datasource: Datasource;
  formData: QueryFormData;
  height: number;
  onAddFilter: () => void;
  payload: JsonObject;
  setControlValue: () => void;
  viewport: Viewport;
  width: number;
};
interface getLayerType<T> {
  (
    formData: QueryFormData,
    payload: JsonObject,
    onAddFilter: () => void,
    setTooltip: (tooltip: string) => void,
  ): T;
}
interface getPointsType<T> {
  (point: number[]): T;
}
type deckGLComponentState = {
  viewport: Viewport;
  layer: unknown;
};

export function createDeckGLComponent(
  getLayer: getLayerType<unknown>,
  getPoints: getPointsType<Point[]>,
): React.ComponentClass<deckGLComponentProps> {
  // Higher order component
  class Component extends React.PureComponent<
    deckGLComponentProps,
    deckGLComponentState
  > {
    containerRef: React.RefObject<DeckGLContainer> = React.createRef();

    constructor(props: deckGLComponentProps) {
      super(props);

      const { width, height, formData } = props;
      let { viewport } = props;
      if (formData.autozoom) {
        viewport = fitViewport(viewport, {
          width,
          height,
          points: getPoints(props.payload.data.features),
        }) as Viewport;
      }

      this.state = {
        viewport,
        layer: this.computeLayer(props),
      };
      this.onViewportChange = this.onViewportChange.bind(this);
    }

    UNSAFE_componentWillReceiveProps(nextProps: deckGLComponentProps) {
      // Only recompute the layer if anything BUT the viewport has changed
      const nextFdNoVP = { ...nextProps.formData, viewport: null };
      const currFdNoVP = { ...this.props.formData, viewport: null };
      if (
        !isEqual(nextFdNoVP, currFdNoVP) ||
        nextProps.payload !== this.props.payload
      ) {
        this.setState({ layer: this.computeLayer(nextProps) });
      }
    }

    onViewportChange(viewport: Viewport) {
      this.setState({ viewport });
    }

    computeLayer(props: deckGLComponentProps) {
      const { formData, payload, onAddFilter } = props;

      return getLayer(formData, payload, onAddFilter, this.setTooltip);
    }

    setTooltip = (tooltip: string) => {
      const { current } = this.containerRef;
      if (current) {
        current?.setTooltip(tooltip);
      }
    };

    render() {
      const { formData, payload, setControlValue, height, width } = this.props;
      const { layer, viewport } = this.state;

      return (
        <DeckGLContainerStyledWrapper
          ref={this.containerRef}
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          layers={[layer]}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
          width={width}
          height={height}
          onViewportChange={this.onViewportChange}
        />
      );
    }
  }
  return Component;
}

export function createCategoricalDeckGLComponent(
  getLayer: getLayerType<unknown>,
  getPoints: getPointsType<Point[]>,
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
