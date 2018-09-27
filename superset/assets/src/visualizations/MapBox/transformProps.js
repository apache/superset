import supercluster from 'supercluster';
import { DEFAULT_POINT_RADIUS, DEFAULT_MAX_ZOOM } from './MapBox';

export default function transformProps(basicChartInput) {
  const { formData, onError, payload, setControlValue } = basicChartInput;
  const {
    bounds,
    geoJSON,
    hasCustomMetric,
    mapboxApiKey,
  } = payload.data;
  const {
    clusteringRadius,
    globalOpacity,
    mapboxColor,
    mapboxStyle,
    pandasAggfunc,
    pointRadius,
    pointRadiusUnit,
    renderWhileDragging,
  } = formData;

  // Validate mapbox color
  const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/
    .exec(mapboxColor);
  if (rgb === null) {
    onError('Color field must be of form \'rgb(%d, %d, %d)\'');
    return {};
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

  return {
    aggregatorName: pandasAggfunc,
    bounds,
    clusterer,
    globalOpacity,
    hasCustomMetric,
    mapboxApiKey,
    mapStyle: mapboxStyle,
    onViewportChange({ latitude, longitude, zoom }) {
      setControlValue('viewport_longitude', longitude);
      setControlValue('viewport_latitude', latitude);
      setControlValue('viewport_zoom', zoom);
    },
    pointRadius: pointRadius === 'Auto' ? DEFAULT_POINT_RADIUS : pointRadius,
    pointRadiusUnit,
    renderWhileDragging,
    rgb,
  };
}
