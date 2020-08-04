function rgb2grayscale (rgb) {
  return (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
}

module.exports = rgb2grayscale;