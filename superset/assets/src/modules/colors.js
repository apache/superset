import d3 from 'd3';
import { TIME_SHIFT_PATTERN } from '../utils/common';

export const brandColor = '#00A699';
export const colorPrimary = { r: 0, g: 122, b: 135, a: 1 };

// Color related utility functions go in this object
export const bnbColors = [
  '#ff5a5f', // rausch
  '#7b0051', // hackb
  '#007A87', // kazan
  '#00d1c1', // babu
  '#8ce071', // lima
  '#ffb400', // beach
  '#b4a76c', // barol
  '#ff8083',
  '#cc0086',
  '#00a1b3',
  '#00ffeb',
  '#bbedab',
  '#ffd266',
  '#cbc29a',
  '#ff3339',
  '#ff1ab1',
  '#005c66',
  '#00b3a5',
  '#55d12e',
  '#b37e00',
  '#988b4e',
];

export const lyftColors = [
  '#EA0B8C',
  '#6C838E',
  '#29ABE2',
  '#33D9C1',
  '#9DACB9',
  '#7560AA',
  '#2D5584',
  '#831C4A',
  '#333D47',
  '#AC2077',
];

const d3Category10 = d3.scale.category10().range();
const d3Category20 = d3.scale.category20().range();
const d3Category20b = d3.scale.category20b().range();
const d3Category20c = d3.scale.category20c().range();
const googleCategory10c = [
  '#3366cc',
  '#dc3912',
  '#ff9900',
  '#109618',
  '#990099',
  '#0099c6',
  '#dd4477',
  '#66aa00',
  '#b82e2e',
  '#316395',
];
const googleCategory20c = [
  '#3366cc',
  '#dc3912',
  '#ff9900',
  '#109618',
  '#990099',
  '#0099c6',
  '#dd4477',
  '#66aa00',
  '#b82e2e',
  '#316395',
  '#994499',
  '#22aa99',
  '#aaaa11',
  '#6633cc',
  '#e67300',
  '#8b0707',
  '#651067',
  '#329262',
  '#5574a6',
  '#3b3eac',
];
export const ALL_COLOR_SCHEMES = {
  bnbColors,
  d3Category10,
  d3Category20,
  d3Category20b,
  d3Category20c,
  googleCategory10c,
  googleCategory20c,
  lyftColors,
};

