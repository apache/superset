/* eslint-disable react/jsx-sort-default-props */
/* eslint-disable react/sort-prop-types */
/* eslint-disable react/jsx-handler-names */
/* eslint-disable react/forbid-prop-types */
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
import React, { ReactNode } from 'react';
import { isEqual } from 'lodash';
import { StaticMap } from 'react-map-gl';
import DeckGL, { Layer } from 'deck.gl/typed';
import { JsonObject, JsonValue, styled } from '@superset-ui/core';
import Tooltip, { TooltipProps } from './components/Tooltip';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Viewport } from './utils/fitViewport';

const TICK = 250; // milliseconds

export type DeckGLContainerProps = {
  viewport: Viewport;
  setControlValue?: (control: string, value: JsonValue) => void;
  mapStyle?: string;
  mapboxApiAccessToken: string;
  children?: ReactNode;
  width: number;
  height: number;
  layers: (Layer | (() => Layer))[];
  onViewportChange?: (viewport: Viewport) => void;
};

export type DeckGLContainerState = {
  lastUpdate: number | null;
  viewState: Viewport;
  tooltip: TooltipProps['tooltip'];
  timer: ReturnType<typeof setInterval>;
};

export class DeckGLContainer extends React.Component<
  DeckGLContainerProps,
  DeckGLContainerState
> {
  constructor(props: DeckGLContainerProps) {
    super(props);
    this.tick = this.tick.bind(this);
    this.onViewStateChange = this.onViewStateChange.bind(this);
    // This has to be placed after this.tick is bound to this
    this.state = {
      timer: setInterval(this.tick, TICK),
      tooltip: null,
      viewState: props.viewport,
      lastUpdate: null,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: DeckGLContainerProps) {
    if (!isEqual(nextProps.viewport, this.props.viewport)) {
      this.setState({ viewState: nextProps.viewport });
    }
  }

  componentWillUnmount() {
    clearInterval(this.state.timer);
  }

  onViewStateChange({ viewState }: { viewState: JsonObject }) {
    this.setState({ viewState: viewState as Viewport, lastUpdate: Date.now() });
  }

  tick() {
    // Rate limiting updating viewport controls as it triggers lotsa renders
    const { lastUpdate } = this.state;
    if (lastUpdate && Date.now() - lastUpdate > TICK) {
      const setCV = this.props.setControlValue;
      if (setCV) {
        setCV('viewport', this.state.viewState);
      }
      this.setState({ lastUpdate: null });
    }
  }

  layers() {
    // Support for layer factory
    if (this.props.layers.some(l => typeof l === 'function')) {
      return this.props.layers.map(l =>
        typeof l === 'function' ? l() : l,
      ) as Layer[];
    }

    return this.props.layers as Layer[];
  }

  setTooltip = (tooltip: TooltipProps['tooltip']) => {
    this.setState({ tooltip });
  };

  render() {
    const { children = null, height, width } = this.props;
    const { viewState, tooltip } = this.state;

    const layers = this.layers();

    return (
      <>
        <div style={{ position: 'relative', width, height }}>
          <DeckGL
            controller
            width={width}
            height={height}
            layers={layers}
            viewState={viewState}
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={this.onViewStateChange}
          >
            <StaticMap
              preserveDrawingBuffer
              mapStyle={this.props.mapStyle || 'light'}
              mapboxApiAccessToken={this.props.mapboxApiAccessToken}
            />
          </DeckGL>
          {children}
        </div>
        <Tooltip tooltip={tooltip} />
      </>
    );
  }
}

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
