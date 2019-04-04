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
#define SHADER_NAME grid-cell-layer-vertex-shader

attribute vec3 positions;
attribute vec3 normals;

attribute vec3 instancePositions;
attribute vec2 instancePositions64xyLow;
attribute float instanceElevations;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;

// Custom uniforms
uniform float extruded;
uniform float cellSize;
uniform float coverage;
uniform float opacity;
uniform float elevationScale;

// A magic number to scale elevation so that 1 unit approximate to 1 meter
#define ELEVATION_SCALE 0.8

// Result
varying vec4 vColor;

void main(void) {

  // if ahpha == 0.0 or z < 0.0, do not render element
  float noRender = float(instanceColors.a == 0.0 || instanceElevations < 0.0);
  float finalCellSize = project_scale(cellSize) * mix(1.0, 0.0, noRender);

  float elevation = 0.0;

  if (extruded > 0.5) {
    elevation = instanceElevations  * (positions.z + 1.0) *
      ELEVATION_SCALE * elevationScale;
  }

  // cube geometry vertics are between -1 to 1, scale and transform it to between 0, 1
  vec3 extrudedPosition = vec3(instancePositions.xy, elevation);
  vec2 extrudedPosition64xyLow = instancePositions64xyLow;
  vec3 offset = vec3(
    (positions.x * coverage + 1.0) / 2.0 * finalCellSize,
    (positions.y * coverage - 1.0) / 2.0 * finalCellSize,
    1.0);

  // extrude positions
  vec4 position_worldspace;
  gl_Position = project_position_to_clipspace(extrudedPosition, extrudedPosition64xyLow, offset, position_worldspace);

  float lightWeight = 1.0;

  if (extruded > 0.5) {
    lightWeight = lighting_getLightWeight(
      position_worldspace.xyz, // the w component is always 1.0
      normals
    );
  }

  vec3 lightWeightedColor = lightWeight * instanceColors.rgb;
  vec4 color = vec4(lightWeightedColor, instanceColors.a * opacity) / 255.0;
  vColor = color;

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);
}
`;
