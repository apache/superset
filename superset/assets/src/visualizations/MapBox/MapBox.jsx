import React from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import MapGL from 'react-map-gl';
import Immutable from 'immutable';
import supercluster from 'supercluster';
import ViewportMercator from 'viewport-mercator-project';
import ScatterPlotGlowOverlay from './ScatterPlotGlowOverlay';
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
  bounds: PropTypes.array,
};

const defaultProps = {
  globalOpacity: 1,
  onViewportChange: NOOP,
  pointRadius: DEFAULT_POINT_RADIUS,
  pointRadiusUnit: 'Pixels',
};

class MapBox extends React.Component {
  constructor(props) {
    super(props);

    const { width, height, bounds } = this.props;
    // Get a viewport that fits the given bounds, which all marks to be clustered.
    // Derive lat, lon and zoom from this viewport. This is only done on initial
    // render as the bounds don't update as we pan/zoom in the current design.
    const mercator = new ViewportMercator({
      width,
      height,
    }).fitBounds(bounds);
    const { latitude, longitude, zoom } = mercator;
    // Compute the clusters based on the bounds. Again, this is only done once because
    // we don't update the clusters as we pan/zoom in the current design.
    const bbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
    this.clusters = this.props.clusterer.getClusters(bbox, Math.round(zoom));

    this.state = {
      viewport: {
        longitude,
        latitude,
        zoom,
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
    const isDragging = viewport.isDragging === undefined ? false :
                       viewport.isDragging;
    return (
      <MapGL
        {...viewport}
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
          locations={Immutable.fromJS(this.clusters)}
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
    bounds,
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
      bounds={bounds}
    />,
    document.querySelector(selector),
  );
}

export default mapbox;
