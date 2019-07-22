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
import _ from 'lodash';
import PropTypes from 'prop-types';
import { SupersetClient } from '@superset-ui/connection';
import Geocoder from 'react-mapbox-gl-geocoder';

import DeckGLContainer from '../DeckGLContainer';
import {IconLayer} from '@deck.gl/layers';
import { getExploreLongUrl } from '../../../explore/exploreUtils';
import layerGenerators from '../layers';

const propTypes = {
  formData: PropTypes.object.isRequired,
  payload: PropTypes.object.isRequired,
  setControlValue: PropTypes.func.isRequired,
  viewport: PropTypes.object.isRequired,
  onAddFilter: PropTypes.func,
  setTooltip: PropTypes.func,
  onSelect: PropTypes.func,
};

const defaultProps = {
  onAddFilter() {},
  setTooltip() {},
  onSelect() {},
};

const queryParams = {
  country: 'us',
};

const ICON_MAPPING = {
  marker: {x: 0, y: 0, width: 32, height: 32, mask: false}
};

class DeckMulti extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = { subSlicesLayers: {} };
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  componentDidMount() {
    const { formData, payload } = this.props;
    this.loadLayers(formData, payload);
  }

  componentWillReceiveProps(nextProps) {
    const { formData, payload } = nextProps;
    const hasChanges = !_.isEqual(this.props.formData.deck_slices, nextProps.formData.deck_slices);
    if (hasChanges) {
      this.loadLayers(formData, payload);
    }
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
  }

  onSelected(viewport, selectedItem) {
    this.setState({ viewport, selectedItem });
  }

  loadLayers(formData, payload, viewport) {
    this.setState({ subSlicesLayers: {}, viewport });
    payload.data.slices.forEach((subslice) => {
      // Filters applied to multi_deck are passed down to underlying charts
      // note that dashboard contextual information (filter_immune_slices and such) aren't
      // taken into consideration here
      const filters = [
        ...(subslice.form_data.filters || []),
        ...(formData.filters || []),
        ...(formData.extra_filters || []),
      ];
      const subsliceCopy = {
        ...subslice,
        form_data: {
          ...subslice.form_data,
          filters,
        },
      };

      SupersetClient.get({
          endpoint: getExploreLongUrl(subsliceCopy.form_data, 'json'),
        })
        .then(({ json }) => {
          const layer = layerGenerators[subsliceCopy.form_data.viz_type](
            subsliceCopy.form_data,
            json,
            this.props.onAddFilter,
            this.props.setTooltip,
            [],
            this.props.onSelect,
          );
          this.setState({
            subSlicesLayers: {
              ...this.state.subSlicesLayers,
              [subsliceCopy.slice_id]: layer,
            },
          });
        })
        .catch(() => {});
    });
  }

  _onHover({x, y, object }) {
    this.setState({x, y, hoveredObject: object });
  }

  _renderTooltip() {
    const { x, y, hoveredObject } = this.state;

    if (!hoveredObject) {
      return null;
    }

    return (
      <div className="geo-tooltip" style={{ left: x, top: y + 20 }}>
        <div>{this.state.selectedItem.place_name}</div>
      </div>
    );
  }

  generateNewMarkerLayer() {
    return new IconLayer({
      id: 'icon-layer',
      data: [this.state.selectedItem],
      pickable: true,
      iconAtlas: '/static/assets/images/location-pin.png',
      iconMapping: ICON_MAPPING,
      getIcon: d => 'marker',
      sizeScale: 15,
      getPosition: d => d.center,
      getSize: d => 5,
      getColor: d => [0, 166, 153],
      onHover: this._onHover.bind(this),
    });
  }

  removeMarker() {
    this.setState({
      selectedItem: null,
    });
  }

  render() {
    const { payload, formData, setControlValue } = this.props;
    const { subSlicesLayers } = this.state;

    const layers = Object.values(subSlicesLayers);
    const viewport = this.state.viewport || this.props.viewport;

    if (this.state.selectedItem) {
      layers.push(this.generateNewMarkerLayer());
    }

    return (
      <>
        <div className="geo-container">
          <Geocoder
            mapboxApiAccessToken={payload.data.mapboxApiKey}
            onSelected={this.onSelected.bind(this)}
            viewport={viewport}
            hideOnSelect
            pointZoom={15}
            queryParams={queryParams}
          />
          {this.state.selectedItem ? <button className="btn btn-primary remove-layer" onClick={this.removeMarker.bind(this)} title="Remove marker">&times;</button> : null}
        </div>
        {this._renderTooltip()}
        <DeckGLContainer
          mapboxApiAccessToken={payload.data.mapboxApiKey}
          viewport={viewport}
          onViewportChange={this.onViewportChange}
          layers={layers}
          mapStyle={formData.mapbox_style}
          setControlValue={setControlValue}
        />
      </>
    );
  }
}

DeckMulti.propTypes = propTypes;
DeckMulti.defaultProps = defaultProps;

export default DeckMulti;
