import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import Immutable from 'immutable';
import supercluster from 'supercluster';
import ViewportMercator from 'viewport-mercator-project';
import ScatterPlotGlowOverlay from './ScatterPlotGlowOverlay';

import {
  DEFAULT_LONGITUDE,
  DEFAULT_LATITUDE,
  DEFAULT_ZOOM,
} from '../../utils/common';
import './MapBox.css';

const NOOP = () => {};
const DEFAULT_POINT_RADIUS = 60;
const DEFAULT_MAX_ZOOM = 16;

const propTypes = {
  aggregatorName: PropTypes.string,
  clusterer: PropTypes.object,
  globalOpacity: PropTypes.number,
  mapStyle: PropTypes.string,
  mapboxApiKey: PropTypes.string,
  onViewportChange: PropTypes.func,
  pointRadius: PropTypes.number,
  pointRadiusUnit: PropTypes.string,
  renderWhileDragging: PropTypes.bool,
  rgb: PropTypes.array,
  sliceHeight: PropTypes.number,
  sliceWidth: PropTypes.number,
  viewportLatitude: PropTypes.number,
  viewportLongitude: PropTypes.number,
  viewportZoom: PropTypes.number,
};

const defaultProps = {
  onViewportChange: NOOP,
  viewportLatitude: DEFAULT_LATITUDE,
  viewportLongitude: DEFAULT_LONGITUDE,
  viewportZoom: DEFAULT_ZOOM,
};

class MapBox extends React.Component {
  constructor(props) {
    super(props);

    const {
      viewportLatitude: latitude,
      viewportLongitude: longitude,
      viewportZoom: zoom,
    } = this.props;

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom,
        startDragLngLat: [longitude, latitude],
      },
    };
    this.onViewportChange = this.onViewportChange.bind(this);
  }

  onViewportChange(viewport) {
    this.setState({ viewport });
    this.props.onViewportChange(viewport);
  }

  render() {
    const mercator = new ViewportMercator({
      width: this.props.sliceWidth,
      height: this.props.sliceHeight,
      longitude: this.state.viewport.longitude,
      latitude: this.state.viewport.latitude,
      zoom: this.state.viewport.zoom,
    });
    const topLeft = mercator.unproject([0, 0]);
    const bottomRight = mercator.unproject([this.props.sliceWidth, this.props.sliceHeight]);
    const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
    const clusters = this.props.clusterer.getClusters(bbox, Math.round(this.state.viewport.zoom));
    const isDragging = this.state.viewport.isDragging === undefined ? false :
                       this.state.viewport.isDragging;
    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={this.props.mapStyle}
        width={this.props.sliceWidth}
        height={this.props.sliceHeight}
        mapboxApiAccessToken={this.props.mapboxApiKey}
        onViewportChange={this.onViewportChange}
      >
        <ScatterPlotGlowOverlay
          {...this.state.viewport}
          isDragging={isDragging}
          width={this.props.sliceWidth}
          height={this.props.sliceHeight}
          locations={Immutable.fromJS(clusters)}
          dotRadius={this.props.pointRadius}
          pointRadiusUnit={this.props.pointRadiusUnit}
          rgb={this.props.rgb}
          globalOpacity={this.props.globalOpacity}
          compositeOperation={'screen'}
          renderWhileDragging={this.props.renderWhileDragging}
          aggregatorName={this.props.aggregatorName}
          lngLatAccessor={function (location) {
            const coordinates = location.get('geometry').get('coordinates');
            return [coordinates.get(0), coordinates.get(1)];
          }}
        />
      </MapGL>
    );
  }
}

MapBox.propTypes = propTypes;
MapBox.defaultProps = defaultProps;

function mapbox(slice, payload, setControlValue) {
  const { selector } = slice;
  const {
    aggregatorName: aggName,
    clusteringRadius,
    color,
    customMetric,
    geoJSON,
  } = payload.data;

  // Validate mapbox color
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/
    .exec(color);
  if (rgb === null) {
    slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
    return;
  }

  let reducer;

  if (aggName === 'sum' || !customMetric) {
    reducer = (a, b) => a + b;
  } else if (aggName === 'min') {
    reducer = Math.min;
  } else if (aggName === 'max') {
    reducer = Math.max;
  } else {
    reducer = function (a, b) {
      if (a instanceof Array) {
        if (b instanceof Array) {
          return a.concat(b);
        }
        a.push(b);
        return a;
      }
      if (b instanceof Array) {
        b.push(a);
        return b;
      }
      return [a, b];
    };
  }

  const clusterer = supercluster({
    radius: clusteringRadius,
    maxZoom: DEFAULT_MAX_ZOOM,
    metricKey: 'metric',
    metricReducer: reducer,
  });
  clusterer.load(geoJSON.features);

  ReactDOM.render(
    <MapBox
      {...payload.data}
      rgb={rgb}
      sliceHeight={slice.height()}
      sliceWidth={slice.width()}
      clusterer={clusterer}
      pointRadius={DEFAULT_POINT_RADIUS}
      aggregatorName={aggName}
      onViewportChange={({ latitude, longitude, zoom }) => {
        setControlValue('viewport_longitude', longitude);
        setControlValue('viewport_latitude', latitude);
        setControlValue('viewport_zoom', zoom);
      }}
    />,
    document.querySelector(selector),
  );
}

export default mapbox;
