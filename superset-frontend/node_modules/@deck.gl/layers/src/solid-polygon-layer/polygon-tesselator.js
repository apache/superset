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

// Handles tesselation of polygons with holes
// - 2D surfaces
// - 2D outlines
// - 3D surfaces (top and sides only)
// - 3D wireframes (not yet)
import * as Polygon from './polygon';
import {experimental} from '@deck.gl/core';
const {Tesselator} = experimental;
import {fp64 as fp64Module} from '@luma.gl/core';
const {fp64LowPart} = fp64Module;

// This class is set up to allow querying one attribute at a time
// the way the AttributeManager expects it
export default class PolygonTesselator extends Tesselator {
  constructor({data, getGeometry, fp64, positionFormat, IndexType = Uint32Array}) {
    super({
      data,
      getGeometry,
      fp64,
      positionFormat,
      attributes: {
        positions: {size: 3},
        positions64xyLow: {size: 2, fp64Only: true},
        vertexValid: {type: Uint8ClampedArray, size: 1},
        indices: {type: IndexType, size: 1}
      }
    });
  }

  /* Getters */
  get(attributeName) {
    if (attributeName === 'indices') {
      return this.attributes.indices.subarray(0, this.vertexCount);
    }

    return this.attributes[attributeName];
  }

  /* Implement base Tesselator interface */
  getGeometrySize(polygon) {
    return Polygon.getVertexCount(polygon, this.positionSize);
  }

  updateGeometryAttributes(polygon, context) {
    polygon = Polygon.normalize(polygon, this.positionSize, context.geometrySize);

    this._updateIndices(polygon, context);
    this._updatePositions(polygon, context);
  }

  // Flatten the indices array
  _updateIndices(polygon, {geometryIndex, vertexStart: offset, indexStart}) {
    const {attributes, indexLayout, typedArrayManager} = this;

    let target = attributes.indices;
    let currentLength = target.length;
    let i = indexStart;

    // 1. get triangulated indices for the internal areas
    const indices = Polygon.getSurfaceIndices(polygon, this.positionSize);

    // make sure the buffer is large enough
    if (currentLength < i + indices.length) {
      currentLength = (i + indices.length) * 2;
      target = typedArrayManager.allocate(target, currentLength, {
        type: target.constructor,
        size: 1,
        copy: true
      });
    }

    // 2. offset each index by the number of indices in previous polygons
    for (let j = 0; j < indices.length; j++) {
      target[i++] = indices[j] + offset;
    }

    indexLayout[geometryIndex] = indices.length;
    attributes.indices = target;
  }

  // Flatten out all the vertices of all the sub subPolygons
  _updatePositions(polygon, {vertexStart, geometrySize}) {
    const {
      attributes: {positions, positions64xyLow, vertexValid},
      fp64,
      positionSize
    } = this;

    let i = vertexStart;
    const {positions: polygonPositions, holeIndices} = polygon;

    for (let j = 0; j < geometrySize; j++) {
      const x = polygonPositions[j * positionSize];
      const y = polygonPositions[j * positionSize + 1];
      const z = positionSize > 2 ? polygonPositions[j * positionSize + 2] : 0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      if (fp64) {
        positions64xyLow[i * 2] = fp64LowPart(x);
        positions64xyLow[i * 2 + 1] = fp64LowPart(y);
      }
      vertexValid[i] = 1;
      i++;
    }

    /* We are reusing the some buffer for `nextPositions` by offseting one vertex
     * to the left. As a result,
     * the last vertex of each ring overlaps with the first vertex of the next ring.
     * `vertexValid` is used to mark the end of each ring so we don't draw these
     * segments:
      positions      A0 A1 A2 A3 A4 B0 B1 B2 C0 ...
      nextPositions  A1 A2 A3 A4 B0 B1 B2 C0 C1 ...
      vertexValid    1  1  1  1  0  1  1  0  1 ...
     */
    if (holeIndices) {
      for (let j = 0; j < holeIndices.length; j++) {
        vertexValid[vertexStart + holeIndices[j] / positionSize - 1] = 0;
      }
    }
    vertexValid[vertexStart + geometrySize - 1] = 0;
  }
}
