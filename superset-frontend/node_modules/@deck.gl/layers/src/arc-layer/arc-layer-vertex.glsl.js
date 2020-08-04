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
#define SHADER_NAME arc-layer-vertex-shader

attribute vec3 positions;
attribute vec4 instanceSourceColors;
attribute vec4 instanceTargetColors;
attribute vec4 instancePositions;
attribute vec4 instancePositions64Low;
attribute vec3 instancePickingColors;
attribute float instanceWidths;
attribute float instanceHeights;
attribute float instanceTilts;

uniform float numSegments;
uniform float opacity;
uniform float widthScale;
uniform float widthMinPixels;
uniform float widthMaxPixels;

varying vec4 vColor;

float paraboloid(vec2 source, vec2 target, float ratio) {

  vec2 x = mix(source, target, ratio);
  vec2 center = mix(source, target, 0.5);

  float dSourceCenter = distance(source, center);
  float dXCenter = distance(x, center);
  return (dSourceCenter + dXCenter) * (dSourceCenter - dXCenter);
}

// offset vector by strokeWidth pixels
// offset_direction is -1 (left) or 1 (right)
vec2 getExtrusionOffset(vec2 line_clipspace, float offset_direction, float width) {
  // normalized direction of the line
  vec2 dir_screenspace = normalize(line_clipspace * project_uViewportSize);
  // rotate by 90 degrees
  dir_screenspace = vec2(-dir_screenspace.y, dir_screenspace.x);

  vec2 offset_screenspace = dir_screenspace * offset_direction * width / 2.0;
  vec2 offset_clipspace = project_pixel_size_to_clipspace(offset_screenspace);

  return offset_clipspace;
}

float getSegmentRatio(float index) {
  return smoothstep(0.0, 1.0, index / (numSegments - 1.0));
}

vec3 getPos(vec2 source, vec2 target, float segmentRatio) {
  float vertexHeight = sqrt(max(0.0, paraboloid(source, target, segmentRatio))) * instanceHeights;

  float tiltAngle = radians(instanceTilts);
  vec2 tiltDirection = normalize(target - source);
  vec2 tilt = vec2(-tiltDirection.y, tiltDirection.x) * vertexHeight * sin(tiltAngle);

  return vec3(
    mix(source, target, segmentRatio) + tilt,
    vertexHeight * cos(tiltAngle)
  );
}

void main(void) {
  vec2 source = project_position(vec3(instancePositions.xy, 0.0), instancePositions64Low.xy).xy;
  vec2 target = project_position(vec3(instancePositions.zw, 0.0), instancePositions64Low.zw).xy;

  float segmentIndex = positions.x;
  float segmentRatio = getSegmentRatio(segmentIndex);
  // if it's the first point, use next - current as direction
  // otherwise use current - prev
  float indexDir = mix(-1.0, 1.0, step(segmentIndex, 0.0));
  float nextSegmentRatio = getSegmentRatio(segmentIndex + indexDir);

  vec3 currPos = getPos(source, target, segmentRatio);
  vec3 nextPos = getPos(source, target, nextSegmentRatio);
  vec4 curr = project_common_position_to_clipspace(vec4(currPos, 1.0));
  vec4 next = project_common_position_to_clipspace(vec4(nextPos, 1.0));

  // Multiply out width and clamp to limits
  // mercator pixels are interpreted as screen pixels
  float widthPixels = clamp(
    project_size_to_pixel(instanceWidths * widthScale),
    widthMinPixels, widthMaxPixels
  );

  // extrude
  vec2 offset = getExtrusionOffset((next.xy - curr.xy) * indexDir, positions.y, widthPixels);
  gl_Position = curr + vec4(offset, 0.0, 0.0);

  vec4 color = mix(instanceSourceColors, instanceTargetColors, segmentRatio) / 255.;
  vColor = vec4(color.rgb, color.a * opacity);

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);
}
`;
