// Copyright (c) 2015 - 2018 Uber Technologies, Inc.
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

import {equals} from 'math.gl';
import {CompositeLayer} from '@deck.gl/core';
import {LineLayer, SolidPolygonLayer} from '@deck.gl/layers';
import {generateContours} from './contour-utils';

import GPUGridAggregator from '../utils/gpu-grid-aggregation/gpu-grid-aggregator';
import {pointToDensityGridData} from '../utils/gpu-grid-aggregation/grid-aggregation-utils';

const DEFAULT_COLOR = [255, 255, 255, 255];
const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_THRESHOLD = 1;

const defaultProps = {
  // grid aggregation
  cellSize: {type: 'number', min: 1, max: 1000, value: 1000},
  getPosition: {type: 'accessor', value: x => x.position},
  getWeight: {type: 'accessor', value: x => 1},

  // contour lines
  contours: [{threshold: DEFAULT_THRESHOLD}],

  fp64: false,
  zOffset: 0.005
};

export default class ContourLayer extends CompositeLayer {
  initializeState() {
    const {gl} = this.context;
    const options = {
      id: `${this.id}-gpu-aggregator`,
      shaderCache: this.context.shaderCache
    };
    this.state = {
      contourData: {},
      gridAggregator: new GPUGridAggregator(gl, options),
      colorTrigger: 0,
      strokeWidthTrigger: 0
    };
  }

  updateState({oldProps, props, changeFlags}) {
    let dataChanged = false;
    let contoursChanged = false;
    const aggregationFlags = this._getAggregationFlags({oldProps, props, changeFlags});
    if (aggregationFlags) {
      dataChanged = true;
      // Clear countsData cache
      this.setState({countsData: null});
      this._aggregateData(aggregationFlags);
    }

    if (this._shouldRebuildContours({oldProps, props})) {
      contoursChanged = true;
      this._updateThresholdData(props);
    }

    if (dataChanged || contoursChanged) {
      this._generateContours();
    } else {
      // data for sublayers not changed check if color or strokeWidth need to be updated
      this._updateSubLayerTriggers(oldProps, props);
    }
  }

  finalizeState() {
    super.finalizeState();
    this.state.gridAggregator.delete();
  }

  renderLayers() {
    const {contourSegments, contourPolygons} = this.state.contourData;
    const hasIsolines = contourSegments && contourSegments.length > 0;
    const hasIsobands = contourPolygons && contourPolygons.length > 0;

    const lineLayer = hasIsolines && new LineLayer(this._getLineLayerProps());
    const solidPolygonLayer =
      hasIsobands && new SolidPolygonLayer(this._getSolidPolygonLayerProps());
    return [lineLayer, solidPolygonLayer];
  }

  // Private

  _aggregateData(aggregationFlags) {
    const {
      data,
      cellSize: cellSizeMeters,
      getPosition,
      getWeight,
      gpuAggregation,
      fp64,
      coordinateSystem
    } = this.props;
    const {weights, gridSize, gridOrigin, cellSize, boundingBox} = pointToDensityGridData({
      data,
      cellSizeMeters,
      getPosition,
      weightParams: {count: {getWeight}},
      gpuAggregation,
      gpuGridAggregator: this.state.gridAggregator,
      fp64,
      coordinateSystem,
      viewport: this.context.viewport,
      boundingBox: this.state.boundingBox, // avoid parsing data when it is not changed.
      aggregationFlags
    });

    this.setState({
      countsData: weights.count.aggregationData,
      countsBuffer: weights.count.aggregationBuffer,
      gridSize,
      gridOrigin,
      cellSize,
      boundingBox
    });
  }

  _generateContours() {
    const {gridSize, gridOrigin, cellSize, thresholdData} = this.state;
    let {countsData} = this.state;
    if (!countsData) {
      const {countsBuffer} = this.state;
      countsData = countsBuffer.getData();
      this.setState({countsData});
    }

    const {cellWeights} = GPUGridAggregator.getCellData({countsData});
    // const thresholds = this.props.contours.map(x => x.threshold);
    const contourData = generateContours({
      thresholdData,
      cellWeights,
      gridSize,
      gridOrigin,
      cellSize
    });

    // contourData contains both iso-lines and iso-bands if requested.
    this.setState({contourData});
  }

