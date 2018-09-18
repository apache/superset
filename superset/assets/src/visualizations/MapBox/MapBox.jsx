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
      hasCustomMetric,
      bounds,
    } = this.props;
    const { viewport } = this.state;
    const isDragging = viewport.isDragging === undefined ? false :
                       viewport.isDragging;

    // Compute the clusters based on the original bounds and current zoom level. Note when zoom/pan
    // to an area outside of the original bounds, no additional queries are made to the backend to
    // retrieve additional data.
    const bbox = [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
    const clusters = this.props.clusterer.getClusters(bbox, Math.round(viewport.zoom));

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
          locations={Immutable.fromJS(clusters)}
          dotRadius={pointRadius}
          pointRadiusUnit={pointRadiusUnit}
          rgb={rgb}
          globalOpacity={globalOpacity}
          compositeOperation={'screen'}
          renderWhileDragging={renderWhileDragging}
          aggregation={hasCustomMetric ? aggregatorName : null}
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

function mapbox(slice, payload, setControlValue) {
  const { formData, selector } = slice;
  const {
    hasCustomMetric,
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

  const opts = {
    radius: clusteringRadius,
    maxZoom: DEFAULT_MAX_ZOOM,
  };
  if (hasCustomMetric) {
    opts.initial = () => ({
      sum: 0,
      squaredSum: 0,
      min: Infinity,
      max: -Infinity,
    });
    opts.map = prop => ({
      sum: prop.metric,
      squaredSum: Math.pow(prop.metric, 2),
      min: prop.metric,
      max: prop.metric,
    });
    opts.reduce = (accu, prop) => {
      // Temporarily disable param-reassignment linting to work with supercluster's api
      /* eslint-disable no-param-reassign */
      accu.sum += prop.sum;
      accu.squaredSum += prop.squaredSum;
      accu.min = Math.min(accu.min, prop.min);
      accu.max = Math.max(accu.max, prop.max);
      /* eslint-enable no-param-reassign */
    };
  }
  const clusterer = supercluster(opts);
  clusterer.load(geoJSON.features);

  ReactDOM.render(
    <MapBox
      width={slice.width()}
      height={slice.height()}
      hasCustomMetric={hasCustomMetric}
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
