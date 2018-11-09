import { rgb } from 'd3-color';

export function hexToRGB(hex, alpha = 255) {
  if (!hex) {
    return [0, 0, 0, alpha];
  }
  const { r, g, b } = rgb(hex);
  return [r, g, b, alpha];
}
