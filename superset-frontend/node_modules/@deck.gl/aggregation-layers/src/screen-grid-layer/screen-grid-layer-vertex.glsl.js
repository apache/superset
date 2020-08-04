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
#version 300 es
#define SHADER_NAME screen-grid-layer-vertex-shader
#define RANGE_COUNT 6

in vec3 positions;
in vec3 instancePositions;
in vec4 instanceCounts;
in vec3 instancePickingColors;

layout(std140) uniform;
uniform float opacity;
uniform vec3 cellScale;
uniform vec4 minColor;
uniform vec4 maxColor;
uniform AggregationData
{
  vec4 maxCount;
} aggregationData;

uniform vec4 colorRange[RANGE_COUNT];
uniform vec2 colorDomain;
uniform bool shouldUseMinMax;

out vec4 vColor;
out float vSampleCount;

vec4 quantizeScale(vec2 domain, vec4 range[RANGE_COUNT], float value) {
  vec4 outColor = vec4(0., 0., 0., 0.);
  if (value >= domain.x && value <= domain.y) {
    float domainRange = domain.y - domain.x;
    if (domainRange <= 0.) {
      outColor = colorRange[0];
    } else {
      float rangeCount = float(RANGE_COUNT);
      float rangeStep = domainRange / rangeCount;
      float idx = floor((value - domain.x) / rangeStep);
      idx = clamp(idx, 0., rangeCount - 1.);
      int intIdx = int(idx);
      outColor = colorRange[intIdx];
    }
  }
  outColor = outColor / 255.;
  return outColor;
}

void main(void) {
  vSampleCount = instanceCounts.a;

  float weight = instanceCounts.r ;
  float maxWeight = aggregationData.maxCount.r;
  float step = weight / maxWeight;
  vec4 minMaxColor = mix(minColor, maxColor, step) / 255.;

  vec2 domain = colorDomain;
  float domainMaxValid = float(colorDomain.y != 0.);
  domain.y = mix(maxWeight, colorDomain.y, domainMaxValid);
  vec4 rangeColor = quantizeScale(domain, colorRange, weight);

  float rangeMinMax = float(shouldUseMinMax);
  vec4 color = mix(rangeColor, minMaxColor, rangeMinMax);
  vColor = vec4(color.rgb, color.a * opacity);

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);

  gl_Position = vec4(instancePositions + positions * cellScale, 1.);
}
`;
