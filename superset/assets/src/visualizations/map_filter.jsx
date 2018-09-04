/* eslint-disable no-param-reassign */
/* eslint-disable react/no-multi-comp */
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import MapboxDraw from '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw';

import {
  kmToPixels,
  rgbLuminance,
  isNumeric,
  MILES_PER_KM,
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM,
} from '../utils/common';
import './mapbox.css';

const NOOP = () => {};



class MapGLDraw extends MapGL {

  componentDidMount() {
    const data = this.props.geoJSON
    super.componentDidMount();
    const map = this.getMap();
    map.on('load', function () {
      map.addLayer({
          id: 'points',
          type: 'circle',
          source: {
              type: 'geojson',
              data: data,
          },
      });
      this.draw = new MapboxDraw({});
      map.addControl(this.draw, 'top-right');
    });
  }

  componentWillUnmount() {
    const map = this.getMap();
    if (!map || !map.getStyle()) {
      return;
    }
    map.removeControl(this.draw);
  }

}

MapGLDraw.propTypes = Object.assign({}, MapGL.propTypes, {
  geoJSON: PropTypes.object,
});

class MapFilterViz extends React.Component {
  constructor(props) {
    super(props);
    const longitude = this.props.viewportLongitude || DEFAULT_LONGITUDE;
    const latitude = this.props.viewportLatitude || DEFAULT_LATITUDE;

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom: this.props.viewportZoom || DEFAULT_ZOOM,
        startDragLngLat: [longitude, latitude],
      },
    };
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
    this.props.setControlValue('viewport_longitude', viewport.longitude);
    this.props.setControlValue('viewport_latitude', viewport.latitude);
    this.props.setControlValue('viewport_zoom', viewport.zoom);
  }

  render() {
    return (
      <MapGLDraw
        {...this.state.viewport}
        mapStyle={this.props.mapStyle}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={this.props.mapboxApiKey}
        onViewportChange={this.onViewportChange}
        geoJSON={this.props.geoJSON}
      />
    );
  }
}

MapFilterViz.propTypes = {
  setControlValue: PropTypes.func,
  globalOpacity: PropTypes.number,
  mapStyle: PropTypes.string,
  mapboxApiKey: PropTypes.string,
  pointRadius: PropTypes.number,
  pointRadiusUnit: PropTypes.string,
  renderWhileDragging: PropTypes.bool,
  sliceHeight: PropTypes.number,
  sliceWidth: PropTypes.number,
  viewportLatitude: PropTypes.number,
  viewportLongitude: PropTypes.number,
  viewportZoom: PropTypes.number,
  geoJSON: PropTypes.object,
};

function mapFilter(slice, json, setControlValue) {
  const div = d3.select(slice.selector);
  const DEFAULT_POINT_RADIUS = 60;
  div.selectAll('*').remove();
  ReactDOM.render(
    <MapFilterViz
      {...json.data}
      sliceHeight={slice.height()}
      sliceWidth={slice.width()}
      pointRadius={DEFAULT_POINT_RADIUS}
      setControlValue={setControlValue || NOOP}
    />,
    div.node(),
  );
}

module.exports = mapFilter;