export const spectrums = {
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
  dark_blue: [
    '#EBF5F8',
    '#6BB1CC',
    '#357E9B',
    '#1B4150',
    '#092935',
  ],
  pink_grey: [
    '#E70B81',
    '#FAFAFA',
    '#666666',
  ],
  greens: [
    '#ffffcc',
    '#78c679',
    '#006837',
  ],
  purples: [
    '#f2f0f7',
    '#9e9ac8',
    '#54278f',
  ],
  oranges: [
    '#fef0d9',
    '#fc8d59',
    '#b30000',
  ],
  red_yellow_blue: [
    '#d7191c',
    '#fdae61',
    '#ffffbf',
    '#abd9e9',
    '#2c7bb6',
  ],
  brown_white_green: [
    '#a6611a',
    '#dfc27d',
    '#f5f5f5',
    '#80cdc1',
    '#018571',
  ],
  purple_white_green: [
    '#7b3294',
    '#c2a5cf',
    '#f7f7f7',
    '#a6dba0',
    '#008837',
  ],
  schemeBrBG: [
    '#543005',
    '#8c510a',
    '#bf812d',
    '#dfc27d',
    '#f6e8c3',
    '#c7eae5',
    '#80cdc1',
    '#35978f',
    '#01665e',
    '#003c30',
  ],
  schemePRGn: [
    '#40004b',
    '#762a83',
    '#9970ab',
    '#c2a5cf',
    '#e7d4e8',
    '#d9f0d3',
    '#a6dba0',
    '#5aae61',
    '#1b7837',
    '#00441b',
  ],
  schemePiYG: [
    '#8e0152',
    '#c51b7d',
    '#de77ae',
    '#f1b6da',
    '#fde0ef',
    '#e6f5d0',
    '#b8e186',
    '#7fbc41',
    '#4d9221',
    '#276419',
  ],
  schemePuOr: [
    '#2d004b',
    '#542788',
    '#8073ac',
    '#b2abd2',
    '#d8daeb',
    '#fee0b6',
    '#fdb863',
    '#e08214',
    '#b35806',
    '#7f3b08',
  ],
  schemeRdBu: [
    '#67001f',
    '#b2182b',
    '#d6604d',
    '#f4a582',
    '#fddbc7',
    '#d1e5f0',
    '#92c5de',
    '#4393c3',
    '#2166ac',
    '#053061',
  ],
  schemeRdGy: [
    '#67001f',
    '#b2182b',
    '#d6604d',
    '#f4a582',
    '#fddbc7',
    '#e0e0e0',
    '#bababa',
    '#878787',
    '#4d4d4d',
    '#1a1a1a',
  ],
  schemeRdYlBu: [
    '#a50026',
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee090',
    '#e0f3f8',
    '#abd9e9',
    '#74add1',
    '#4575b4',
    '#313695',
  ],
  schemeRdYlGn: [
    '#a50026',
    '#d73027',
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#d9ef8b',
    '#a6d96a',
    '#66bd63',
    '#1a9850',
    '#006837',
  ],
  schemeSpectral: [
    '#9e0142',
    '#d53e4f',
    '#f46d43',
    '#fdae61',
    '#fee08b',
    '#e6f598',
    '#abdda4',
    '#66c2a5',
    '#3288bd',
    '#5e4fa2',
  ],
  schemeBlues: [
    '#b5d4e9',
    '#93c3df',
    '#6daed5',
    '#4b97c9',
    '#2f7ebc',
    '#1864aa',
    '#0a4a90',
    '#08306b',
  ],
  schemeGreens: [
    '#b7e2b1',
    '#97d494',
    '#73c378',
    '#4daf62',
    '#2f984f',
    '#157f3b',
    '#036429',
    '#00441b',
  ],
  schemeGrays: [
    '#cecece',
    '#b4b4b4',
    '#979797',
    '#7a7a7a',
    '#5f5f5f',
    '#404040',
    '#1e1e1e',
    '#000000',
  ],
  schemeOranges: [
    '#fdc28c',
    '#fda762',
    '#fb8d3d',
    '#f2701d',
    '#e25609',
    '#c44103',
    '#9f3303',
    '#7f2704',
  ],
  schemePurples: [
    '#cecee5',
    '#b6b5d8',
    '#9e9bc9',
    '#8782bc',
    '#7363ac',
    '#61409b',
    '#501f8c',
    '#3f007d',
  ],
  schemeReds: [
    '#fcaa8e',
    '#fc8a6b',
    '#f9694c',
    '#ef4533',
    '#d92723',
    '#bb151a',
    '#970b13',
    '#67000d',
  ],
  schemeViridis: [
    '#482475',
    '#414487',
    '#355f8d',
    '#2a788e',
    '#21918c',
    '#22a884',
    '#44bf70',
    '#7ad151',
    '#bddf26',
    '#fde725',
  ],
  schemeInferno: [
    '#160b39',
    '#420a68',
    '#6a176e',
    '#932667',
    '#bc3754',
    '#dd513a',
    '#f37819',
    '#fca50a',
    '#f6d746',
    '#fcffa4',
  ],
  schemeMagma: [
    '#140e36',
    '#3b0f70',
    '#641a80',
    '#8c2981',
    '#b73779',
    '#de4968',
    '#f7705c',
    '#fe9f6d',
    '#fecf92',
    '#fcfdbf',
  ],
  schemeWarm: [
    '#963db3',
    '#bf3caf',
    '#e4419d',
    '#fe4b83',
    '#ff5e63',
    '#ff7847',
    '#fb9633',
    '#e2b72f',
    '#c6d63c',
    '#aff05b',
  ],
  schemeCool: [
    '#6054c8',
    '#4c6edb',
    '#368ce1',
    '#23abd8',
    '#1ac7c2',
    '#1ddfa3',
    '#30ef82',
    '#52f667',
    '#7ff658',
    '#aff05b',
  ],
  schemeCubehelixDefault: [
    '#1a1530',
    '#163d4e',
    '#1f6642',
    '#54792f',
    '#a07949',
    '#d07e93',
    '#cf9cda',
    '#c1caf3',
    '#d2eeef',
    '#ffffff',
  ],
  schemeBuGn: [
    '#b7e4da',
    '#8fd3c1',
    '#68c2a3',
    '#49b17f',
    '#2f9959',
    '#157f3c',
    '#036429',
    '#00441b',
  ],
  schemeBuPu: [
    '#b2cae1',
    '#9cb3d5',
    '#8f95c6',
    '#8c74b5',
    '#8952a5',
    '#852d8f',
    '#730f71',
    '#4d004b',
  ],
  schemeGnBu: [
    '#bde5bf',
    '#9ed9bb',
    '#7bcbc4',
    '#58b7cd',
    '#399cc6',
    '#1d7eb7',
    '#0b60a1',
    '#084081',
  ],
  schemeOrRd: [
    '#fdca94',
    '#fdb07a',
    '#fa8e5d',
    '#f16c49',
    '#e04530',
    '#c81d13',
    '#a70403',
    '#7f0000',
  ],
  schemePuBuGn: [
    '#bec9e2',
    '#98b9d9',
    '#69a8cf',
    '#4096c0',
    '#19879f',
    '#037877',
    '#016353',
    '#014636',
  ],
  schemePuBu: [
    '#bfc9e2',
    '#9bb9d9',
    '#72a8cf',
    '#4394c3',
    '#1a7db6',
    '#0667a1',
    '#045281',
    '#023858',
  ],
  schemePuRd: [
    '#d0aad2',
    '#d08ac2',
    '#dd63ae',
    '#e33890',
    '#d71c6c',
    '#b70b4f',
    '#8f023a',
    '#67001f',
  ],
  schemeRdPu: [
    '#fbb5bc',
    '#f993b0',
    '#f369a3',
    '#e03e98',
    '#c01788',
    '#99037c',
    '#700174',
    '#49006a',
  ],
  schemeYlGnBu: [
    '#d5eeb3',
    '#a9ddb7',
    '#73c9bd',
    '#45b4c2',
    '#2897bf',
    '#2073b2',
    '#234ea0',
    '#1c3185',
    '#081d58',
  ],
  schemeYlGn: [
    '#e4f4ac',
    '#c7e89b',
    '#a2d88a',
    '#78c578',
    '#4eaf63',
    '#2f944e',
    '#15793f',
    '#036034',
    '#004529',
  ],
  schemeYlOrBr: [
    '#feeaa1',
    '#fed676',
    '#feba4a',
    '#fb992c',
    '#ee7918',
    '#d85b0a',
    '#b74304',
    '#8f3204',
    '#662506',
  ],
  schemeYlOrRd: [
    '#fee087',
    '#fec965',
    '#feab4b',
    '#fd893c',
    '#fa5c2e',
    '#ec3023',
    '#d31121',
    '#af0225',
    '#800026',
  ],
};

