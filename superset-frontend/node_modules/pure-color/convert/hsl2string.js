function hsl2string(hsl) {
  var scheme = "hsl";

  if(hsl.length === 4) {
    scheme += "a";
  }

  hsl[0] = Math.round(hsl[0]);
  hsl[1] = Math.round(hsl[1]) + "%";
  hsl[2] = Math.round(hsl[2]) + "%";

  return scheme + "(" + hsl.join(",") + ")";
}

module.exports = hsl2string;