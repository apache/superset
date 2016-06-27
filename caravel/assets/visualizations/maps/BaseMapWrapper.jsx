import React from 'react';
import MapGL from 'react-map-gl';
import {
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM
} from '../../utils/utils';

const BaseMapWrapper = ComposedComponent => {
  const propTypes = {
    viewportLongitude: React.PropTypes.number,
    viewportLatitude: React.PropTypes.number,
    viewportZoom: React.PropTypes.number,
    mapStyle: React.PropTypes.string.isRequired,
    sliceWidth: React.PropTypes.number.isRequired,
    sliceHeight: React.PropTypes.number.isRequired,
    mapboxApiKey: React.PropTypes.string.isRequired
  };

  class BaseMap extends React.Component {
    constructor(props) {
      super(props);

      const longitude = this.props.viewportLongitude || DEFAULT_LONGITUDE;
      const latitude = this.props.viewportLatitude || DEFAULT_LATITUDE;

      this.state = {
        viewport: {
          longitude: longitude,
          latitude: latitude,
          zoom: this.props.viewportZoom || DEFAULT_ZOOM,
          startDragLngLat: [longitude, latitude]
        }
      };

      this.onChangeViewport = this.onChangeViewport.bind(this);
    }

    onChangeViewport(viewport) {
      this.setState({
        viewport: viewport
      });
    }

    render() {
      d3.select('#viewport_longitude').attr('value', this.state.viewport.longitude);
      d3.select('#viewport_latitude').attr('value', this.state.viewport.latitude);
      d3.select('#viewport_zoom').attr('value', this.state.viewport.zoom);

      return (
        <MapGL
          {...this.state.viewport}
          mapStyle={this.props.mapStyle}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          mapboxApiAccessToken={this.props.mapboxApiKey}
          onChangeViewport={this.onChangeViewport}>
          <ComposedComponent
            {...this.props}
            viewport={this.state.viewport}
            isDragging={this.state.viewport.isDragging === undefined ? false :
                        this.state.viewport.isDragging}
          />
        </MapGL>
      );
    }
  }

  BaseMap.propTypes = propTypes;

  return BaseMap;
};

export default BaseMapWrapper;
