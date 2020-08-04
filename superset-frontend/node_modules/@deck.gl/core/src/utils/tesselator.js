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
import {createIterable} from './iterable-utils';

class TypedArrayManager {
  constructor({overAlloc = 1} = {}) {
    this.overAlloc = overAlloc;
  }

  allocate(typedArray, count, {size, type, copy = false}) {
    const newSize = count * size;
    if (typedArray && newSize <= typedArray.length) {
      return typedArray;
    }

    // Allocate at least one element to ensure a valid buffer
    const allocSize = Math.max(Math.ceil(newSize * this.overAlloc), 1);
    const newArray = this._allocate(type, allocSize);

    if (typedArray && copy) {
      newArray.set(typedArray);
    }

    this._release(typedArray);
    return newArray;
  }

  _allocate(Type = Float32Array, size) {
    // TODO - check if available in pool
    return new Type(size);
  }

  _release(typedArray) {
    // TODO - add to pool
    // logFunctions.onUpdate({
    //   level: LOG_DETAIL_PRIORITY,
    //   message: `${attributeName} allocated ${allocCount}`,
    //   id: this.id
    // });
  }
}

export default class Tesselator {
  constructor(opts = {}) {
    const {attributes = {}} = opts;

    this.typedArrayManager = new TypedArrayManager();
    this.indexLayout = null;
    this.bufferLayout = null;
    this.vertexCount = 0;
    this.instanceCount = 0;
    this.attributes = {};
    this._attributeDefs = attributes;

    this.updateGeometry(opts);

    Object.seal(this);
  }

  /* Public methods */
  updateGeometry({data, getGeometry, positionFormat, fp64}) {
    this.data = data;
    this.getGeometry = getGeometry;
    this.fp64 = fp64;
    this.positionSize = positionFormat === 'XY' ? 2 : 3;
    this._rebuildGeometry();
  }

  updatePartialGeometry({startRow, endRow}) {
    this._rebuildGeometry({startRow, endRow});
  }

  /* Subclass interface */

  // Update the positions of a single geometry
  updateGeometryAttributes(geometry, startIndex, size) {
    throw new Error('Not implemented');
  }

  // Returns the number of vertices in a geometry
  getGeometrySize(geometry) {
    throw new Error('Not implemented');
  }

  /* Private utility methods */

  /**
   * Visit all objects
   * `data` is expected to be an iterable consistent with the base Layer expectation
   */
  _forEachGeometry(visitor, startRow, endRow) {
    const {data, getGeometry} = this;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;
      const geometry = getGeometry(object, objectInfo);
      visitor(geometry, objectInfo.index);
    }
  }

  /* eslint-disable complexity,max-statements */
  _rebuildGeometry(dataRange) {
    if (!this.data || !this.getGeometry) {
      return;
    }

    let {indexLayout, bufferLayout} = this;

    if (!dataRange) {
      // Full update - regenerate buffer layout from scratch
      indexLayout = [];
      bufferLayout = [];
    }

    const {startRow = 0, endRow = Infinity} = dataRange || {};
    this._forEachGeometry(
      (geometry, dataIndex) => {
        bufferLayout[dataIndex] = this.getGeometrySize(geometry);
      },
      startRow,
      endRow
    );

    // count instances
    let instanceCount = 0;
    for (const count of bufferLayout) {
      instanceCount += count;
    }

    // allocate attributes
    const {attributes, _attributeDefs, typedArrayManager, fp64} = this;
    for (const name in _attributeDefs) {
      const def = _attributeDefs[name];
      // If dataRange is supplied, this is a partial update.
      // In case we need to reallocate the typed array, it will need the old values copied
      // before performing partial update.
      def.copy = Boolean(dataRange);

      // do not create fp64-only attributes unless in fp64 mode
      if (!def.fp64Only || fp64) {
        attributes[name] = typedArrayManager.allocate(attributes[name], instanceCount, def);
      }
    }

    this.indexLayout = indexLayout;
    this.bufferLayout = bufferLayout;
    this.instanceCount = instanceCount;

    const context = {
      vertexStart: 0,
      indexStart: 0
    };
    for (let i = 0; i < startRow; i++) {
      context.vertexStart += bufferLayout[i];
      context.indexStart += indexLayout[i] || 0;
    }

    this._forEachGeometry(
      (geometry, dataIndex) => {
        const geometrySize = bufferLayout[dataIndex];
        context.geometryIndex = dataIndex;
        context.geometrySize = geometrySize;
        this.updateGeometryAttributes(geometry, context);
        context.vertexStart += geometrySize;
        context.indexStart += indexLayout[dataIndex] || 0;
      },
      startRow,
      endRow
    );

    // count vertices
    let vertexCount = context.indexStart;
    for (let i = endRow; i < indexLayout.length; i++) {
      vertexCount += indexLayout[i];
    }
    this.vertexCount = vertexCount;
  }
}
