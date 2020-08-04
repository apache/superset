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

// Inspired by screen-grid-layer vertex shader in deck.gl

export default `\
#version 300 es
#define SHADER_NAME gpu-grid-cell-layer-vertex-shader
#define RANGE_COUNT 6

in vec3 positions;
in vec3 normals;

in vec4 colors;
in vec4 elevations;
in vec3 instancePickingColors;

// Custom uniforms
uniform vec2 offset;
uniform bool extruded;
uniform float cellSize;
uniform float coverage;
uniform float opacity;
uniform float elevationScale;

uniform ivec2 gridSize;
uniform vec2 gridOrigin;
uniform vec2 gridOriginLow;
uniform vec2 gridOffset;
uniform vec2 gridOffsetLow;
uniform vec4 colorRange[RANGE_COUNT];
uniform vec2 elevationRange;

// Domain uniforms
uniform vec2 colorDomain;
uniform bool colorDomainValid;
uniform vec2 elevationDomain;
uniform bool elevationDomainValid;

layout(std140) uniform;
uniform ColorData
{
  vec4 maxMinCount;
} colorData;
uniform ElevationData
{
  vec4 maxMinCount;
} elevationData;

#define EPSILON 0.00001

// Result
out vec4 vColor;

vec4 quantizeScale(vec2 domain, vec4 range[RANGE_COUNT], float value) {
  vec4 outColor = vec4(0., 0., 0., 0.);
  if (value >= (domain.x - EPSILON) && value <= (domain.y + EPSILON)) {
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
  return outColor;
}

float linearScale(vec2 domain, vec2 range, float value) {
  if (value >= (domain.x - EPSILON) && value <= (domain.y + EPSILON)) {
    return ((value - domain.x) / (domain.y - domain.x)) * (range.y - range.x) + range.x;
  }
  return -1.;
}

void main(void) {

  vec2 clrDomain = colorDomainValid ? colorDomain : vec2(colorData.maxMinCount.a, colorData.maxMinCount.r);
  vec4 color = quantizeScale(clrDomain, colorRange, colors.r);

  float elevation = 0.0;

  if (extruded) {
    vec2 elvDomain = elevationDomainValid ? elevationDomain : vec2(elevationData.maxMinCount.a, elevationData.maxMinCount.r);
    elevation = linearScale(elvDomain, elevationRange, elevations.r);
    elevation = elevation  * (positions.z + 1.0) / 2.0 * elevationScale;
  }

  // if aggregated color or elevation is 0 do not render
  float shouldRender = float(color.r > 0.0 && elevations.r >= 0.0);
  float dotRadius = cellSize / 2. * coverage * shouldRender;

  int yIndex = (gl_InstanceID / gridSize[0]);
  int xIndex = gl_InstanceID - (yIndex * gridSize[0]);

  vec2 instancePositionXFP64 = mul_fp64(vec2(gridOffset[0], gridOffsetLow[0]), vec2(float(xIndex), 0.));
  instancePositionXFP64 = sum_fp64(instancePositionXFP64, vec2(gridOrigin[0], gridOriginLow[0]));
  vec2 instancePositionYFP64 = mul_fp64(vec2(gridOffset[1], gridOffsetLow[1]), vec2(float(yIndex), 0.));
  instancePositionYFP64 = sum_fp64(instancePositionYFP64, vec2(gridOrigin[1], gridOriginLow[1]));

  vec3 centroidPosition = vec3(instancePositionXFP64[0], instancePositionYFP64[0], elevation);
  vec2 centroidPosition64xyLow = vec2(instancePositionXFP64[1], instancePositionYFP64[1]);
  vec3 pos = vec3(project_size(positions.xy + offset) * dotRadius, 0.);

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);

  vec4 position_commonspace;
  gl_Position = project_position_to_clipspace(centroidPosition, centroidPosition64xyLow, pos, position_commonspace);

  // Light calculations
  // Worldspace is the linear space after Mercator projection

  vec3 normals_commonspace = project_normal(normals);

   if (extruded) {
    vec3 lightColor = lighting_getLightColor(color.rgb, project_uCameraPosition, position_commonspace.xyz, normals_commonspace);
    vColor = vec4(lightColor, color.a * opacity) / 255.;
  } else {
    vColor = vec4(color.rgb, color.a * opacity) / 255.;
  }
}
`;
