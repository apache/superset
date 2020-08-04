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
#define SHADER_NAME path-layer-vertex-shader

attribute vec3 positions;

attribute vec3 instanceStartPositions;
attribute vec3 instanceEndPositions;
attribute vec4 instanceStartEndPositions64xyLow;
attribute vec3 instanceLeftPositions;
attribute vec3 instanceRightPositions;
attribute vec4 instanceNeighborPositions64xyLow;
attribute float instanceStrokeWidths;
attribute vec4 instanceColors;
attribute vec3 instancePickingColors;
attribute vec2 instanceDashArrays;

uniform float widthScale;
uniform float widthMinPixels;
uniform float widthMaxPixels;
uniform float jointType;
uniform float miterLimit;
uniform bool billboard;

uniform float opacity;

varying vec4 vColor;
varying vec2 vCornerOffset;
varying float vMiterLength;
varying vec2 vDashArray;
varying vec2 vPathPosition;
varying float vPathLength;

const float EPSILON = 0.001;
const vec3 ZERO_OFFSET = vec3(0.0);

float flipIfTrue(bool flag) {
  return -(float(flag) * 2. - 1.);
}

// calculate line join positions
vec3 lineJoin(
  vec3 prevPoint, vec3 currPoint, vec3 nextPoint,
  float relativePosition, bool isEnd, bool isJoint,
  vec2 width
) {
  vec2 deltaA = (currPoint.xy - prevPoint.xy) / width;
  vec2 deltaB = (nextPoint.xy - currPoint.xy) / width;

  float lenA = length(deltaA);
  float lenB = length(deltaB);

  // when two points are closer than PIXEL_EPSILON in pixels,
  // assume they are the same point to avoid precision issue
  lenA = lenA > EPSILON ? lenA : 0.0;
  lenB = lenB > EPSILON ? lenB : 0.0;

  vec2 dirA = lenA > 0. ? normalize(deltaA) : vec2(0.0, 0.0);
  vec2 dirB = lenB > 0. ? normalize(deltaB) : vec2(0.0, 0.0);

  vec2 perpA = vec2(-dirA.y, dirA.x);
  vec2 perpB = vec2(-dirB.y, dirB.x);

  // tangent of the corner
  vec2 tangent = vec2(dirA + dirB);
  tangent = length(tangent) > 0. ? normalize(tangent) : perpA;
  // direction of the corner
  vec2 miterVec = vec2(-tangent.y, tangent.x);
  // width offset from current position
  vec2 perp = isEnd ? perpA : perpB;
  float L = isEnd ? lenA : lenB;

  // cap super sharp angles
  float sinHalfA = abs(dot(miterVec, perp));
  float cosHalfA = abs(dot(dirA, miterVec));

  bool turnsRight = dirA.x * dirB.y > dirA.y * dirB.x;

  float offsetScale = 1.0 / max(sinHalfA, EPSILON);

  float cornerPosition = isJoint ?
    0.0 :
    flipIfTrue(turnsRight == (relativePosition > 0.0));

  // do not bevel if line segment is too short
  cornerPosition *=
    float(cornerPosition <= 0.0 || sinHalfA < min(lenA, lenB) * cosHalfA);

  // trim if inside corner extends further than the line segment
  if (cornerPosition < 0.0) {
    offsetScale = min(offsetScale, L / max(cosHalfA, EPSILON));
  }

  vMiterLength = cornerPosition >= 0.0 ?
    mix(offsetScale, 0.0, cornerPosition) :
    offsetScale * cornerPosition;
  vMiterLength -= sinHalfA * jointType;

  float offsetDirection = mix(
    positions.y,
    mix(
      flipIfTrue(turnsRight),
      positions.y * flipIfTrue(turnsRight == (positions.x == 1.)),
      cornerPosition
    ),
    step(0.0, cornerPosition)
  );

  vec2 offsetVec = mix(miterVec, -tangent, step(0.5, cornerPosition));
  offsetScale = mix(offsetScale, 1.0 / max(cosHalfA, 0.001), step(0.5, cornerPosition));

  // special treatment for start cap and end cap
  // TODO - This has an issue. len is always positive because it is length.
  // Step returns zero if -lenA<0, so practically this is a comparison of
  // lenA with zero, with lots of problems because of the -lenA. Can we use EPSILON?
  bool isStartCap = step(0.0, -lenA) > 0.5;
  bool isEndCap = step(0.0, -lenB) > 0.5;
  bool isCap = isStartCap || isEndCap;

  // 0: center, 1: side
  cornerPosition = isCap ? (1.0 - positions.z) : 0.;

  // start of path: use next - curr
  if (isStartCap) {
    offsetVec = mix(dirB, perpB, cornerPosition);
  }

  // end of path: use curr - prev
  if (isEndCap) {
    offsetVec = mix(dirA, perpA, cornerPosition);
  }

  // extend out a triangle to envelope the round cap
  if (isCap) {
    offsetScale = mix(4.0 * jointType, 1.0, cornerPosition);
    vMiterLength = 1.0 - cornerPosition;
    offsetDirection = mix(flipIfTrue(isStartCap), positions.y, cornerPosition);
  }

  vCornerOffset = offsetVec * offsetDirection * offsetScale;

  // Generate variables for dash calculation
  vDashArray = instanceDashArrays;
  vPathLength = L;
  // vec2 offsetFromStartOfPath = isEnd ? vCornerOffset + deltaA : vCornerOffset;
  vec2 offsetFromStartOfPath = vCornerOffset;
  if (isEnd) {
    offsetFromStartOfPath += deltaA;
  }
  vec2 dir = isEnd ? dirA : dirB;
  vPathPosition = vec2(
    positions.y + positions.z * offsetDirection,
    dot(offsetFromStartOfPath, dir)
  );

  return currPoint + vec3(vCornerOffset * width, 0.0);
}

