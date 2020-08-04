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

import {Layer, createIterable} from '@deck.gl/core';
import GL from '@luma.gl/constants';
import {Model, fp64, PhongMaterial} from '@luma.gl/core';
import ColumnGeometry from './column-geometry';
const {fp64LowPart} = fp64;
const defaultMaterial = new PhongMaterial();

import vs from './column-layer-vertex.glsl';
import fs from './column-layer-fragment.glsl';

const DEFAULT_COLOR = [0, 0, 0, 255];

const defaultProps = {
  diskResolution: {type: 'number', min: 4, value: 20},
  vertices: null,
  radius: {type: 'number', min: 0, value: 1000},
  angle: {type: 'number', value: 0},
  offset: {type: 'array', value: [0, 0]},
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  elevationScale: {type: 'number', min: 0, value: 1},

  lineWidthUnits: 'meters',
  lineWidthScale: 1,
  lineWidthMinPixels: 0,
  lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,

  extruded: true,
  fp64: false,
  wireframe: false,
  filled: true,
  stroked: false,

  getPosition: {type: 'accessor', value: x => x.position},
  getFillColor: {type: 'accessor', value: DEFAULT_COLOR},
  getLineColor: {type: 'accessor', value: DEFAULT_COLOR},
  getLineWidth: {type: 'accessor', value: 1},
  getElevation: {type: 'accessor', value: 1000},
  material: defaultMaterial,
  getColor: {deprecatedFor: ['getFillColor', 'getLineColor']}
};

export default class ColumnLayer extends Layer {
  getShaders() {
    const projectModule = this.use64bitProjection() ? 'project64' : 'project32';
    return {vs, fs, modules: [projectModule, 'gouraud-lighting', 'picking']};
  }

  /**
   * DeckGL calls initializeState when GL context is available
   * Essentially a deferred constructor
   */
  initializeState() {
    const attributeManager = this.getAttributeManager();
    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instancePositions: {
        size: 3,
        transition: true,
        accessor: 'getPosition'
      },
      instanceElevations: {
        size: 1,
        transition: true,
        accessor: 'getElevation'
      },
      instancePositions64xyLow: {
        size: 2,
        accessor: 'getPosition',
        update: this.calculateInstancePositions64xyLow
      },
      instanceFillColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        transition: true,
        accessor: 'getFillColor',
        defaultValue: DEFAULT_COLOR
      },
      instanceLineColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        transition: true,
        accessor: 'getLineColor',
        defaultValue: DEFAULT_COLOR
      },
      instanceStrokeWidths: {
        size: 1,
        accessor: 'getLineWidth',
        transition: true
      }
    });
    /* eslint-enable max-len */
  }

  updateState({props, oldProps, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    const regenerateModels = props.fp64 !== oldProps.fp64;

    if (regenerateModels) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      this.getAttributeManager().invalidateAll();
    }

    if (
      regenerateModels ||
      props.diskResolution !== oldProps.diskResolution ||
      props.vertices !== oldProps.vertices
    ) {
      this._updateGeometry(props);
    }
  }

  getGeometry(diskResolution, vertices) {
    const geometry = new ColumnGeometry({
      radius: 1,
      height: 2,
      vertices,
      nradial: diskResolution
    });

    let meanVertexDistance = 0;
    if (vertices) {
      for (let i = 0; i < diskResolution; i++) {
        const p = vertices[i];
        const d = Math.sqrt(p[0] * p[0] + p[1] * p[1]);
        meanVertexDistance += d / diskResolution;
      }
    } else {
      meanVertexDistance = 1;
    }
    this.setState({
      edgeDistance: Math.cos(Math.PI / diskResolution) * meanVertexDistance
    });

    return geometry;
  }

  _getModel(gl) {
    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  _updateGeometry({diskResolution, vertices}) {
    const geometry = this.getGeometry(diskResolution, vertices);

    this.setState({
      fillVertexCount: geometry.attributes.POSITION.value.length / 3,
      wireframeVertexCount: geometry.indices.value.length
    });

    this.state.model.setProps({geometry});
  }

  draw({uniforms}) {
    const {viewport} = this.context;
    const {
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,

      elevationScale,
      extruded,
      filled,
      stroked,
      wireframe,
      offset,
      coverage,
      radius,
      angle
    } = this.props;
    const {model, fillVertexCount, wireframeVertexCount, edgeDistance} = this.state;

    const widthMultiplier =
      lineWidthUnits === 'pixels' ? viewport.distanceScales.metersPerPixel[2] : 1;

    model.setUniforms(
      Object.assign({}, uniforms, {
        radius,
        angle: (angle / 180) * Math.PI,
        offset,
        extruded,
        coverage,
        elevationScale,
        edgeDistance,
        widthScale: lineWidthScale * widthMultiplier,
        widthMinPixels: lineWidthMinPixels,
        widthMaxPixels: lineWidthMaxPixels
      })
    );

    // When drawing 3d: draw wireframe first so it doesn't get occluded by depth test
    if (extruded && wireframe) {
      model.setProps({isIndexed: true});
      model
        .setVertexCount(wireframeVertexCount)
        .setDrawMode(GL.LINES)
        .setUniforms({isStroke: true})
        .draw();
    }
    if (filled) {
      model.setProps({isIndexed: false});
      model
        .setVertexCount(fillVertexCount)
        .setDrawMode(GL.TRIANGLE_STRIP)
        .setUniforms({isStroke: false})
        .draw();
    }
    // When drawing 2d: draw fill before stroke so that the outline is always on top
    if (!extruded && stroked) {
      model.setProps({isIndexed: false});
      // The width of the stroke is achieved by flattening the side of the cylinder.
      // Skip the last 1/3 of the vertices which is the top.
      model
        .setVertexCount((fillVertexCount * 2) / 3)
        .setDrawMode(GL.TRIANGLE_STRIP)
        .setUniforms({isStroke: true})
        .draw();
    }
  }

  calculateInstancePositions64xyLow(attribute, {startRow, endRow}) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;

    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data, getPosition} = this.props;
    const {value, size} = attribute;
    let i = startRow * size;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const object of iterable) {
      objectInfo.index++;
      const position = getPosition(object, objectInfo);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }
}

ColumnLayer.layerName = 'ColumnLayer';
ColumnLayer.defaultProps = defaultProps;
