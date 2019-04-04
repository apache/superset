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

import {CompositeLayer} from '@deck.gl/core';
import SolidPolygonLayer from '../solid-polygon-layer/solid-polygon-layer';
import PathLayer from '../path-layer/path-layer';
import * as Polygon from '../solid-polygon-layer/polygon';

const defaultLineColor = [0x0, 0x0, 0x0, 0xff];
const defaultFillColor = [0x0, 0x0, 0x0, 0xff];

const defaultProps = {
  stroked: true,
  filled: true,
  extruded: false,
  elevationScale: 1,
  wireframe: false,

  lineWidthScale: 1,
  lineWidthMinPixels: 0,
  lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,
  lineJointRounded: false,
  lineMiterLimit: 4,
  lineDashJustified: false,
  fp64: false,

  getPolygon: f => f.polygon,
  // Polygon fill color
  getFillColor: f => f.fillColor || defaultFillColor,
  // Point, line and polygon outline color
  getLineColor: f => f.lineColor || defaultLineColor,
  // Line and polygon outline accessors
  getLineWidth: f => f.lineWidth || 1,
  // Line dash array accessor
  getLineDashArray: null,
  // Polygon extrusion accessor
  getElevation: f => f.elevation || 1000,

  // Optional settings for 'lighting' shader module
  lightSettings: {}
};

export default class PolygonLayer extends CompositeLayer {
  initializeState() {
    this.state = {
      paths: []
    };
  }

  updateState({oldProps, props, changeFlags}) {
    const geometryChanged =
      changeFlags.dataChanged ||
      (changeFlags.updateTriggersChanged &&
        (changeFlags.updateTriggersChanged.all || changeFlags.updateTriggersChanged.getPolygon));

    if (geometryChanged) {
      const {data, getPolygon} = this.props;
      this.state.paths = [];
      data.forEach(object => {
        const complexPolygon = Polygon.normalize(getPolygon(object));
        complexPolygon.forEach(polygon =>
          this.state.paths.push({
            path: polygon,
            object
          })
        );
      });
    }
  }

  getPickingInfo({info}) {
    return Object.assign(info, {
      // override object with picked data
      object: (info.object && info.object.object) || info.object
    });
  }

  _getAccessor(accessor) {
    if (typeof accessor === 'function') {
      return x => accessor(x.object);
    }
    return accessor;
  }

  /* eslint-disable complexity */
  renderLayers() {
    // Layer composition props
    const {data, stroked, filled, extruded, wireframe, elevationScale} = this.props;

    // Rendering props underlying layer
    const {
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      lineJointRounded,
      lineMiterLimit,
      lineDashJustified,
      fp64
    } = this.props;

    // Accessor props for underlying layers
    const {
      getFillColor,
      getLineColor,
      getLineWidth,
      getLineDashArray,
      getElevation,
      getPolygon,
      updateTriggers,
      lightSettings
    } = this.props;

    const {paths} = this.state;

    const hasData = data && data.length > 0;

    // Filled Polygon Layer
    const polygonLayer =
      hasData &&
      new SolidPolygonLayer(
        this.getSubLayerProps({
          id: 'fill',
          updateTriggers: {
            getElevation: updateTriggers.getElevation,
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor
          }
        }),
        {
          data,
          extruded,
          elevationScale,

          fp64,
          filled,
          wireframe,

          getPolygon,
          getElevation,
          getFillColor,
          getLineColor,

          lightSettings
        }
      );

    // Polygon line layer
    const polygonLineLayer =
      !extruded &&
      stroked &&
      hasData &&
      new PathLayer(
        this.getSubLayerProps({
          id: 'stroke',
          updateTriggers: {
            getWidth: updateTriggers.getLineWidth,
            getColor: updateTriggers.getLineColor,
            getDashArray: updateTriggers.getLineDashArray
          }
        }),
        {
          data: paths,

          fp64,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,
          dashJustified: lineDashJustified,

          getPath: x => x.path,
          getColor: this._getAccessor(getLineColor),
          getWidth: this._getAccessor(getLineWidth),
          getDashArray: this._getAccessor(getLineDashArray)
        }
      );

    return [
      // If not extruded: flat fill layer is drawn below outlines
      !extruded && polygonLayer,
      polygonLineLayer,
      // If extruded: draw fill layer last for correct blending behavior
      extruded && polygonLayer
    ];
  }
  /* eslint-enable complexity */
}

PolygonLayer.layerName = 'PolygonLayer';
PolygonLayer.defaultProps = defaultProps;
