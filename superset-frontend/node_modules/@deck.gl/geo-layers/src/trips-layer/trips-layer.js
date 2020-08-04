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

import {PathLayer} from '@deck.gl/layers';
import {createIterable} from '@deck.gl/core';

const defaultProps = {
  trailLength: {type: 'number', value: 120, min: 0},
  currentTime: {type: 'number', value: 0, min: 0},
  getTimestamps: {type: 'accessor', value: null}
};

export default class TripsLayer extends PathLayer {
  getShaders() {
    const shaders = super.getShaders();
    shaders.inject = {
      // Timestamp of the vertex
      'vs:#decl': `\
uniform float trailLength;
uniform bool isPath3D;
attribute vec2 instanceTimestamps;
varying float vTime;
`,
      // Remove the z component (timestamp) from position
      // TODO - Legacy use case, remove in v8
      'vec3 nextPosition = mix(instanceEndPositions, instanceRightPositions, isEnd);': `\
vec2 timestamps = instanceTimestamps;
if (!isPath3D) {
  prevPosition.z = 0.0;
  currPosition.z = 0.0;
  nextPosition.z = 0.0;
  timestamps.x = instanceStartPositions.z;
  timestamps.y = instanceEndPositions.z;
}
`,
      // Apply a small shift to battle z-fighting
      'vs:#main-end': `\
float shiftZ = sin(timestamps.x) * 1e-4;
gl_Position.z += shiftZ;
vTime = timestamps.x + (timestamps.y - timestamps.x) * vPathPosition.y / vPathLength;
`,
      'fs:#decl': `\
uniform float trailLength;
uniform float currentTime;
varying float vTime;
`,
      // Drop the segments outside of the time window
      'fs:#main-start': `\
if(vTime > currentTime || vTime < currentTime - trailLength) {
  discard;
}
`,
      // Fade the color (currentTime - 100%, end of trail - 0%)
      'gl_FragColor = vColor;': 'gl_FragColor.a *= 1.0 - (currentTime - vTime) / trailLength;'
    };
    return shaders;
  }

  initializeState(params) {
    super.initializeState(params);

    const attributeManager = this.getAttributeManager();
    attributeManager.addInstanced({
      instanceTimestamps: {
        size: 2,
        update: this.calculateInstanceTimestamps
      }
    });
  }

  draw(params) {
    const {trailLength, currentTime, getTimestamps} = this.props;

    params.uniforms = Object.assign({}, params.uniforms, {
      trailLength,
      currentTime,
      // TODO - remove in v8
      isPath3D: Boolean(getTimestamps)
    });

    super.draw(params);
  }

  calculateInstanceTimestamps(attribute, {startRow, endRow}) {
    const {data, getTimestamps} = this.props;

    if (!getTimestamps) {
      // TODO - Legacy use case, remove in v8
      attribute.constant = true;
      attribute.value = new Float32Array(2);
      return;
    }

    const {
      pathTesselator: {bufferLayout, instanceCount}
    } = this.state;
    const value = new Float32Array(instanceCount * 2);

    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    let i = 0;

    for (let objectIndex = 0; objectIndex < startRow; objectIndex++) {
      i += bufferLayout[objectIndex] * 2;
    }

    for (const object of iterable) {
      objectInfo.index++;

      const geometrySize = bufferLayout[objectInfo.index];
      const timestamps = getTimestamps(object, objectInfo);
      // For each line segment, we have [startTimestamp, endTimestamp]
      for (let j = 0; j < geometrySize; j++) {
        value[i++] = timestamps[j];
        value[i++] = timestamps[j + 1];
      }
    }
    attribute.constant = false;
    attribute.value = value;
  }
}

TripsLayer.layerName = 'TripsLayer';
TripsLayer.defaultProps = defaultProps;
