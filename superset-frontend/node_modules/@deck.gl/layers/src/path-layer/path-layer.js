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

import {Layer} from '@deck.gl/core';
import GL from '@luma.gl/constants';
import {Model, Geometry} from '@luma.gl/core';

import PathTesselator from './path-tesselator';

import vs from './path-layer-vertex.glsl';
import vs64 from './path-layer-vertex-64.glsl';
import fs from './path-layer-fragment.glsl';

const DEFAULT_COLOR = [0, 0, 0, 255];

const defaultProps = {
  widthUnits: 'meters',
  widthScale: {type: 'number', min: 0, value: 1}, // stroke width in meters
  widthMinPixels: {type: 'number', min: 0, value: 0}, //  min stroke width in pixels
  widthMaxPixels: {type: 'number', min: 0, value: Number.MAX_SAFE_INTEGER}, // max stroke width in pixels
  rounded: false,
  miterLimit: {type: 'number', min: 0, value: 4},
  fp64: false,
  dashJustified: false,
  billboard: false,

  getPath: {type: 'accessor', value: object => object.path},
  getColor: {type: 'accessor', value: DEFAULT_COLOR},
  getWidth: {type: 'accessor', value: 1},
  getDashArray: {type: 'accessor', value: [0, 0]}
};

const ATTRIBUTE_TRANSITION = {
  enter: (value, chunk) => {
    return chunk.length ? chunk.subarray(chunk.length - value.length) : value;
  }
};

export default class PathLayer extends Layer {
  getShaders() {
    return this.use64bitProjection()
      ? {vs: vs64, fs, modules: ['project64', 'picking']}
      : {vs, fs, modules: ['project32', 'picking']}; // 'project' module added by default.
  }

  initializeState() {
    const noAlloc = true;
    const attributeManager = this.getAttributeManager();
    /* eslint-disable max-len */
    attributeManager.addInstanced({
      instanceStartPositions: {
        size: 3,
        transition: ATTRIBUTE_TRANSITION,
        accessor: 'getPath',
        update: this.calculateStartPositions,
        noAlloc
      },
      instanceEndPositions: {
        size: 3,
        transition: ATTRIBUTE_TRANSITION,
        accessor: 'getPath',
        update: this.calculateEndPositions,
        noAlloc
      },
      instanceStartEndPositions64xyLow: {
        size: 4,
        update: this.calculateInstanceStartEndPositions64xyLow,
        noAlloc
      },
      instanceLeftPositions: {
        size: 3,
        accessor: 'getPath',
        update: this.calculateLeftPositions,
        noAlloc
      },
      instanceRightPositions: {
        size: 3,
        accessor: 'getPath',
        update: this.calculateRightPositions,
        noAlloc
      },
      instanceNeighborPositions64xyLow: {
        size: 4,
        update: this.calculateInstanceNeighborPositions64xyLow,
        noAlloc
      },
      instanceStrokeWidths: {
        size: 1,
        accessor: 'getWidth',
        transition: ATTRIBUTE_TRANSITION,
        defaultValue: 1
      },
      instanceDashArrays: {size: 2, accessor: 'getDashArray'},
      instanceColors: {
        size: 4,
        type: GL.UNSIGNED_BYTE,
        accessor: 'getColor',
        transition: ATTRIBUTE_TRANSITION,
        defaultValue: DEFAULT_COLOR
      },
      instancePickingColors: {
        size: 3,
        type: GL.UNSIGNED_BYTE,
        accessor: (object, {index, target: value}) => this.encodePickingColor(index, value)
      }
    });
    /* eslint-enable max-len */

    this.setState({
      pathTesselator: new PathTesselator({})
    });
  }

  updateState({oldProps, props, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    const attributeManager = this.getAttributeManager();

    const geometryChanged =
      changeFlags.dataChanged ||
      props.fp64 !== oldProps.fp64 ||
      (changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getPath));

    if (geometryChanged) {
      const {pathTesselator} = this.state;
      pathTesselator.updateGeometry({
        data: props.data,
        getGeometry: props.getPath,
        positionFormat: props.positionFormat,
        fp64: this.use64bitPositions()
      });
      this.setState({
        numInstances: pathTesselator.instanceCount,
        bufferLayout: pathTesselator.bufferLayout
      });
      attributeManager.invalidateAll();
    }

    if (props.fp64 !== oldProps.fp64) {
      const {gl} = this.context;
      if (this.state.model) {
        this.state.model.delete();
      }
      this.setState({model: this._getModel(gl)});
      attributeManager.invalidateAll();
    }
  }

