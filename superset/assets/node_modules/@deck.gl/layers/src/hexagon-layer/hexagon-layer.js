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

import {CompositeLayer, log, experimental} from '@deck.gl/core';
import HexagonCellLayer from '../hexagon-cell-layer/hexagon-cell-layer';

const {BinSorter, getQuantizeScale, getLinearScale, defaultColorRange} = experimental;

import {pointToHexbin} from './hexagon-aggregator';

function nop() {}

const defaultProps = {
  // color
  colorDomain: null,
  colorRange: defaultColorRange,
  getColorValue: points => points.length,
  lowerPercentile: 0,
  upperPercentile: 100,
  onSetColorDomain: nop,

  // elevation
  elevationDomain: null,
  elevationRange: [0, 1000],
  getElevationValue: points => points.length,
  elevationLowerPercentile: 0,
  elevationUpperPercentile: 100,
  elevationScale: {type: 'number', min: 0, value: 1},
  onSetElevationDomain: nop,

  radius: 1000,
  coverage: {type: 'number', min: 0, max: 1, value: 1},
  extruded: false,
  hexagonAggregator: pointToHexbin,
  getPosition: x => x.position,
  fp64: false,
  // Optional settings for 'lighting' shader module
  lightSettings: {}
};

export default class HexagonLayer extends CompositeLayer {
  constructor(props) {
    if (!props.hexagonAggregator && !props.radius) {
      log.once(
        0,
        'HexagonLayer: Default hexagonAggregator requires radius prop to be set, ' +
          'Now using 1000 meter as default'
      )();

      props.radius = defaultProps.radius;
    }

    if (
      Number.isFinite(props.upperPercentile) &&
      (props.upperPercentile > 100 || props.upperPercentile < 0)
    ) {
      log.once(
        0,
        'HexagonLayer: upperPercentile should be between 0 and 100. ' + 'Assign to 100 by default'
      )();

      props.upperPercentile = defaultProps.upperPercentile;
    }

    if (
      Number.isFinite(props.lowerPercentile) &&
      (props.lowerPercentile > 100 || props.lowerPercentile < 0)
    ) {
      log.once(
        0,
        'HexagonLayer: lowerPercentile should be between 0 and 100. ' + 'Assign to 0 by default'
      )();

      props.lowerPercentile = defaultProps.upperPercentile;
    }

    if (props.lowerPercentile >= props.upperPercentile) {
      log.once(
        0,
        'HexagonLayer: lowerPercentile should not be bigger than ' +
          'upperPercentile. Assign to 0 by default'
      )();

      props.lowerPercentile = defaultProps.lowerPercentile;
    }

    super(props);
  }

  initializeState() {
    this.state = {
      hexagons: [],
      hexagonVertices: null,
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
    const dimensionChanges = this.getDimensionChanges(oldProps, props);

    if (changeFlags.dataChanged || this.needsReProjectPoints(oldProps, props)) {
      // project data into hexagons, and get sortedColorBins
      this.getHexagons();
    } else if (dimensionChanges) {
      dimensionChanges.forEach(f => typeof f === 'function' && f.apply(this));
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
      getColor: [
        {
          id: 'value',
          triggers: ['getColorValue'],
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
          triggers: ['getElevationValue'],
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
    this.setState({hexagons, hexagonVertices});
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

  getValueDomain() {
    this.getColorValueDomain();
    this.getElevationValueDomain();
  }

  getSortedBins() {
    this.getSortedColorBins();
    this.getSortedElevationBins();
  }

  getSortedColorBins() {
    const {getColorValue} = this.props;
    const sortedColorBins = new BinSorter(this.state.hexagons || [], getColorValue);

    this.setState({sortedColorBins});
    this.getColorValueDomain();
  }

  getSortedElevationBins() {
    const {getElevationValue} = this.props;
    const sortedElevationBins = new BinSorter(this.state.hexagons || [], getElevationValue);
    this.setState({sortedElevationBins});
    this.getElevationValueDomain();
  }

  getColorValueDomain() {
    const {lowerPercentile, upperPercentile, onSetColorDomain} = this.props;

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

  // for subclassing, override this method to return
  // customized sub layer props
  getSubLayerProps() {
    const {
      radius,
      elevationScale,
      extruded,
      coverage,
      lightSettings,
      fp64,
      transitions
    } = this.props;

    // return props to the sublayer constructor
    return super.getSubLayerProps({
      id: 'hexagon-cell',
      data: this.state.hexagons,

      fp64,
      hexagonVertices: this.state.hexagonVertices,
      radius,
      elevationScale,
      angle: Math.PI / 2,
      extruded,
      coverage,
      lightSettings,

      getColor: this._onGetSublayerColor.bind(this),
      getElevation: this._onGetSublayerElevation.bind(this),
      transitions: transitions && {
        getColor: transitions.getColorValue,
        getElevation: transitions.getElevationValue
      },
      updateTriggers: this.getUpdateTriggers()
    });
  }

  // for subclassing, override this method to return
  // customized sub layer class
  getSubLayerClass() {
    return HexagonCellLayer;
  }

  renderLayers() {
    const SubLayerClass = this.getSubLayerClass();

    return new SubLayerClass(this.getSubLayerProps());
  }
}

HexagonLayer.layerName = 'HexagonLayer';
HexagonLayer.defaultProps = defaultProps;
