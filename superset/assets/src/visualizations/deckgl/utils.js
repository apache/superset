import d3 from 'd3';
import getSequentialSchemeRegistry from '../../modules/colors/SequentialSchemeRegistrySingleton';
import { colorScalerFactory, hexToRGB } from '../../modules/colors';

export function getBreakPoints(fd, features) {
  if (fd.break_points === undefined || fd.break_points.length === 0) {
    // compute evenly distributed break points based on number of buckets
    const numBuckets = fd.num_buckets
      ? parseInt(fd.num_buckets, 10)
      : 10;
    const [minValue, maxValue] = d3.extent(features, d => d[fd.metric]);
    const delta = (maxValue - minValue) / numBuckets;
    const precision = delta === 0
      ? 0
      : Math.max(0, Math.ceil(Math.log10(1 / delta)));
    return Array(numBuckets + 1)
      .fill()
      .map((_, i) => (minValue + i * delta).toFixed(precision));
  }
  return fd.break_points.sort((a, b) => parseFloat(a) - parseFloat(b));
}

export function getBreakPointColorScaler(fd, features) {
  const breakPoints = fd.break_points || fd.num_buckets
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

export function getBuckets(fd, features) {
  const breakPoints = getBreakPoints(fd, features, true);
  const colorScaler = getBreakPointColorScaler(fd, features);
  const buckets = {};
  breakPoints.slice(1).forEach((value, i) => {
    const range = breakPoints[i] + ' - ' + breakPoints[i + 1];
    const mid = 0.5 * (parseInt(breakPoints[i], 10) + parseInt(breakPoints[i + 1], 10));
    buckets[range] = {
      color: colorScaler({ [fd.metric]: mid }),
      enabled: true,
    };
  });
  return buckets;
}
