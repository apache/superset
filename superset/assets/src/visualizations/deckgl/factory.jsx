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
import { isEqual } from 'lodash';

import DeckGLContainer from './DeckGLContainer';
import CategoricalDeckGLContainer from './CategoricalDeckGLContainer';
import { fitViewport } from './layers/common';

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  setTooltip: PropTypes.func,
};
const defaultProps = {
  onAddFilter() {},
  setTooltip() {},
};

export function createDeckGLComponent(getLayer, getPoints) {
  // Higher order component
  class Component extends React.PureComponent {
    constructor(props) {
      super(props);
      const originalViewport = props.viewport;
      const viewport = props.formData.autozoom
        ? fitViewport(originalViewport, getPoints(props.payload.data.features))
        : originalViewport;
      this.state = {
        viewport,
        layer: this.computeLayer(props),
      };
      this.onViewportChange = this.onViewportChange.bind(this);
    }
    componentWillReceiveProps(nextProps) {
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
    onViewportChange(viewport) {
      this.setState({ viewport });
    }
    computeLayer(props) {
      const {
        formData,
        payload,
        onAddFilter,
        setTooltip,
      } = props;
      return getLayer(formData, payload, onAddFilter, setTooltip);
    }
    render() {
      const {
        formData,
        payload,
        setControlValue,
      } = this.props;
      const {
        layer,
        viewport,
      } = this.state;
      return (
        <DeckGLContainer
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          layers={[layer]}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
          onViewportChange={this.onViewportChange}
        />);
    }
  }
  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;
  return Component;
}

export function createCategoricalDeckGLComponent(getLayer, getPoints) {
  function Component(props) {
    const {
      formData,
      payload,
      setControlValue,
      onAddFilter,
      setTooltip,
      viewport,
    } = props;

    return (
      <CategoricalDeckGLContainer
        formData={formData}
        mapboxApiKey={payload.data.mapboxApiKey}
        setControlValue={setControlValue}
        viewport={viewport}
        getLayer={getLayer}
        payload={payload}
        onAddFilter={onAddFilter}
        setTooltip={setTooltip}
        getPoints={getPoints}
      />
    );
  }

  Component.propTypes = propTypes;
  Component.defaultProps = defaultProps;

  return Component;
}
