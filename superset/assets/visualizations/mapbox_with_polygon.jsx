/* eslint-disable no-param-reassign */
/* eslint-disable react/no-multi-comp */
import d3 from 'd3';
import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import { json as requestJson } from 'd3-request';
import DeckGL, { GeoJsonLayer } from 'deck.gl';

import './mapbox_with_polygon.css';

const NOOP = () => {};

class MapboxViz extends React.Component {
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
      geojson: null,
      dmap: null,
      x_coord: 0,
      y_coord: 0,
      properties: null,
      hoveredFeature: false,
      minCount: 0,
      maxCount: 0
    };
    this.onViewportChange = this.onViewportChange.bind(this);
    this._onHover = this._onHover.bind(this);
    this._renderTooltip = this._renderTooltip.bind(this);
  }

  componentDidMount() {
    const country = this.props.country;
    requestJson('/static/assets/visualizations/countries/' + country + '.geojson', (error, response) => {
      var resp = this.props.dataResponse;
      var dataMap = [];
      if (!error) {
        for (var i = 0; i < resp.length; i++) {
          var key = resp[i].country_id;
          dataMap[key] = resp[i].metric;
        }
        const maxCount = d3.max(d3.values(dataMap));
        const minCount = d3.min(d3.values(dataMap));
        const center = d3.geo.centroid(response);
        const longitude = center[0];
        const latitude = center[1];
        this.setState({ geojson: response, dmap: dataMap, maxCount: maxCount, minCount: minCount,
          viewport: {
            longitude,
            latitude,
            zoom: this.props.viewportZoom,
            startDragLngLat: [longitude, latitude],
          }
        });
      }
    });
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
    this.props.setControlValue('viewport_longitude', viewport.longitude);
    this.props.setControlValue('viewport_latitude', viewport.latitude);
    this.props.setControlValue('viewport_zoom', viewport.zoom);
  }

  initialize(gl) {
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.blendEquation(gl.FUNC_ADD);
  }

  _onHover(event) {
    var hoveredFeature = false;
    if (event !== undefined) {
      var properties = event.object.properties;
      var x_coord = event.x;
      var y_coord = event.y;
      hoveredFeature = true;
      this.setState({ x_coord, y_coord, properties, hoveredFeature });
    } else {
      hoveredFeature = false;
    }
  }

  _renderTooltip() {
    const {hoveredFeature, properties, x_coord, y_coord, dmap} = this.state;
    return hoveredFeature && (
      <div className="tooltip" style={{left: x_coord, top: y_coord}}>
        <div>ID: {properties.ISO}</div>
        <div>Region: {properties.NAME_2}</div>
        <div>Count: {dmap[properties.ISO]}</div>
      </div>
    );
  }

  colorScale (r, rgb_color_scheme) {
    if(isNaN(r)) {
      return [211,211,211];
    } else if(rgb_color_scheme === 'green_red') {
      return [r * 255, 200 * (1 - r), 50];
    } else if(rgb_color_scheme === 'light_dark_blue') {
      return [0, (1-r) * 255, 255];
    } else {
      return [255, 255, (1-r) * 200]; // white-yellow
    }
  }

  render() {
    const { geojson, dmap, minCount, maxCount} = this.state;
    const rgb_color_scheme = this.props.rgb_color_scheme;
    const geosjsonLayer = new GeoJsonLayer({
      id: 'geojson-layer',
      data: geojson,
      opacity: 0.3,
      filled: true,
      stroked: true,
      lineWidthMinPixels: 1,
      lineWidthScale: 2,
      getFillColor: f => this.colorScale((( dmap[f.properties.ISO] - minCount ) / ( maxCount-minCount )), rgb_color_scheme ),      
      pickable: true
    });

    return (
      <MapGL
        {...this.state.viewport}
        mapboxApiAccessToken={this.props.mapboxApiKey}
        mapStyle={this.props.mapStyle}
        perspectiveEnabled
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        onChangeViewport={this.onViewportChange}
      >        
      <DeckGL
        {...this.state.viewport}
        layers={[geosjsonLayer]}
        onWebGLInitialized={this.initialize}
        onLayerHover={this._onHover}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
      />      
      {this._renderTooltip()}
      </MapGL>
    );
  }
}
MapboxViz.propTypes = {
  setControlValue: PropTypes.func,
  mapStyle: PropTypes.string,
  mapboxApiKey: PropTypes.string,
  sliceHeight: PropTypes.number,
  sliceWidth: PropTypes.number,
  viewportLatitude: PropTypes.number,
  viewportLongitude: PropTypes.number,
  viewportZoom: PropTypes.number,
  country: PropTypes.string,
  dataResponse: PropTypes.array,
};

function mapboxWithPolygon(slice, json, setControlValue) {
  const div = d3.select(slice.selector);
  div.selectAll('*').remove();
  ReactDOM.render(
    <MapboxViz
      {...json.data}
      sliceHeight={slice.height()}
      sliceWidth={slice.width()}
      setControlValue={setControlValue || NOOP}
    />,
    div.node(),
  );
}

module.exports = mapboxWithPolygon;