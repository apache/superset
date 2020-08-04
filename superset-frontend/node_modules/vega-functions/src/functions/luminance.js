import {rgb} from 'd3-color';

// https://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
function channel_luminance_value(channelValue) {
  const val = channelValue / 255;
  if (val <= 0.03928) {
    return val / 12.92;
  }
  return Math.pow((val + 0.055) / 1.055, 2.4);
}

export function luminance(color) {
  const c = rgb(color),
        r = channel_luminance_value(c.r),
        g = channel_luminance_value(c.g),
        b = channel_luminance_value(c.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// https://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef
export function contrast(color1, color2) {
  const lum1 = luminance(color1),
        lum2 = luminance(color2),
        lumL = Math.max(lum1, lum2),
        lumD = Math.min(lum1, lum2);
  return (lumL + 0.05) / (lumD + 0.05);
}
