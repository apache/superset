// Copyright (c) 2015 - 2018 Uber Technologies, Inc.
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
#version 300 es
#define SHADER_NAME gpu-aggregation-all-vs-64

in vec2 position;
uniform ivec2 gridSize;
out vec2 vTextureCoord;

void main(void) {
  // Map each position to single pixel
  vec2 pos = vec2(-1.0, -1.0);

  // Move to pixel center, pixel-size in screen sapce (2/gridSize) * 0.5 => 1/gridSize
  vec2 offset = 1.0 / vec2(gridSize);
  pos = pos + offset;

  gl_Position = vec4(pos, 0.0, 1.0);

  int yIndex = gl_InstanceID / gridSize[0];
  int xIndex = gl_InstanceID - (yIndex * gridSize[0]);

  vec2 yIndexFP64 = vec2(float(yIndex), 0.);
  vec2 xIndexFP64 = vec2(float(xIndex), 0.);
  vec2 gridSizeYFP64 = vec2(gridSize[1], 0.);
  vec2 gridSizeXFP64 = vec2(gridSize[0], 0.);

  vec2 texCoordXFP64 = div_fp64(yIndexFP64, gridSizeYFP64);
  vec2 texCoordYFP64 = div_fp64(xIndexFP64, gridSizeXFP64);

  vTextureCoord = vec2(texCoordYFP64.x, texCoordXFP64.x);
}
`;
