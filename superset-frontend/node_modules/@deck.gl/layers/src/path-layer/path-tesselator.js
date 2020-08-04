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
import {experimental} from '@deck.gl/core';
const {Tesselator} = experimental;
import {fp64 as fp64Module} from '@luma.gl/core';
const {fp64LowPart} = fp64Module;

// This class is set up to allow querying one attribute at a time
// the way the AttributeManager expects it
export default class PathTesselator extends Tesselator {
  constructor({data, getGeometry, positionFormat, fp64}) {
    super({
      data,
      getGeometry,
      fp64,
      positionFormat,
      attributes: {
        startPositions: {size: 3},
        endPositions: {size: 3},
        leftPositions: {size: 3},
        rightPositions: {size: 3},
        startEndPositions64XyLow: {size: 4, fp64Only: true},
        neighborPositions64XyLow: {size: 4, fp64Only: true}
      }
    });
  }

  /* Getters */
  get(attributeName) {
    return this.attributes[attributeName];
  }

  /* Implement base Tesselator interface */
  getGeometrySize(path) {
    return Math.max(0, this.getPathLength(path) - 1);
  }

  /* eslint-disable max-statements, complexity */
  updateGeometryAttributes(path, context) {
    const {
      attributes: {
        startPositions,
        endPositions,
        leftPositions,
        rightPositions,
        startEndPositions64XyLow,
        neighborPositions64XyLow
      },
      fp64
    } = this;

    const numPoints = context.geometrySize + 1;
    if (numPoints < 2) {
      // ignore invalid path
      return;
    }
    const isPathClosed = this.isClosed(path);

    let startPoint = this.getPointOnPath(path, 0);
    let endPoint = this.getPointOnPath(path, 1);
    let prevPoint = isPathClosed ? this.getPointOnPath(path, numPoints - 2) : startPoint;
    let nextPoint;

    for (let i = context.vertexStart, ptIndex = 1; ptIndex < numPoints; i++, ptIndex++) {
      if (ptIndex + 1 < numPoints) {
        nextPoint = this.getPointOnPath(path, ptIndex + 1);
      } else {
        nextPoint = isPathClosed ? this.getPointOnPath(path, 1) : endPoint;
      }

      startPositions[i * 3] = startPoint[0];
      startPositions[i * 3 + 1] = startPoint[1];
      startPositions[i * 3 + 2] = startPoint[2] || 0;

      endPositions[i * 3] = endPoint[0];
      endPositions[i * 3 + 1] = endPoint[1];
      endPositions[i * 3 + 2] = endPoint[2] || 0;

      leftPositions[i * 3] = prevPoint[0];
      leftPositions[i * 3 + 1] = prevPoint[1];
      leftPositions[i * 3 + 2] = prevPoint[2] || 0;

      rightPositions[i * 3] = nextPoint[0];
      rightPositions[i * 3 + 1] = nextPoint[1];
      rightPositions[i * 3 + 2] = nextPoint[2] || 0;

      if (fp64) {
        startEndPositions64XyLow[i * 4] = fp64LowPart(startPoint[0]);
        startEndPositions64XyLow[i * 4 + 1] = fp64LowPart(startPoint[1]);
        startEndPositions64XyLow[i * 4 + 2] = fp64LowPart(endPoint[0]);
        startEndPositions64XyLow[i * 4 + 3] = fp64LowPart(endPoint[1]);

        neighborPositions64XyLow[i * 4] = fp64LowPart(prevPoint[0]);
        neighborPositions64XyLow[i * 4 + 1] = fp64LowPart(prevPoint[1]);
        neighborPositions64XyLow[i * 4 + 2] = fp64LowPart(nextPoint[0]);
        neighborPositions64XyLow[i * 4 + 3] = fp64LowPart(nextPoint[1]);
      }

      prevPoint = startPoint;
      startPoint = endPoint;
      endPoint = nextPoint;
    }
  }
  /* eslint-enable max-statements, complexity */

  /* Utilities */
  getPathLength(path) {
    if (Number.isFinite(path[0])) {
      // flat format
      return path.length / this.positionSize;
    }
    return path.length;
  }

  getPointOnPath(path, index) {
    if (Number.isFinite(path[0])) {
      // flat format
      const {positionSize} = this;
      // TODO - avoid creating new arrays when using binary
      return [
        path[index * positionSize],
        path[index * positionSize + 1],
        positionSize === 3 ? path[index * positionSize + 2] : 0
      ];
    }
    return path[index];
  }

  isClosed(path) {
    const numPoints = this.getPathLength(path);
    const firstPoint = this.getPointOnPath(path, 0);
    const lastPoint = this.getPointOnPath(path, numPoints - 1);
    return (
      firstPoint[0] === lastPoint[0] &&
      firstPoint[1] === lastPoint[1] &&
      firstPoint[2] === lastPoint[2]
    );
  }
}
