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
import MapGL from 'react-map-gl';
import DeckGL from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { isEqual } from 'lodash';
import '../stylesheets/deckgl.css';

const TICK = 2000;  // milliseconds

const propTypes = {
  viewport: PropTypes.object.isRequired,
  layers: PropTypes.array.isRequired,
  setControlValue: PropTypes.func,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  onViewportChange: PropTypes.func,
};
const defaultProps = {
  mapStyle: 'light',
  onViewportChange: () => {},
  setControlValue: () => {},
};

export default class DeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.tick = this.tick.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    // This has to be placed after this.tick is bound to this
    this.state = {
      previousViewport: props.viewport,
      timer: setInterval(this.tick, TICK),
    };
  }
  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.viewport !== prevState.viewport) {
      return {
        viewport: { ...nextProps.viewport },
        previousViewport: prevState.viewport,
      };
    }
    return null;
  }
  componentWillUnmount() {
    clearInterval(this.state.timer);
  }
  onViewportChange(viewport) {
    const vp = Object.assign({}, viewport);
    // delete vp.width;
    // delete vp.height;
    const newVp = { ...this.state.previousViewport, ...vp };

    // this.setState(() => ({ viewport: newVp }));
    this.props.onViewportChange(newVp);
  }
  tick() {
    // Limiting updating viewport controls through Redux at most 1*sec
    // Deep compare is needed as shallow equality doesn't work here, viewport object
    // changes id at every change
    if (this.state && !isEqual(this.state.previousViewport, this.props.viewport)) {
      const setCV = this.props.setControlValue;
      const vp = this.props.viewport;
      if (setCV) {
        setCV('viewport', vp);
      }
      this.setState(() => ({ previousViewport: this.props.viewport }));
    }
  }
  layers() {
    // Support for layer factory
    if (this.props.layers.some(l => typeof l === 'function')) {
      return this.props.layers.map(l => typeof l === 'function' ? l() : l);
    }
    return this.props.layers;
  }
  render() {
    const { viewport } = this.props;
    return (
      <MapGL
        {...viewport}
        mapStyle={this.props.mapStyle}
        onViewportChange={this.onViewportChange}
        mapboxApiAccessToken={this.props.mapboxApiAccessToken}
      >
        <DeckGL
          {...viewport}
          layers={this.layers()}
          initWebGLParameters
        />
      </MapGL>
    );
  }
}

DeckGLContainer.propTypes = propTypes;
DeckGLContainer.defaultProps = defaultProps;
