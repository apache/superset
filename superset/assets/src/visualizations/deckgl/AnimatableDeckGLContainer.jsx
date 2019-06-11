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

import DeckGLContainer from './DeckGLContainer';
import PlaySlider from '../PlaySlider';

const PLAYSLIDER_HEIGHT = 20;  // px

const propTypes = {
  getLayers: PropTypes.func.isRequired,
  start: PropTypes.number.isRequired,
  end: PropTypes.number.isRequired,
  getStep: PropTypes.func,
  values: PropTypes.array.isRequired,
  aggregation: PropTypes.bool,
  disabled: PropTypes.bool,
  viewport: PropTypes.object.isRequired,
  children: PropTypes.node,
  mapStyle: PropTypes.string,
  mapboxApiAccessToken: PropTypes.string.isRequired,
  setControlValue: PropTypes.func,
  onViewportChange: PropTypes.func,
  onValuesChange: PropTypes.func,
};

const defaultProps = {
  aggregation: false,
  disabled: false,
  mapStyle: 'light',
  setControlValue: () => {},
  onViewportChange: () => {},
  onValuesChange: () => {},
};

export default class AnimatableDeckGLContainer extends React.Component {
  constructor(props) {
    super(props);
    this.onViewportChange = this.onViewportChange.bind(this);
  }
  onViewportChange(viewport) {
    const originalViewport = this.props.disabled
      ? { ...viewport }
      : { ...viewport, height: viewport.height + PLAYSLIDER_HEIGHT };
    this.props.onViewportChange(originalViewport);
  }
  render() {
    const {
      start,
      end,
      getStep,
      disabled,
      aggregation,
      children,
      getLayers,
      values,
      onValuesChange,
      viewport,
      setControlValue,
      mapStyle,
      mapboxApiAccessToken,
    } = this.props;
    const layers = getLayers(values);

    // leave space for the play slider
    const modifiedViewport = {
      ...viewport,
      height: disabled ? viewport.height : viewport.height - PLAYSLIDER_HEIGHT,
    };

    return (
      <div>
        <DeckGLContainer
          viewport={modifiedViewport}
          layers={layers}
          setControlValue={setControlValue}
          mapStyle={mapStyle}
          mapboxApiAccessToken={mapboxApiAccessToken}
          onViewportChange={this.onViewportChange}
        />
        {!disabled &&
        <PlaySlider
          start={start}
          end={end}
          step={getStep(start)}
          values={values}
          range={!aggregation}
          onChange={onValuesChange}
        />
        }
        {children}
      </div>
    );
  }
}

AnimatableDeckGLContainer.propTypes = propTypes;
AnimatableDeckGLContainer.defaultProps = defaultProps;
