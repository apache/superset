import d3 from 'd3';
import getSequentialSchemeRegistry from '../../modules/colors/SequentialSchemeRegistrySingleton';
import { colorScalerFactory } from '../../modules/colors';

export function getBreakPoints(fd, features) {
  if (fd.break_points === undefined || fd.break_points.length === 0) {
    // compute evenly distributed break points based on number of categories
    const numCategories = fd.num_categories
      ? parseInt(fd.num_categories, 10)
      : 10;
    const [minValue, maxValue] = d3.extent(features, d => d[fd.metric]);
    const delta = (maxValue - minValue) / numCategories;
    const precision = delta === 0
      ? 0
      : Math.max(0, Math.ceil(Math.log10(1 / delta)));
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
  const breakPoints = fd.break_points || fd.num_categories
    ? getBreakPoints(fd, features)
    : null;
  const colors = Array.isArray(fd.linear_color_scheme)
    ? fd.linear_color_scheme
    : getSequentialSchemeRegistry().get(fd.linear_color_scheme).colors;

  let scaler;
  let maskPoint;
  if (breakPoints !== null) {
    // bucket colors into discrete colors
    const colorScaler = colorScalerFactory(colors);
    const n = breakPoints.length - 1;
    const bucketedColors = n > 1
      ? [...Array(n).keys()].map(d => colorScaler(d / (n - 1)))
      : [colors[colors.length - 1]];

    // repeat ends
    bucketedColors.unshift(bucketedColors[0]);
    bucketedColors.push(bucketedColors[n - 1]);

    const points = breakPoints.map(p => parseFloat(p));
    scaler = d3.scale.threshold().domain(points).range(bucketedColors);
    maskPoint = value => value > breakPoints[n] || value < breakPoints[0];
  } else {
    // interpolate colors linearly
    scaler = colorScalerFactory(colors, features, d => d[fd.metric]);
    maskPoint = () => false;
  }

  return (d) => {
    const c = hexToRGB(scaler(d[fd.metric]));
    if (maskPoint(d[fd.metric])) {
      c[3] = 0;
    } else {
      c[3] = (fd.opacity / 100.0) * 255;
    }
    return c;
  };
}

export function getCategories(features, fd) {
  const breakPoints = getBreakPoints(fd, features, true);
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
