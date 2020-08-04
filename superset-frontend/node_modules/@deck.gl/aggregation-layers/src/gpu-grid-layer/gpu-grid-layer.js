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

import {PhongMaterial} from '@luma.gl/core';
import {CompositeLayer, log} from '@deck.gl/core';

import GPUGridAggregator from '../utils/gpu-grid-aggregation/gpu-grid-aggregator';
import {AGGREGATION_OPERATION} from '../utils/aggregation-operation-utils';
import {pointToDensityGridData} from '../utils/gpu-grid-aggregation/grid-aggregation-utils';
import {defaultColorRange, colorRangeToFlatArray} from '../utils/color-utils';
import GPUGridCellLayer from './gpu-grid-cell-layer';
import {pointToDensityGridDataCPU} from './../cpu-grid-layer/grid-aggregator';

const defaultMaterial = new PhongMaterial();
const defaultProps = {
  // color
  colorDomain: null,
  colorRange: defaultColorRange,
  getColorWeight: {type: 'accessor', value: x => 1},
  colorAggregation: 'SUM',

  // elevation
  elevationDomain: null,
  elevationRange: [0, 1000],
  getElevationWeight: {type: 'accessor', value: x => 1},
  elevationAggregation: 'SUM',
  elevationScale: {type: 'number', min: 0, value: 1},

  // grid
  cellSize: {type: 'number', min: 0, max: 1000, value: 1000},
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  getPosition: {type: 'accessor', value: x => x.position},
  extruded: false,
  fp64: false,

  // Optional material for 'lighting' shader module
  material: defaultMaterial,

  // GPU Aggregation
  gpuAggregation: true
};

export default class GPUGridLayer extends CompositeLayer {
  initializeState() {
    const {gl} = this.context;
    const isSupported = GPUGridAggregator.isSupported(gl);
    if (!isSupported) {
      log.error('GPUGridLayer is not supported on this browser, use GridLayer instead')();
    }
    const options = {
      id: `${this.id}-gpu-aggregator`,
      shaderCache: this.context.shaderCache
    };
    this.state = {
      gpuGridAggregator: new GPUGridAggregator(gl, options),
      isSupported
    };
  }

  updateState(opts) {
    const aggregationFlags = this.getAggregationFlags(opts);
    if (aggregationFlags) {
      // aggregate points into grid cells
      this.getLayerData(aggregationFlags);
      // reset cached CPU Aggregation results (used for picking)
      this.setState({gridHash: null});
    }
  }

  finalizeState() {
    super.finalizeState();
    this.state.gpuGridAggregator.delete();
  }

  getAggregationFlags({oldProps, props, changeFlags}) {
    let aggregationFlags = null;
    if (!this.state.isSupported) {
      // Skip update, layer not supported
      return false;
    }
    if (this.isDataChanged({oldProps, props, changeFlags})) {
      aggregationFlags = Object.assign({}, aggregationFlags, {dataChanged: true});
    }
    if (oldProps.cellSize !== props.cellSize) {
      aggregationFlags = Object.assign({}, aggregationFlags, {cellSizeChanged: true});
    }
    return aggregationFlags;
  }

  isDataChanged({oldProps, props, changeFlags}) {
    // Flags affecting aggregation data
    if (changeFlags.dataChanged) {
      return true;
    }
    if (oldProps.gpuAggregation !== props.gpuAggregation) {
      return true;
    }
    if (
      oldProps.colorAggregation !== props.colorAggregation ||
      oldProps.elevationAggregation !== props.elevationAggregation
    ) {
      return true;
    }
    if (
      changeFlags.updateTriggersChanged &&
      (changeFlags.updateTriggersChanged.all ||
        changeFlags.updateTriggersChanged.getPosition ||
        changeFlags.updateTriggersChanged.getColorWeight ||
        changeFlags.updateTriggersChanged.getElevationWeight)
    ) {
      return true;
    }
    return false;
  }

  getHashKeyForIndex(index) {
    const {gridSize, gridOrigin, cellSize} = this.state;
    const yIndex = Math.floor(index / gridSize[0]);
    const xIndex = index - yIndex * gridSize[0];
    // This will match the index to the hash-key to access aggregation data from CPU aggregation results.
    const latIdx = Math.floor(
      (yIndex * cellSize[1] + gridOrigin[1] + 90 + cellSize[1] / 2) / cellSize[1]
    );
    const lonIdx = Math.floor(
      (xIndex * cellSize[0] + gridOrigin[0] + 180 + cellSize[0] / 2) / cellSize[0]
    );
    return `${latIdx}-${lonIdx}`;
  }

