import d3 from 'd3';
import { getScale } from './CategoricalColorNamespace';
import sequentialSchemes from './colorSchemes/sequential';
import airbnb from './colorSchemes/airbnb';
import lyft from './colorSchemes/lyft';

export const brandColor = '#00A699';
export const colorPrimary = { r: 0, g: 122, b: 135, a: 1 };
export const bnbColors = airbnb.bnbColors;
export const lyftColors = lyft.lyftColors;

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b, alpha];
}

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
export function getColorFromScheme(value, schemeName, forcedColor) {
  const scale = getScale(schemeName);
  if (forcedColor) {
    scale.setColor(value, forcedColor);
    return forcedColor;
  }
  return scale.getColor(value);
}

export const colorScalerFactory = function (colors, data, accessor, extents, outputRGBA = false) {
  // Returns a linear scaler our of an array of color
  if (!Array.isArray(colors)) {
    /* eslint no-param-reassign: 0 */
    colors = sequentialSchemes[colors];
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
  const scaler = d3.scale.linear().domain(points).range(colors).clamp(true);
  if (outputRGBA) {
    return v => hexToRGB(scaler(v));
  }
  return scaler;
};
