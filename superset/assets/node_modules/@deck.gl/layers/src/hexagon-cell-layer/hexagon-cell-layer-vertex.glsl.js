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

#define SHADER_NAME hexagon-cell-layer-vertex-shader

attribute vec3 positions;
attribute vec3 normals;

attribute vec2 instancePositions;
attribute float instanceElevations;
attribute vec2 instancePositions64xyLow;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;

// Custom uniforms
uniform float opacity;
uniform float radius;
uniform float angle;
uniform float extruded;
uniform float coverage;
uniform float elevationScale;

// Result
varying vec4 vColor;

// A magic number to scale elevation so that 1 unit approximate to 1 meter.
#define ELEVATION_SCALE 0.8

void main(void) {

  // rotate primitive position and normal
  mat2 rotationMatrix = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));

  // calculate elevation, if 3d not enabled set to 0
  // cylindar gemoetry height are between -0.5 to 0.5, transform it to between 0, 1
  float elevation = 0.0;

  if (extruded > 0.5) {
    elevation = instanceElevations * (positions.z + 0.5) *
      ELEVATION_SCALE * elevationScale;
  }

  // if ahpha == 0.0 or z < 0.0, do not render element
  float noRender = float(instanceColors.a == 0.0 || instanceElevations < 0.0);
  float dotRadius = project_scale(radius) * mix(coverage, 0.0, noRender);

  // project center of hexagon
  vec3 centroidPosition = vec3(instancePositions, elevation);
  vec2 centroidPosition64xyLow = instancePositions64xyLow;
  vec3 offset = vec3(rotationMatrix * positions.xy * dotRadius, 0.);

  vec4 position_worldspace;
  gl_Position = project_position_to_clipspace(centroidPosition, centroidPosition64xyLow, offset, position_worldspace);

  // Light calculations
  // Worldspace is the linear space after Mercator projection

  vec3 normals_worldspace = vec3(rotationMatrix * normals.xy, normals.z);

  float lightWeight = 1.0;

  if (extruded > 0.5) {
    lightWeight = lighting_getLightWeight(
      position_worldspace.xyz, // the w component is always 1.0
      normals_worldspace
    );
  }

  vec3 lightWeightedColor = lightWeight * instanceColors.rgb;

  // opacity-multiplied instance color
  vColor = vec4(lightWeightedColor, opacity * instanceColors.a) / 255.0;

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);
}
`;
