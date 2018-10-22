import d3 from 'd3';
import sequentialSchemes from '../../modules/colorSchemes/sequential';
import { colorScalerFactory } from '../../modules/colors';

export function getAlpha(value, breakPoints) {
  const i = breakPoints.map(point => point >= value).indexOf(true);
  return i === -1 ? 1 : i / (breakPoints.length - 1);
}

export function getBreakPoints(fd, features) {
  if (fd.break_points === undefined || fd.break_points.length === 0) {
    let colors = fd.linear_color_scheme;
    if (!Array.isArray(colors)) {
      colors = sequentialSchemes[colors];
    }
    const numCategories = fd.num_categories === null 
      ? colors.length
      : parseInt(fd.num_categories, 10);
    const [minValue, maxValue] = d3.extent(features, d => d[fd.metric]);
    const delta = (maxValue - minValue) / numCategories;
    const precision = delta === 0
      ? 0
      : Math.max(0, Math.floor(Math.log10(numCategories / delta)));
    return Array(numCategories + 1)
      .fill()
      .map((_, i) => (minValue + i * delta).toFixed(precision));
  }
  return fd.break_points.sort((a, b) => parseFloat(a) - parseFloat(b));
}

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

export function getBreakPointColorScaler(fd, features) {
  const breakPoints = getBreakPoints(fd, features);
  let colors = fd.linear_color_scheme;
  if (!Array.isArray(colors)) {
    colors = sequentialSchemes[colors];
  }

  // bucket colors
  const colorScaler = colorScalerFactory(colors);
  const n = breakPoints.length - 1;
  colors = [...Array(n + 1).keys()].map(d => colorScaler(d / n));
  // repeat last color, since the last point does not fall in the last bucket
  // since ranges are [start, end)
  colors.push(colors[colors.length - 1]);

  const points = breakPoints.map(p => parseFloat(p));
  const scaler = d3.scale.threshold().domain(points).range(colors);
  return (d) => {
    const c = hexToRGB(scaler(d[fd.metric]));
    if (d[fd.metric] > breakPoints[n] || d[fd.metric] < breakPoints[0]) {
      c[3] = 0;
    } else {
      c[3] = (fd.opacity / 100.0) * 255;
    }
    return c;
  };
}

export function getCategories(features, fd) {
  const breakPoints = getBreakPoints(fd, features);
  const colorScaler = getBreakPointColorScaler(fd, features);
  const categories = {};
  breakPoints.slice(1).forEach((value, i) => {
    const range = breakPoints[i] + ' - ' + breakPoints[i + 1];
    const mid = 0.5 * (parseInt(breakPoints[i], 10) + parseInt(breakPoints[i + 1], 10));
    categories[range] = {
      color: colorScaler({ [fd.metric]: mid }),
      enabled: true,
    };
  });
  return categories;
}
