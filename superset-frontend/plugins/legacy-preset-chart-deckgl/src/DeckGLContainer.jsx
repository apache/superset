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
import React from 'react';
import PropTypes from 'prop-types';
import { StaticMap } from 'react-map-gl';
import DeckGL from 'deck.gl';
import { styled } from '@superset-ui/core';
import Tooltip from './components/Tooltip';
import 'mapbox-gl/dist/mapbox-gl.css';
import './css/deckgl.css';

const TICK = 250; // milliseconds

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  children: PropTypes.node,
  bottomMargin: PropTypes.number,
  width: PropTypes.number.isRequired,
  height: PropTypes.number.isRequired,
  onViewportChange: PropTypes.func,
};
const defaultProps = {
  mapStyle: 'light',
  setControlValue: () => {},
  children: null,
  bottomMargin: 0,
};

export class DeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.tick = this.tick.bind(this);
    this.onViewStateChange = this.onViewStateChange.bind(this);
    // This has to be placed after this.tick is bound to this
    this.state = {
      timer: setInterval(this.tick, TICK),
      tooltip: null,
      viewState: props.viewport,
    };
  }

  componentWillUnmount() {
    clearInterval(this.state.timer);
  }

  onViewStateChange({ viewState }) {
    this.setState({ viewState, lastUpdate: Date.now() });
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
      return this.props.layers.map(l => (typeof l === 'function' ? l() : l));
    }

    return this.props.layers;
  }

  setTooltip = tooltip => {
    this.setState({ tooltip });
  };

  render() {
    const { children, bottomMargin, height, width } = this.props;
    const { viewState, tooltip } = this.state;
    const adjustedHeight = height - bottomMargin;

    const layers = this.layers();

    return (
      <>
        <div style={{ position: 'relative', width, height: adjustedHeight }}>
          <DeckGL
            initWebGLParameters
            controller
            width={width}
            height={adjustedHeight}
            layers={layers}
            viewState={viewState}
            glOptions={{ preserveDrawingBuffer: true }}
            onViewStateChange={this.onViewStateChange}
          >
            <StaticMap
              preserveDrawingBuffer
              mapStyle={this.props.mapStyle}
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

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;

export const DeckGLContainerStyledWrapper = styled(DeckGLContainer)`
  .deckgl-tooltip > div {
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