  _getAggregationFlags({oldProps, props, changeFlags}) {
    let aggregationFlags = null;
    if (
      changeFlags.dataChanged ||
      oldProps.gpuAggregation !== props.gpuAggregation ||
      (changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getPosition))
    ) {
      aggregationFlags = Object.assign({}, aggregationFlags, {dataChanged: true});
    }
    if (oldProps.cellSize !== props.cellSize) {
      aggregationFlags = Object.assign({}, aggregationFlags, {cellSizeChanged: true});
    }
    return aggregationFlags;
  }

  _getLineLayerProps() {
    const {fp64} = this.props;
    const {colorTrigger, strokeWidthTrigger} = this.state;

    return this.getSubLayerProps({
      id: 'contour-line-layer',
      data: this.state.contourData.contourSegments,
      fp64,
      getSourcePosition: d => d.start,
      getTargetPosition: d => d.end,
      getColor: this._onGetSublayerColor.bind(this),
      getWidth: this._onGetSublayerStrokeWidth.bind(this),
      widthUnits: 'pixels',
      updateTriggers: {
        getColor: colorTrigger,
        getWidth: strokeWidthTrigger
      }
    });
  }

  _getSolidPolygonLayerProps() {
    const {fp64} = this.props;
    const {colorTrigger} = this.state;

    return this.getSubLayerProps({
      id: 'contour-solid-polygon-layer',
      data: this.state.contourData.contourPolygons,
      fp64,
      getPolygon: d => d.vertices,
      getFillColor: this._onGetSublayerColor.bind(this),
      updateTriggers: {
        getFillColor: colorTrigger
      }
    });
  }

  _onGetSublayerColor(element) {
    // element is either a line segment or polygon
    const {contours} = this.props;
    let color = DEFAULT_COLOR;
    contours.forEach(data => {
      if (equals(data.threshold, element.threshold)) {
        color = data.color || DEFAULT_COLOR;
      }
    });
    return color;
  }

  _onGetSublayerStrokeWidth(segment) {
    const {contours} = this.props;
    let strokeWidth = DEFAULT_STROKE_WIDTH;
    // Linearly searches the contours, but there should only be few contours
    contours.some(contour => {
      if (contour.threshold === segment.threshold) {
        strokeWidth = contour.strokeWidth || DEFAULT_STROKE_WIDTH;
        return true;
      }
      return false;
    });
    return strokeWidth;
  }

  _shouldRebuildContours({oldProps, props}) {
    if (
      !oldProps.contours ||
      !oldProps.zOffset ||
      oldProps.contours.length !== props.contours.length ||
      oldProps.zOffset !== props.zOffset
    ) {
      return true;
    }
    const oldThresholds = oldProps.contours.map(x => x.threshold);
    const thresholds = props.contours.map(x => x.threshold);

    return thresholds.some((_, i) => !equals(thresholds[i], oldThresholds[i]));
  }

  _updateSubLayerTriggers(oldProps, props) {
    if (oldProps && oldProps.contours && props && props.contours) {
      if (props.contours.some((contour, i) => contour.color !== oldProps.contours[i].color)) {
        this.state.colorTrigger++;
      }
      if (
        props.contours.some(
          (contour, i) => contour.strokeWidth !== oldProps.contours[i].strokeWidth
        )
      ) {
        this.state.strokeWidthTrigger++;
      }
    }
  }

  _updateThresholdData(props) {
    const thresholdData = props.contours.map((x, index) => {
      return {
        threshold: x.threshold,
        zIndex: x.zIndex || index,
        zOffset: props.zOffset
      };
    });
    this.setState({thresholdData});
  }
}

ContourLayer.layerName = 'ContourLayer';
ContourLayer.defaultProps = defaultProps;
