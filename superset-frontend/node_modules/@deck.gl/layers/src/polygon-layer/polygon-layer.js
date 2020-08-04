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
import {CompositeLayer, createIterable} from '@deck.gl/core';
import SolidPolygonLayer from '../solid-polygon-layer/solid-polygon-layer';
import PathLayer from '../path-layer/path-layer';
import * as Polygon from '../solid-polygon-layer/polygon';

const defaultLineColor = [0, 0, 0, 255];
const defaultFillColor = [0, 0, 0, 255];
const defaultMaterial = new PhongMaterial();

const defaultProps = {
  stroked: true,
  filled: true,
  extruded: false,
  elevationScale: 1,
  wireframe: false,

  lineWidthUnits: 'meters',
  lineWidthScale: 1,
  lineWidthMinPixels: 0,
  lineWidthMaxPixels: Number.MAX_SAFE_INTEGER,
  lineJointRounded: false,
  lineMiterLimit: 4,
  lineDashJustified: false,
  fp64: false,

  getPolygon: {type: 'accessor', value: f => f.polygon},
  // Polygon fill color
  getFillColor: {type: 'accessor', value: defaultFillColor},
  // Point, line and polygon outline color
  getLineColor: {type: 'accessor', value: defaultLineColor},
  // Line and polygon outline accessors
  getLineWidth: {type: 'accessor', value: 1},
  // Line dash array accessor
  getLineDashArray: {type: 'accessor', value: [0, 0]},
  // Polygon extrusion accessor
  getElevation: {type: 'accessor', value: 1000},

  // Optional material for 'lighting' shader module
  material: defaultMaterial
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
      this.state.paths = this._getPaths(props);
    }
  }

  getPickingInfo({info}) {
    return Object.assign(info, {
      // override object with picked data
      object: (info.object && info.object.object) || info.object
    });
  }

  _getPaths({data, getPolygon, positionFormat}) {
    const paths = [];
    const positionSize = positionFormat === 'XY' ? 2 : 3;

    const {iterable, objectInfo} = createIterable(data);
    for (const object of iterable) {
      objectInfo.index++;
      const {positions, holeIndices} = Polygon.normalize(
        getPolygon(object, objectInfo),
        positionSize
      );

      if (holeIndices) {
        // split the positions array into `holeIndices.length + 1` rings
        // holeIndices[-1] falls back to 0
        // holeIndices[holeIndices.length] falls back to positions.length
        for (let i = 0; i <= holeIndices.length; i++) {
          const path = positions.subarray(
            holeIndices[i - 1] || 0,
            holeIndices[i] || positions.length
          );
          paths.push({path, object});
        }
      } else {
        paths.push({path: positions, object});
      }
    }
    return paths;
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
    const {data, stroked, filled, extruded, wireframe, elevationScale, transitions} = this.props;

    // Rendering props underlying layer
    const {
      lineWidthUnits,
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
      material
    } = this.props;

    const {paths} = this.state;

    const FillLayer = this.getSubLayerClass('fill', SolidPolygonLayer);
    const StrokeLayer = this.getSubLayerClass('stroke', PathLayer);

    // Filled Polygon Layer
    const polygonLayer =
      this.shouldRenderSubLayer('fill', paths) &&
      new FillLayer(
        {
          extruded,
          elevationScale,

          fp64,
          filled,
          wireframe,

          getElevation,
          getFillColor,
          getLineColor,

          material,
          transitions
        },
        this.getSubLayerProps({
          id: 'fill',
          updateTriggers: {
            getPolygon: updateTriggers.getPolygon,
            getElevation: updateTriggers.getElevation,
            getFillColor: updateTriggers.getFillColor,
            getLineColor: updateTriggers.getLineColor
          }
        }),
        {
          data,
          getPolygon
        }
      );

    // Polygon line layer
    const polygonLineLayer =
      !extruded &&
      stroked &&
      this.shouldRenderSubLayer('stroke', paths) &&
      new StrokeLayer(
        {
          fp64,
          widthUnits: lineWidthUnits,
          widthScale: lineWidthScale,
          widthMinPixels: lineWidthMinPixels,
          widthMaxPixels: lineWidthMaxPixels,
          rounded: lineJointRounded,
          miterLimit: lineMiterLimit,
          dashJustified: lineDashJustified,

          transitions: transitions && {
            getWidth: transitions.getLineWidth,
            getColor: transitions.getLineColor,
            getPath: transitions.getPolygon
          },

          getColor: this._getAccessor(getLineColor),
          getWidth: this._getAccessor(getLineWidth),
          getDashArray: this._getAccessor(getLineDashArray)
        },
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
          getPath: x => x.path
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
