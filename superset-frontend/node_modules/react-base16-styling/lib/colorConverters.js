"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.yuv2rgb = yuv2rgb;
exports.rgb2yuv = rgb2yuv;
function yuv2rgb(yuv) {
  var y = yuv[0],
      u = yuv[1],
      v = yuv[2],
      r,
      g,
      b;

  r = y * 1 + u * 0 + v * 1.13983;
  g = y * 1 + u * -0.39465 + v * -0.58060;
  b = y * 1 + u * 2.02311 + v * 0;

  r = Math.min(Math.max(0, r), 1);
  g = Math.min(Math.max(0, g), 1);
  b = Math.min(Math.max(0, b), 1);

  return [r * 255, g * 255, b * 255];
}

function rgb2yuv(rgb) {
  var r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255;

  var y = r * 0.299 + g * 0.587 + b * 0.114;
  var u = r * -0.14713 + g * -0.28886 + b * 0.436;
  var v = r * 0.615 + g * -0.51499 + b * -0.10001;

  return [y, u, v];
};