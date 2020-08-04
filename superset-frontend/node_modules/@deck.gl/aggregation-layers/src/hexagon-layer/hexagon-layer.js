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
import {ColumnLayer} from '@deck.gl/layers';

import BinSorter from '../utils/bin-sorter';
import {defaultColorRange} from '../utils/color-utils';
import {getQuantizeScale, getLinearScale} from '../utils/scale-utils';
import {getValueFunc} from '../utils/aggregation-operation-utils';

import {pointToHexbin} from './hexagon-aggregator';

function nop() {}

const defaultMaterial = new PhongMaterial();

const defaultProps = {
  // color
  colorDomain: null,
  colorRange: defaultColorRange,
  getColorValue: {type: 'accessor', value: null}, // default value is calcuated from `getColorWeight` and `colorAggregation`
  getColorWeight: {type: 'accessor', value: x => 1},
  colorAggregation: 'SUM',
  lowerPercentile: {type: 'number', value: 0, min: 0, max: 100},
  upperPercentile: {type: 'number', value: 100, min: 0, max: 100},
  onSetColorDomain: nop,

  // elevation
  elevationDomain: null,
  elevationRange: [0, 1000],
  getElevationValue: {type: 'accessor', value: null}, // default value is calcuated from `getElevationWeight` and `elevationAggregation`
  getElevationWeight: {type: 'accessor', value: x => 1},
  elevationAggregation: 'SUM',
  elevationLowerPercentile: {type: 'number', value: 0, min: 0, max: 100},
  elevationUpperPercentile: {type: 'number', value: 100, min: 0, max: 100},
  elevationScale: {type: 'number', min: 0, value: 1},
  onSetElevationDomain: nop,

  radius: {type: 'number', value: 1000, min: 1},
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  extruded: false,
  hexagonAggregator: pointToHexbin,
  getPosition: {type: 'accessor', value: x => x.position},
  fp64: false,
  // Optional material for 'lighting' shader module
  material: defaultMaterial
};

const COLOR_PROPS = ['getColorValue', 'colorAggregation', 'getColorWeight'];
const ELEVATION_PROPS = ['getElevationValue', 'elevationAggregation', 'getElevationWeight'];

