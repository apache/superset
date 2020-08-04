// Private shader module used by `Transform`

const vs = `\
attribute float transform_elementID;

// returns half of pixel size, used to move the pixel position to center of the pixel.
vec2 transform_getPixelSizeHalf(vec2 size) {
  return vec2(1.) / (2. * size);
}

// returns current elements pixel indeces [x, y],
// where x ranges in [0 to texSize-1] and y ranges in [0 to texSize-1]
vec2 transform_getPixelIndices(vec2 texSize, vec2 pixelSizeHalf) {
  // Add safe offset (half of pixel height) before doing floor
  float yIndex = floor((transform_elementID / texSize[0]) + pixelSizeHalf[1]);
  float xIndex = transform_elementID - (yIndex * texSize[0]);
  return vec2(xIndex, yIndex);
}

// returns current elementID's texture co-ordianate
vec2 transform_getTexCoord(vec2 size) {
  vec2 pixelSizeHalf = transform_getPixelSizeHalf(size);
  vec2 indices = transform_getPixelIndices(size, pixelSizeHalf);
  vec2 coord = indices / size + pixelSizeHalf;
  return coord;
}

// returns current elementID's position
vec2 transform_getPos(vec2 size) {
  vec2 texCoord = transform_getTexCoord(size);
  // Change from [0 1] range to [-1 1]
  vec2 pos = (texCoord * (2.0, 2.0)) - (1., 1.);
  return pos;
}

// returns current elementID's pixel value
vec4 transform_getInput(sampler2D texSampler, vec2 size) {
  vec2 texCoord = transform_getTexCoord(size);
  vec4 textureColor = texture2D(texSampler, texCoord);
  return textureColor;
}
`;

export default {
  name: 'transform',
  vs,
  fs: null
};
