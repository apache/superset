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

import {Layer, experimental} from '@deck.gl/core';
const {defaultColorRange, quantizeScale} = experimental;

import {GL, Model, Geometry} from 'luma.gl';
import {lerp} from 'math.gl';
import vs from './screen-grid-layer-vertex.glsl';
import fs from './screen-grid-layer-fragment.glsl';
const DEFAULT_MINCOLOR = [0, 0, 0, 255];
const DEFAULT_MAXCOLOR = [0, 255, 0, 255];

const defaultProps = {
  cellSizePixels: 100,

  colorDomain: null,
  colorRange: defaultColorRange,

  getPosition: d => d.position,
  getWeight: d => 1
};

export default class ScreenGridLayer extends Layer {
  getShaders() {
    return {vs, fs, modules: ['picking']}; // 'project' module added by default.
  }

  initializeState() {
    const attributeManager = this.getAttributeManager();
    const {gl} = this.context;

    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instancePositions: {size: 3, update: this.calculateInstancePositions},
      instanceColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        transition: true,
        accessor: ['getPosition', 'getWeight'],
        update: this.calculateInstanceColors
      }
    });
    /* eslint-disable max-len */

    this.setState({model: this._getModel(gl)});
  }

  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});
    const cellSizeChanged = props.cellSizePixels !== oldProps.cellSizePixels;

    if (cellSizeChanged || changeFlags.viewportChanged) {
      this.updateCell();
    }
  }

  draw({uniforms}) {
    const {parameters = {}} = this.props;
    const {model, cellScale} = this.state;
    uniforms = Object.assign({}, uniforms, {cellScale});
    model.draw({
      uniforms,
      parameters: Object.assign(
        {
          depthTest: false,
          depthMask: false
        },
        parameters
      )
    });
  }

  _getModel(gl) {
    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          attributes: {
            vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])
          }
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  updateCell() {
    const {width, height} = this.context.viewport;
    const {cellSizePixels} = this.props;

    const MARGIN = 2;
    const cellScale = new Float32Array([
      (cellSizePixels - MARGIN) / width * 2,
      -(cellSizePixels - MARGIN) / height * 2,
      1
    ]);
    const numCol = Math.ceil(width / cellSizePixels);
    const numRow = Math.ceil(height / cellSizePixels);

    this.setState({
      cellScale,
      numCol,
      numRow,
      numInstances: numCol * numRow
    });

    const attributeManager = this.getAttributeManager();
    attributeManager.invalidateAll();
  }

  calculateInstancePositions(attribute, {numInstances}) {
    const {width, height} = this.context.viewport;
    const {cellSizePixels} = this.props;
    const {numCol} = this.state;
    const {value, size} = attribute;

    for (let i = 0; i < numInstances; i++) {
      const x = i % numCol;
      const y = Math.floor(i / numCol);
      value[i * size + 0] = x * cellSizePixels / width * 2 - 1;
      value[i * size + 1] = 1 - y * cellSizePixels / height * 2;
      value[i * size + 2] = 0;
    }
  }

  calculateInstanceColors(attribute) {
    const {data, cellSizePixels, getPosition, getWeight} = this.props;
    const {numCol, numRow, numInstances} = this.state;
    const {value, size} = attribute;
    const weights = new Array(numInstances);
    let maxCount = 0;

    weights.fill(0.0);

    // aggregate weights
    for (const point of data) {
      const pixel = this.project(getPosition(point));
      const colId = Math.floor(pixel[0] / cellSizePixels);
      const rowId = Math.floor(pixel[1] / cellSizePixels);
      if (colId >= 0 && colId < numCol && rowId >= 0 && rowId < numRow) {
        const i = colId + rowId * numCol;
        weights[i] += getWeight(point);
        if (weights[i] > maxCount) {
          maxCount = weights[i];
        }
      }
    }
    this.setState({maxCount});

    // Convert weights to colors.
    for (let i = 0; i < numInstances; i++) {
      const color = this._getColor(weights[i], maxCount);
      const index = i * size;
      value[index + 0] = color[0];
      value[index + 1] = color[1];
      value[index + 2] = color[2];
      value[index + 3] = color[3];
    }
  }

  _getColor(weight, maxCount) {
    let color;
    const {minColor, maxColor, colorRange} = this.props;
    if (this._shouldUseMinMax()) {
      const step = weight / maxCount;
      // We are supporting optional props as deprecated, set default value if not provided
      color = lerp(minColor || DEFAULT_MINCOLOR, maxColor || DEFAULT_MAXCOLOR, step);
      return color;
    }
    // if colorDomain not set , use default domain [1, maxCount]
    const colorDomain = this.props.colorDomain || [1, maxCount];
    if (weight < colorDomain[0] || weight > colorDomain[1]) {
      // wight outside the domain, set color alpha to 0.
      return [0, 0, 0, 0];
    }
    color = quantizeScale(colorDomain, colorRange, weight);
    // add alpha to color if not defined in colorRange
    color[3] = Number.isFinite(color[3]) ? color[3] : 255;
    return color;
  }

  _shouldUseMinMax() {
    const {minColor, maxColor, colorDomain, colorRange} = this.props;
    if (minColor || maxColor) {
      return true;
    }
    // minColor and maxColor not supplied, check if colorRange or colorDomain supplied.
    // NOTE: colorDomain and colorRange are experimental features, use them only when supplied.
    if (colorDomain || colorRange) {
      return false;
    }
    // None specified, use default minColor and maxColor
    return true;
  }
}

ScreenGridLayer.layerName = 'ScreenGridLayer';
ScreenGridLayer.defaultProps = defaultProps;