export default class HexagonLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      hexagons: [],
      sortedColorBins: null,
      sortedElevationBins: null,
      colorValueDomain: null,
      elevationValueDomain: null,
      colorScaleFunc: nop,
      elevationScaleFunc: nop,
      dimensionUpdaters: this.getDimensionUpdaters()
    };
  }

  updateState({oldProps, props, changeFlags}) {
    this.updateGetValueFuncs(oldProps, props);
    const dimensionChanges = this.getDimensionChanges(oldProps, props);

    if (changeFlags.dataChanged || this.needsReProjectPoints(oldProps, props)) {
      // project data into hexagons, and get sortedColorBins
      this.getHexagons();
    } else if (dimensionChanges) {
      dimensionChanges.forEach(f => typeof f === 'function' && f.apply(this));
    }
  }

  colorElevationPropsChanged(oldProps, props) {
    let colorChanged = false;
    let elevationChanged = false;
    for (const p of COLOR_PROPS) {
      if (oldProps[p] !== props[p]) {
        colorChanged = true;
      }
    }
    for (const p of ELEVATION_PROPS) {
      if (oldProps[p] !== props[p]) {
        elevationChanged = true;
      }
    }
    return {colorChanged, elevationChanged};
  }

  updateGetValueFuncs(oldProps, props) {
    let {getColorValue, getElevationValue} = props;
    const {colorAggregation, getColorWeight, elevationAggregation, getElevationWeight} = this.props;
    const {colorChanged, elevationChanged} = this.colorElevationPropsChanged(oldProps, props);

    if (colorChanged && getColorValue === null) {
      // If `getColorValue` is not provided, build it.
      getColorValue = getValueFunc(colorAggregation, getColorWeight);
    }
    if (elevationChanged && getElevationValue === null) {
      // If `getElevationValue` is not provided, build it.
      getElevationValue = getValueFunc(elevationAggregation, getElevationWeight);
    }
    if (getColorValue) {
      this.setState({getColorValue});
    }
    if (getElevationValue) {
      this.setState({getElevationValue});
    }
  }

  needsReProjectPoints(oldProps, props) {
    return (
      oldProps.radius !== props.radius || oldProps.hexagonAggregator !== props.hexagonAggregator
    );
  }

  getDimensionUpdaters() {
    // dimension updaters are sequential,
    // if the first one needs to be called, the 2nd and 3rd one will automatically
    // be called. e.g. if ColorValue needs to be updated, getColorValueDomain and getColorScale
    // will automatically be called
    return {
      getFillColor: [
        {
          id: 'value',
          triggers: ['getColorValue', 'getColorWeight', 'colorAggregation'],
          updater: this.getSortedColorBins
        },
        {
          id: 'domain',
          triggers: ['lowerPercentile', 'upperPercentile'],
          updater: this.getColorValueDomain
        },
        {
          id: 'scaleFunc',
          triggers: ['colorDomain', 'colorRange'],
          updater: this.getColorScale
        }
      ],
      getElevation: [
        {
          id: 'value',
          triggers: ['getElevationValue', 'getElevationWeight', 'elevationAggregation'],
          updater: this.getSortedElevationBins
        },
        {
          id: 'domain',
          triggers: ['elevationLowerPercentile', 'elevationUpperPercentile'],
          updater: this.getElevationValueDomain
        },
        {
          id: 'scaleFunc',
          triggers: ['elevationDomain', 'elevationRange'],
          updater: this.getElevationScale
        }
      ]
    };
  }

  getDimensionChanges(oldProps, props) {
    const {dimensionUpdaters} = this.state;
    const updaters = [];

    // get dimension to be updated
    for (const dimensionKey in dimensionUpdaters) {
      // return the first triggered updater for each dimension
      const needUpdate = dimensionUpdaters[dimensionKey].find(item =>
        item.triggers.some(t => oldProps[t] !== props[t])
      );

      if (needUpdate) {
        updaters.push(needUpdate.updater);
      }
    }

    return updaters.length ? updaters : null;
  }

  getHexagons() {
    const {hexagonAggregator} = this.props;
    const {viewport} = this.context;
    const {hexagons, hexagonVertices} = hexagonAggregator(this.props, viewport);
    this.updateRadiusAngle(hexagonVertices);
    this.setState({hexagons});
    this.getSortedBins();
  }

  getPickingInfo({info}) {
    const {sortedColorBins, sortedElevationBins} = this.state;
    const isPicked = info.picked && info.index > -1;

    let object = null;
    if (isPicked) {
      const cell = this.state.hexagons[info.index];

      const colorValue =
        sortedColorBins.binMap[cell.index] && sortedColorBins.binMap[cell.index].value;
      const elevationValue =
        sortedElevationBins.binMap[cell.index] && sortedElevationBins.binMap[cell.index].value;

      object = Object.assign(
        {
          colorValue,
          elevationValue
        },
        cell
      );
    }

    // add bin colorValue and elevationValue to info
    return Object.assign(info, {
      picked: Boolean(object),
      // override object with picked cell
      object
    });
  }

  getUpdateTriggers() {
    const {dimensionUpdaters} = this.state;

    // merge all dimension triggers
    const updateTriggers = {};

    for (const dimensionKey in dimensionUpdaters) {
      updateTriggers[dimensionKey] = {};

      for (const step of dimensionUpdaters[dimensionKey]) {
        step.triggers.forEach(prop => {
          updateTriggers[dimensionKey][prop] = this.props[prop];
        });
      }
    }

    return updateTriggers;
  }

  updateRadiusAngle(vertices) {
    let {radius} = this.props;
    let angle = 90;

    if (Array.isArray(vertices)) {
      if (vertices.length < 6) {
        log.error('HexagonCellLayer: hexagonVertices needs to be an array of 6 points')();
      }

      // calculate angle and vertices from hexagonVertices if provided
      const vertex0 = vertices[0];
      const vertex3 = vertices[3];

      // transform to space coordinates
      const {viewport} = this.context;
      const {pixelsPerMeter} = viewport.getDistanceScales();
      const spaceCoord0 = this.projectFlat(vertex0);
      const spaceCoord3 = this.projectFlat(vertex3);

      // distance between two close centroids
      const dx = spaceCoord0[0] - spaceCoord3[0];
      const dy = spaceCoord0[1] - spaceCoord3[1];
      const dxy = Math.sqrt(dx * dx + dy * dy);

      // Calculate angle that the perpendicular hexagon vertex axis is tilted
      angle = ((Math.acos(dx / dxy) * -Math.sign(dy)) / Math.PI) * 180 + 90;
      radius = dxy / 2 / pixelsPerMeter[0];
    }

    this.setState({angle, radius});
  }

  getValueDomain() {
    this.getColorValueDomain();
    this.getElevationValueDomain();
  }

  getSortedBins() {
    this.getSortedColorBins();
    this.getSortedElevationBins();
  }

  getSortedColorBins() {
    const {getColorValue} = this.state;
    const sortedColorBins = new BinSorter(this.state.hexagons || [], getColorValue);

    this.setState({sortedColorBins});
    this.getColorValueDomain();
  }

  getSortedElevationBins() {
    const {getElevationValue} = this.state;
    const sortedElevationBins = new BinSorter(this.state.hexagons || [], getElevationValue);
    this.setState({sortedElevationBins});
    this.getElevationValueDomain();
  }

  getColorValueDomain() {
    const {lowerPercentile, upperPercentile, onSetColorDomain} = this.props;

    if (lowerPercentile > upperPercentile) {
      log.warn('HexagonLayer: lowerPercentile is bigger than upperPercentile')();
    }

    this.state.colorValueDomain = this.state.sortedColorBins.getValueRange([
      lowerPercentile,
      upperPercentile
    ]);

    if (typeof onSetColorDomain === 'function') {
      onSetColorDomain(this.state.colorValueDomain);
    }

    this.getColorScale();
  }

  getElevationValueDomain() {
    const {elevationLowerPercentile, elevationUpperPercentile, onSetElevationDomain} = this.props;

    this.state.elevationValueDomain = this.state.sortedElevationBins.getValueRange([
      elevationLowerPercentile,
      elevationUpperPercentile
    ]);

    if (typeof onSetElevationDomain === 'function') {
      onSetElevationDomain(this.state.elevationValueDomain);
    }

    this.getElevationScale();
  }

  getColorScale() {
    const {colorRange} = this.props;
    const colorDomain = this.props.colorDomain || this.state.colorValueDomain;

    this.state.colorScaleFunc = getQuantizeScale(colorDomain, colorRange);
  }

  getElevationScale() {
    const {elevationRange} = this.props;
    const elevationDomain = this.props.elevationDomain || this.state.elevationValueDomain;

    this.state.elevationScaleFunc = getLinearScale(elevationDomain, elevationRange);
  }

  _onGetSublayerColor(cell) {
    const {sortedColorBins, colorScaleFunc, colorValueDomain} = this.state;

    const cv = sortedColorBins.binMap[cell.index] && sortedColorBins.binMap[cell.index].value;
    const colorDomain = this.props.colorDomain || colorValueDomain;

    const isColorValueInDomain = cv >= colorDomain[0] && cv <= colorDomain[colorDomain.length - 1];

    // if cell value is outside domain, set alpha to 0
    const color = isColorValueInDomain ? colorScaleFunc(cv) : [0, 0, 0, 0];

    // add alpha to color if not defined in colorRange
    color[3] = Number.isFinite(color[3]) ? color[3] : 255;

    return color;
  }

  _onGetSublayerElevation(cell) {
    const {sortedElevationBins, elevationScaleFunc, elevationValueDomain} = this.state;
    const ev =
      sortedElevationBins.binMap[cell.index] && sortedElevationBins.binMap[cell.index].value;

    const elevationDomain = this.props.elevationDomain || elevationValueDomain;

    const isElevationValueInDomain =
      ev >= elevationDomain[0] && ev <= elevationDomain[elevationDomain.length - 1];

    // if cell value is outside domain, set elevation to -1
    return isElevationValueInDomain ? elevationScaleFunc(ev) : -1;
  }

  renderLayers() {
    const {elevationScale, extruded, coverage, material, fp64, transitions} = this.props;
    const {angle, radius} = this.state;

    const SubLayerClass = this.getSubLayerClass('hexagon-cell', ColumnLayer);

    return new SubLayerClass(
      {
        fp64,
        radius,
        diskResolution: 6,
        elevationScale,
        angle,
        extruded,
        coverage,
        material,

        getFillColor: this._onGetSublayerColor.bind(this),
        getElevation: this._onGetSublayerElevation.bind(this),
        transitions: transitions && {
          getFillColor: transitions.getColorValue || transitions.getColorWeight,
          getElevation: transitions.getElevationValue || transitions.getElevationWeight
        }
      },
      this.getSubLayerProps({
        id: 'hexagon-cell',
        updateTriggers: this.getUpdateTriggers()
      }),
      {
        data: this.state.hexagons
      }
    );
  }
}

HexagonLayer.layerName = 'HexagonLayer';
HexagonLayer.defaultProps = defaultProps;
