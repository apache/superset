/* eslint global-require: 0 */
import persistState from 'redux-localstorage';
import { compose } from 'redux';

const d3 = window.d3 || require('d3');

export const EARTH_CIRCUMFERENCE_KM = 40075.16;
export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;
export const MILES_PER_KM = 1.60934;
export const DEFAULT_LONGITUDE = -122.405293;
export const DEFAULT_LATITUDE = 37.772123;
export const DEFAULT_ZOOM = 11;

export function kmToPixels(kilometers, latitude, zoomLevel) {
  // Algorithm from: http://wiki.openstreetmap.org/wiki/Zoom_levels
  const latitudeRad = latitude * (Math.PI / 180);
  // Seems like the zoomLevel is off by one
  const kmPerPixel = EARTH_CIRCUMFERENCE_KM * Math.cos(latitudeRad) / Math.pow(2, zoomLevel + 9);
  return d3.round(kilometers / kmPerPixel, 2);
}

export function isNumeric(num) {
  return !isNaN(parseFloat(num)) && isFinite(num);
}

export function rgbLuminance(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return (LUMINANCE_RED_WEIGHT * r) + (LUMINANCE_GREEN_WEIGHT * g) + (LUMINANCE_BLUE_WEIGHT * b);
}

export function getDevEnhancer() {
  let enhancer = compose(persistState());
  if (process.env.NODE_ENV === 'dev') {
    enhancer = compose(
      persistState(), window.devToolsExtension && window.devToolsExtension()
    );
  }
  return enhancer;
}

export const VIZ_TYPES = [
  { value: 'dist_bar', label: 'Distribution - Bar Chart', requiresTime: false },
  { value: 'pie', label: 'Pie Chart', requiresTime: false },
  { value: 'line', label: 'Time Series - Line Chart', requiresTime: true },
  { value: 'bar', label: 'Time Series - Bar Chart', requiresTime: true },
  { value: 'compare', label: 'Time Series - Percent Change', requiresTime: true },
  { value: 'area', label: 'Time Series - Stacked', requiresTime: true },
  { value: 'table', label: 'Table View', requiresTime: false },
  { value: 'markup', label: 'Markup', requiresTime: false },
  { value: 'pivot_table', label: 'Pivot Table', requiresTime: false },
  { value: 'separator', label: 'Separator', requiresTime: false },
  { value: 'word_cloud', label: 'Word Cloud', requiresTime: false },
  { value: 'treemap', label: 'Treemap', requiresTime: false },
  { value: 'cal_heatmap', label: 'Calendar Heatmap', requiresTime: true },
  { value: 'box_plot', label: 'Box Plot', requiresTime: false },
  { value: 'bubble', label: 'Bubble Chart', requiresTime: false },
  { value: 'big_number', label: 'Big Number with Trendline', requiresTime: false },
  { value: 'bubble', label: 'Bubble Chart', requiresTime: false },
  { value: 'histogram', label: 'Histogram', requiresTime: false },
  { value: 'sunburst', label: 'Sunburst', requiresTime: false },
  { value: 'sankey', label: 'Sankey', requiresTime: false },
  { value: 'directed_force', label: 'Directed Force Layout', requiresTime: false },
  { value: 'world_map', label: 'World Map', requiresTime: false },
  { value: 'filter_box', label: 'Filter Box', requiresTime: false },
  { value: 'iframe', label: 'iFrame', requiresTime: false },
  { value: 'para', label: 'Parallel Coordinates', requiresTime: false },
  { value: 'heatmap', label: 'Heatmap', requiresTime: false },
  { value: 'horizon', label: 'Horizon', requiresTime: false },
  { value: 'mapbox', label: 'Mapbox', requiresTime: false },
];
