import $ from 'jquery';
import d3 from 'd3';

// Color related utility functions go in this object
export const bnbColors = [
  '#9e0142',
  '#d53e4f',
  '#f46d43',
  '#fdae61',
  '#fee08b',
   '#ffffbf',
  '#e6f598',
  '#abdda4',
  '#66c2a5',
  '#3288bd',
  '#5e4fa2',
  '#8e0152',
  '#c51b7d',
  '#de77ae',
  '#f1b6da',
  '#fde0ef',
  '#f7f7f7',
  '#e6f5d0',
  '#b8e186',
  '#7fbc41',
  '#4d9221',
  '#276419',
];

const spectrums = {
  blue_white_yellow: [
    '#00d1c1',
    'white',
    '#ffb400',
  ],
  fire: [
    'white',
    'yellow',
    'red',
    'black',
  ],
  white_black: [
    'white',
    'black',
  ],
  black_white: [
    'black',
    'white',
  ],
  YlGnBu: [
    '#ffffd9',
    '#edf8b1',
    '#c7e9b4',
    '#7fcdbb',
    '#41b6c4',
    '#1d91c0',
    '#225ea8',
    '#253494',
    '#081d5',
    ],
};

export const category21 = (function () {
  // Color factory
  const seen = {};
  return function (s) {
    if (!s) {
      return;
    }
    let stringifyS = String(s);
    // next line is for superset series that should have the same color
    stringifyS = stringifyS.replace('---', '');
    if (seen[stringifyS] === undefined) {
      seen[stringifyS] = Object.keys(seen).length;
    }
    /* eslint consistent-return: 0 */
    return bnbColors[seen[stringifyS] % bnbColors.length];
  };
}());

export const colorScalerFactory = function (colors, data, accessor, country) {
  if (typeof country === 'undefined') { country = 'notmap'; }
  // Returns a linear scaler our of an array of color
  if (!Array.isArray(colors)) {
    /* eslint no-param-reassign: 0 */
    colors = spectrums[colors];
  }
  let ext = [0, 1];
  if (data !== undefined) {
    ext = d3.extent(data, accessor);
  }
  const points = [];
  const chunkSize = (ext[1] - ext[0]) / colors.length;
  $.each(colors, function (i) {
    points.push(i * chunkSize);
    console.log(points)
  });
  if (country == 'map'){
    return d3.scale.quantile().domain(points).range(colors);
  } else {return d3.scale.linear().domain(points).range(colors);}
  //return d3.scale.quantize().domain(points).range(colors);
};
