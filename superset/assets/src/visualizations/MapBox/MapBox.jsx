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
  width: PropTypes.number,
  height: PropTypes.number,
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
  viewportLatitude: PropTypes.number,
  viewportLongitude: PropTypes.number,
  viewportZoom: PropTypes.number,
};

const defaultProps = {
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
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
    const {
      width,
      height,
      aggregatorName,
      globalOpacity,
      mapStyle,
      mapboxApiKey,
      pointRadius,
      pointRadiusUnit,
      renderWhileDragging,
      rgb,
    } = this.props;
    const { viewport } = this.state;
    const { latitude, longitude, zoom } = viewport;
    const mercator = new ViewportMercator({
      width,
      height,
      longitude,
      latitude,
      zoom,
    });
    const topLeft = mercator.unproject([0, 0]);
    const bottomRight = mercator.unproject([width, height]);
    const bbox = [topLeft[0], bottomRight[1], bottomRight[0], topLeft[1]];
    const clusters = this.props.clusterer.getClusters(bbox, Math.round(zoom));
    const isDragging = viewport.isDragging === undefined ? false :
                       viewport.isDragging;
    return (
      <MapGL
        {...this.state.viewport}
        mapStyle={mapStyle}
        width={width}
        height={height}
        mapboxApiAccessToken={mapboxApiKey}
        onViewportChange={this.onViewportChange}
      >
        <ScatterPlotGlowOverlay
          {...viewport}
          isDragging={isDragging}
          width={width}
          height={height}
          locations={Immutable.fromJS(clusters)}
          dotRadius={pointRadius}
          pointRadiusUnit={pointRadiusUnit}
          rgb={rgb}
          globalOpacity={globalOpacity}
          compositeOperation={'screen'}
          renderWhileDragging={renderWhileDragging}
          aggregatorName={aggregatorName}
          lngLatAccessor={(location) => {
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

function createReducer(aggregatorName, customMetric) {
  if (aggregatorName === 'sum' || !customMetric) {
    return (a, b) => a + b;
  } else if (aggName === 'min') {
    return Math.min;
  } else if (aggName === 'max') {
    return Math.max;
  }
  return function (a, b) {
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

function mapbox(slice, payload, setControlValue) {
  const { formData, selector } = slice;
  const {
    customMetric,
    geoJSON,
    mapboxApiKey,
  } = payload.data;
  const {
    clustering_radius: clusteringRadius,
    global_opacity: globalOpacity,
    mapbox_color: color,
    mapbox_style: mapStyle,
    pandas_aggfunc: aggregatorName,
    point_radius: pointRadius,
    point_radius_unit: pointRadiusUnit,
    render_while_dragging: renderWhileDragging,
    viewport_latitude: viewportLatitude,
    viewport_longitude: viewportLongitude,
    viewport_zoom: viewportZoom,
  } = formData;

  // Validate mapbox color
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/
    .exec(color);
  if (rgb === null) {
    slice.error('Color field must be of form \'rgb(%d, %d, %d)\'');
    return;
  }

  const clusterer = supercluster({
    radius: clusteringRadius,
    maxZoom: DEFAULT_MAX_ZOOM,
    metricKey: 'metric',
    metricReducer: createReducer(aggregatorName, customMetric),
  });
  clusterer.load(geoJSON.features);

  ReactDOM.render(
    <MapBox
      width={slice.width()}
      height={slice.height()}
      aggregatorName={aggregatorName}
      clusterer={clusterer}
      globalOpacity={globalOpacity}
      mapStyle={mapStyle}
      mapboxApiKey={mapboxApiKey}
      onViewportChange={({ latitude, longitude, zoom }) => {
        setControlValue('viewport_longitude', longitude);
        setControlValue('viewport_latitude', latitude);
        setControlValue('viewport_zoom', zoom);
      }}
      pointRadius={pointRadius === 'Auto' ? DEFAULT_POINT_RADIUS : pointRadius}
      pointRadiusUnit={pointRadiusUnit}
      renderWhileDragging={renderWhileDragging}
      rgb={rgb}
      viewportLatitude={viewportLatitude}
      viewportLongitude={viewportLongitude}
      viewportZoom={viewportZoom}
    />,
    document.querySelector(selector),
  );
}

export default mapbox;