/**
 * Get a color from a scheme specific palette (scheme)
 * The function cycles through the palette while memoizing labels
 * association to colors. If the function is called twice with the
 * same string, it will return the same color.
 *
 * @param {string} s - The label for which we want to get a color
 * @param {string} scheme - The palette name, or "scheme"
 * @param {string} forcedColor - A color that the caller wants to
 forcibly associate to a label.
 */
export const getColorFromScheme = (function () {
  const seen = {};
  const forcedColors = {};
  return function (s, scheme, forcedColor) {
    if (!s) {
      return;
    }
    const selectedScheme = scheme ? ALL_COLOR_SCHEMES[scheme] : ALL_COLOR_SCHEMES.bnbColors;
    let stringifyS = String(s).toLowerCase();
    // next line is for superset series that should have the same color
    stringifyS = stringifyS.split(', ').filter(k => !TIME_SHIFT_PATTERN.test(k)).join(', ');

    if (forcedColor && !forcedColors[stringifyS]) {
      forcedColors[stringifyS] = forcedColor;
    }
    if (forcedColors[stringifyS]) {
      return forcedColors[stringifyS];
    }

    if (seen[selectedScheme] === undefined) {
      seen[selectedScheme] = {};
    }
    if (seen[selectedScheme][stringifyS] === undefined) {
      seen[selectedScheme][stringifyS] = Object.keys(seen[selectedScheme]).length;
    }
    /* eslint consistent-return: 0 */
    return selectedScheme[seen[selectedScheme][stringifyS] % selectedScheme.length];
  };
}());

export const colorScalerFactory = function (colors, data, accessor, extents) {
  // Returns a linear scaler our of an array of color
  if (!Array.isArray(colors)) {
    /* eslint no-param-reassign: 0 */
    colors = spectrums[colors];
  }
  let ext = [0, 1];
  if (extents) {
    ext = extents;
  }
  if (data) {
    ext = d3.extent(data, accessor);
  }
  const chunkSize = (ext[1] - ext[0]) / (colors.length - 1);
  const points = colors.map((col, i) => ext[0] + (i * chunkSize));
  return d3.scale.linear().domain(points).range(colors).clamp(true);
};

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}