  getPositionForIndex(index) {
    const {gridSize, gridOrigin, cellSize} = this.state;
    const yIndex = Math.floor(index / gridSize[0]);
    const xIndex = index - yIndex * gridSize[0];
    const yPos = yIndex * cellSize[1] + gridOrigin[1];
    const xPos = xIndex * cellSize[0] + gridOrigin[0];
    return [xPos, yPos];
  }

  getPickingInfo({info, mode}) {
    const {index} = info;
    let object = null;
    if (index >= 0) {
      const {gpuGridAggregator} = this.state;
      const position = this.getPositionForIndex(index);
      const colorInfo = GPUGridAggregator.getAggregationData(
        Object.assign({pixelIndex: index}, gpuGridAggregator.getData('color'))
      );
      const elevationInfo = GPUGridAggregator.getAggregationData(
        Object.assign({pixelIndex: index}, gpuGridAggregator.getData('elevation'))
      );

      object = {
        colorValue: colorInfo.cellWeight,
        elevationValue: elevationInfo.cellWeight,
        count: colorInfo.cellCount || elevationInfo.cellCount,
        position,
        totalCount: colorInfo.totalCount || elevationInfo.totalCount
      };
      if (mode !== 'hover') {
        // perform CPU aggregation for full list of points for each cell
        const {data, getPosition} = this.props;
        let {gridHash} = this.state;
        if (!gridHash) {
          const cpuAggregation = pointToDensityGridDataCPU(data, this.props.cellSize, getPosition);
          gridHash = cpuAggregation.gridHash;
          this.setState({gridHash});
        }
        const key = this.getHashKeyForIndex(index);
        const cpuAggregationData = gridHash[key];
        Object.assign(object, cpuAggregationData);
      }
    }

    return Object.assign(info, {
      picked: Boolean(object),
      // override object with picked cell
      object
    });
  }

  getLayerData(aggregationFlags) {
    const {
      data,
      cellSize: cellSizeMeters,
      getPosition,
      gpuAggregation,
      getColorWeight,
      colorAggregation,
      getElevationWeight,
      elevationAggregation,
      fp64
    } = this.props;
    const weightParams = {
      color: {
        getWeight: getColorWeight,
        operation:
          AGGREGATION_OPERATION[colorAggregation] ||
          AGGREGATION_OPERATION[defaultProps.colorAggregation],
        needMin: true,
        needMax: true,
        combineMaxMin: true
      },
      elevation: {
        getWeight: getElevationWeight,
        operation:
          AGGREGATION_OPERATION[elevationAggregation] ||
          AGGREGATION_OPERATION[defaultProps.elevationAggregation],
        needMin: true,
        needMax: true,
        combineMaxMin: true
      }
    };
    const {weights, gridSize, gridOrigin, cellSize, boundingBox} = pointToDensityGridData({
      data,
      cellSizeMeters,
      getPosition,
      weightParams,
      gpuAggregation,
      gpuGridAggregator: this.state.gpuGridAggregator,
      boundingBox: this.state.boundingBox, // avoid parsing data when it is not changed.
      aggregationFlags,
      fp64
    });
    this.setState({weights, gridSize, gridOrigin, cellSize, boundingBox});
  }

  renderLayers() {
    if (!this.state.isSupported) {
      return null;
    }
    const {
      elevationScale,
      fp64,
      extruded,
      cellSize: cellSizeMeters,
      coverage,
      material,
      elevationRange,
      colorDomain,
      elevationDomain
    } = this.props;

    const {weights, gridSize, gridOrigin, cellSize} = this.state;

    const colorRange = colorRangeToFlatArray(this.props.colorRange, Float32Array, 255);

    const SubLayerClass = this.getSubLayerClass('gpu-grid-cell', GPUGridCellLayer);

    return new SubLayerClass(
      {
        gridSize,
        gridOrigin,
        gridOffset: cellSize,
        colorRange,
        elevationRange,
        colorDomain,
        elevationDomain,

        fp64,
        cellSize: cellSizeMeters,
        coverage,
        material,
        elevationScale,
        extruded
      },
      this.getSubLayerProps({
        id: 'gpu-grid-cell'
      }),
      {
        data: weights,
        numInstances: gridSize[0] * gridSize[1]
      }
    );
  }
}

GPUGridLayer.layerName = 'GPUGridLayer';
GPUGridLayer.defaultProps = defaultProps;
