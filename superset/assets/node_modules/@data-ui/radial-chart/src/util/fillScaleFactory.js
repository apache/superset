/* eslint import/prefer-default-export: 0 */
import { scaleOrdinal } from '@vx/scale';
import { allColors, grayColors, getPaletteForBrightness } from '@data-ui/theme/build/color';

// returns an ordinal scale of multi-hue colors with normalized/comparable brightness
export function multiHueScaleFactory(brightness, hues) {
  return scaleOrdinal({ range: getPaletteForBrightness(brightness, hues) });
}

// returns an ordinal scale of single-hue colors with varying brightness (dark to light)
// if no hue is specified or is invalid, returns grays
export function singleHueScaleFactory(hue) {
  return scaleOrdinal({ range: [...(allColors[hue] || grayColors)].reverse() });
}