// calculate line join positions
// extract params from attributes and uniforms
vec3 lineJoin(vec3 prevPoint, vec3 currPoint, vec3 nextPoint) {

  // relative position to the corner:
  // -1: inside (smaller side of the angle)
  // 0: center
  // 1: outside (bigger side of the angle)

  float relativePosition = positions.y;
  bool isEnd = positions.x > EPSILON;
  bool isJoint = positions.z > EPSILON;

  vec2 widthPixels = vec2(clamp(project_size_to_pixel(instanceStrokeWidths * widthScale),
    widthMinPixels, widthMaxPixels) / 2.0);

  return lineJoin(
    prevPoint, currPoint, nextPoint,
    relativePosition, isEnd, isJoint,
    billboard ? project_pixel_size_to_clipspace(widthPixels) : project_pixel_size(widthPixels)
  );
}

// In clipspace extrusion, if a line extends behind the camera, clip it to avoid visual artifacts
void clipLine(inout vec4 position, vec4 refPosition) {
  if (position.w < EPSILON) {
    float r = (EPSILON - refPosition.w) / (position.w - refPosition.w);
    position = refPosition + (position - refPosition) * r;
  }
}

void main() {
  vColor = vec4(instanceColors.rgb, instanceColors.a * opacity) / 255.;

  // Set color to be rendered to picking fbo (also used to check for selection highlight).
  picking_setPickingColor(instancePickingColors);

  float isEnd = positions.x;

  vec3 prevPosition = mix(instanceLeftPositions, instanceStartPositions, isEnd);
  vec2 prevPosition64xyLow = mix(instanceNeighborPositions64xyLow.xy, instanceStartEndPositions64xyLow.xy, isEnd);

  vec3 currPosition = mix(instanceStartPositions, instanceEndPositions, isEnd);
  vec2 currPosition64xyLow = mix(instanceStartEndPositions64xyLow.xy, instanceStartEndPositions64xyLow.zw, isEnd);

  vec3 nextPosition = mix(instanceEndPositions, instanceRightPositions, isEnd);
  vec2 nextPosition64xyLow = mix(instanceStartEndPositions64xyLow.zw, instanceNeighborPositions64xyLow.zw, isEnd);

  if (billboard) {
    // Extrude in clipspace
    vec4 prevPositionScreen = project_position_to_clipspace(prevPosition, prevPosition64xyLow, ZERO_OFFSET);
    vec4 currPositionScreen = project_position_to_clipspace(currPosition, currPosition64xyLow, ZERO_OFFSET);
    vec4 nextPositionScreen = project_position_to_clipspace(nextPosition, nextPosition64xyLow, ZERO_OFFSET);

    clipLine(prevPositionScreen, currPositionScreen);
    clipLine(nextPositionScreen, currPositionScreen);
    clipLine(currPositionScreen, mix(nextPositionScreen, prevPositionScreen, isEnd));

    vec3 pos = lineJoin(
      prevPositionScreen.xyz / prevPositionScreen.w,
      currPositionScreen.xyz / currPositionScreen.w,
      nextPositionScreen.xyz / nextPositionScreen.w
    );

    gl_Position = vec4(pos * currPositionScreen.w, currPositionScreen.w);
  } else {
    // Extrude in commonspace
    prevPosition = project_position(prevPosition, prevPosition64xyLow);
    currPosition = project_position(currPosition, currPosition64xyLow);
    nextPosition = project_position(nextPosition, nextPosition64xyLow);

    vec3 pos = lineJoin(prevPosition, currPosition, nextPosition);
    gl_Position = project_common_position_to_clipspace(vec4(pos, 1.0));
  }
}
`;
