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
#define SHADER_NAME path-layer-fragment-shader

precision highp float;

uniform float jointType;
uniform float miterLimit;
uniform float alignMode;

varying vec4 vColor;
varying vec2 vCornerOffset;
varying float vMiterLength;
varying vec2 vDashArray;
/*
 * vPathPosition represents the relative coordinates of the current fragment on the path segment.
 * vPathPosition.x - position along the width of the path, between [-1, 1]. 0 is the center line.
 * vPathPosition.y - position along the length of the path, between [0, L / width].
 */
varying vec2 vPathPosition;
varying float vPathLength;

// mod doesn't work correctly for negative numbers
float mod2(float a, float b) {
  return a - floor(a / b) * b;
}

float round(float x) {
  return floor(x + 0.5);
}

// if given position is in the gap part of the dashed line
// dashArray.x: solid stroke length, relative to width
// dashArray.y: gap length, relative to width
// alignMode:
// 0 - no adjustment
// o----     ----     ----     ---- o----     -o----     ----     o
// 1 - stretch to fit, draw half dash at each end for nicer joints
// o--    ----    ----    ----    --o--      --o--     ----     --o
bool dash_isFragInGap() {
  float solidLength = vDashArray.x;
  float gapLength = vDashArray.y;

  float unitLength = solidLength + gapLength;

  if (unitLength == 0.0) {
    return false;
  }

  unitLength = mix(
    unitLength,
    vPathLength / round(vPathLength / unitLength),
    alignMode
  );

  float offset = alignMode * solidLength / 2.0;

  return gapLength > 0.0 &&
    vPathPosition.y >= 0.0 &&
    vPathPosition.y <= vPathLength &&
    mod2(vPathPosition.y + offset, unitLength) > solidLength;
}

void main(void) {
  // if joint is rounded, test distance from the corner
  if (jointType > 0.0 && vMiterLength > 0.0 && length(vCornerOffset) > 1.0) {
    // Enable to debug joints
    // gl_FragColor = vec4(0., 1., 0., 1.);
    // return;
    discard;
  }
  if (jointType == 0.0 && vMiterLength > miterLimit) {
    // Enable to debug joints
    // gl_FragColor = vec4(0., 0., 1., 1.);
    // return;
    discard;
  }
  if (vColor.a == 0.0 || dash_isFragInGap()) {
    // Enable to debug joints
    // gl_FragColor = vec4(0., 1., 1., 1.);
    // return;
    discard;
  }
  gl_FragColor = vColor;

  // use highlight color if this fragment belongs to the selected object.
  gl_FragColor = picking_filterHighlightColor(gl_FragColor);

  // use picking color if rendering to picking FBO.
  gl_FragColor = picking_filterPickingColor(gl_FragColor);
}
`;
