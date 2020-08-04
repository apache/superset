function rgb2string(rgb) {
  var scheme = "rgb";

  if(rgb.length === 4) {
    scheme += "a";
  }

  rgb[0] = Math.round(rgb[0]);
  rgb[1] = Math.round(rgb[1]);
  rgb[2] = Math.round(rgb[2]);

  return scheme + "(" + rgb.join(",") + ")";
}

module.exports = rgb2string;