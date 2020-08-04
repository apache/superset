module.exports = {
  cmyk : {
    rgb : require("./cmyk2rgb")
  },
  hsl : {
    hsv  : require("./hsl2hsv"),
    rgb  : require("./hsl2rgb"),
    string : require("./hsl2string")
  },
  hsv : {
    hsl  : require("./hsv2hsl"),
    rgb  : require("./hsv2rgb")
  },
  hwb : {
    rgb  : require("./hwb2rgb")
  },
  lab : {
    lch  : require("./lab2lch"),
    xyz  : require("./lab2xyz")
  },
  lch : {
    lab  : require("./lch2lab")
  },
  rgb : {
    cmyk : require("./rgb2cmyk"),
    hex  : require("./rgb2hex"),
    hsl  : require("./rgb2hsl"),
    hsv  : require("./rgb2hsv"),
    hwb  : require("./rgb2hwb"),
    lab  : require("./rgb2lab"),
    xyz  : require("./rgb2xyz"),
    grayscale : require("./rgb2grayscale"),
    string : require("./rgb2string")
  },
  xyz : {
    lab  : require("./xyz2lab"),
    rgb  : require("./xyz2rgb")
  }
};