  draw({uniforms}) {
    const {viewport} = this.context;
    const {
      rounded,
      billboard,
      miterLimit,
      widthUnits,
      widthScale,
      widthMinPixels,
      widthMaxPixels,
      dashJustified
    } = this.props;

    const widthMultiplier = widthUnits === 'pixels' ? viewport.distanceScales.metersPerPixel[2] : 1;

    this.state.model
      .setUniforms(
        Object.assign({}, uniforms, {
          jointType: Number(rounded),
          billboard,
          alignMode: Number(dashJustified),
          widthScale: widthScale * widthMultiplier,
          miterLimit,
          widthMinPixels,
          widthMaxPixels
        })
      )
      .draw();
  }

  _getModel(gl) {
    /*
     *       _
     *        "-_ 1                   3                       5
     *     _     "o---------------------o-------------------_-o
     *       -   / ""--..__              '.             _.-' /
     *   _     "@- - - - - ""--..__- - - - x - - - -_.@'    /
     *    "-_  /                   ""--..__ '.  _,-` :     /
     *       "o----------------------------""-o'    :     /
     *      0,2                            4 / '.  :     /
     *                                      /   '.:     /
     *                                     /     :'.   /
     *                                    /     :  ', /
     *                                   /     :     o
     */

    const SEGMENT_INDICES = [
      // start corner
      0,
      2,
      1,
      // body
      1,
      2,
      4,
      1,
      4,
      3,
      // end corner
      3,
      4,
      5
    ];

    // [0] position on segment - 0: start, 1: end
    // [1] side of path - -1: left, 0: center, 1: right
    // [2] role - 0: offset point 1: joint point
    const SEGMENT_POSITIONS = [
      // bevel start corner
      0,
      0,
      1,
      // start inner corner
      0,
      -1,
      0,
      // start outer corner
      0,
      1,
      0,
      // end inner corner
      1,
      -1,
      0,
      // end outer corner
      1,
      1,
      0,
      // bevel end corner
      1,
      0,
      1
    ];

    return new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: new Geometry({
          drawMode: GL.TRIANGLES,
          attributes: {
            indices: new Uint16Array(SEGMENT_INDICES),
            positions: new Float32Array(SEGMENT_POSITIONS)
          }
        }),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );
  }

  calculateStartPositions(attribute) {
    const {pathTesselator} = this.state;

    attribute.bufferLayout = pathTesselator.bufferLayout;
    attribute.value = pathTesselator.get('startPositions');
  }

  calculateEndPositions(attribute) {
    const {pathTesselator} = this.state;

    attribute.bufferLayout = pathTesselator.bufferLayout;
    attribute.value = pathTesselator.get('endPositions');
  }

  calculateInstanceStartEndPositions64xyLow(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;

    if (isFP64) {
      attribute.value = this.state.pathTesselator.get('startEndPositions64XyLow');
    } else {
      attribute.value = new Float32Array(4);
    }
  }

  calculateLeftPositions(attribute) {
    const {pathTesselator} = this.state;
    attribute.value = pathTesselator.get('leftPositions');
  }

  calculateRightPositions(attribute) {
    const {pathTesselator} = this.state;
    attribute.value = pathTesselator.get('rightPositions');
  }

  calculateInstanceNeighborPositions64xyLow(attribute) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;

    if (isFP64) {
      attribute.value = this.state.pathTesselator.get('neighborPositions64XyLow');
    } else {
      attribute.value = new Float32Array(4);
    }
  }

  clearPickingColor(color) {
    const pickedPathIndex = this.decodePickingColor(color);
    const {bufferLayout} = this.state.pathTesselator;
    const numVertices = bufferLayout[pickedPathIndex];

    let startInstanceIndex = 0;
    for (let pathIndex = 0; pathIndex < pickedPathIndex; pathIndex++) {
      startInstanceIndex += bufferLayout[pathIndex];
    }

    const {instancePickingColors} = this.getAttributeManager().attributes;

    const {value} = instancePickingColors;
    const endInstanceIndex = startInstanceIndex + numVertices;
    value.fill(0, startInstanceIndex * 3, endInstanceIndex * 3);
    instancePickingColors.update({value});
  }
}

PathLayer.layerName = 'PathLayer';
PathLayer.defaultProps = defaultProps;
