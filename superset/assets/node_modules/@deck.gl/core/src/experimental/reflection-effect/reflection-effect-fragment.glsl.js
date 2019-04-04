// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

export default `\
#define SHADER_NAME reflection-effect-fs

#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D reflectionTexture;
uniform int reflectionTextureWidth;
uniform int reflectionTextureHeight;

uniform float reflectivity;
uniform float blur;


varying vec2 uv;

#define KERNEL_SIZE 7

/*
 * Samples from tex with a gaussian-shaped patch, centered at uv and
 * with standard deviation sigma.  The size of the texture in
 * pixels must be specified by dim
 */
vec4 sample_gaussian(sampler2D tex, vec2 dim, vec2 uv, float sigma) {
  if (sigma == 0.0) {
    return texture2D(tex, uv);
  }

  vec2 delta = 1.0 / dim;
  vec2 top_left = uv - delta * float(KERNEL_SIZE+1) / 2.0;

  vec4 color = vec4(0);
  float sum = 0.0;
  for (int i = 0; i <  KERNEL_SIZE; ++i) {
    for (int j = 0; j < KERNEL_SIZE; ++j) {
      vec2 uv2 = top_left + vec2(i, j) * delta;
      float d = length((uv2 - uv) * dim);
      float f = exp(-(d*d) / (2.0*sigma * sigma));
      color += f * texture2D(tex, uv2);
      sum += f;
    }
  }
  return color / sum;
}

void main(void) {
  //map blur in [0, 1] to sigma in [0, inf]
  //alpha will determine the "steepness" of our curve.
  //this was picked just to make the scale feel "natural"
  //if our image is 1000 pixels wide, a blur of 0.5 should correspond
  //to a sigma of 1 pixels
  float alpha = 1000.0;
  float sigma = blur / (alpha * (1.0 - blur));
  //let this be our standard deviation in terms of screen-widths.
  //rewrite this in terms of pixels.
  sigma *= float(reflectionTextureWidth);


  gl_FragColor = sample_gaussian(reflectionTexture, vec2(reflectionTextureWidth,
    reflectionTextureHeight), vec2(uv.x, 1. - uv.y), sigma);
  //because our canvas expects alphas to be pre-multiplied, we multiply by whole
  //color vector by reflectivity, not just the alpha channel
  gl_FragColor *= reflectivity;
}
`;
