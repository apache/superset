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
import {PolygonLayer} from '@deck.gl/layers';

import {getS2Polygon} from './s2-utils';

const defaultProps = Object.assign(
  {
    getS2Token: {type: 'accessor', value: d => d.token}
  },
  PolygonLayer.defaultProps
);

export default class S2Layer extends CompositeLayer {
  renderLayers() {
    // Layer prop
    const {data, getS2Token} = this.props;

    // Rendering props underlying layer
    const {
      elevationScale,
      extruded,
      wireframe,
      filled,
      stroked,
      lineWidthUnits,
      lineWidthScale,
      lineWidthMinPixels,
      lineWidthMaxPixels,
      lineJointRounded,
      lineMiterLimit,
      lineDashJustified,
      fp64,
      getElevation,
      getFillColor,
      getLineColor,
      getLineWidth,
      getLineDashArray
    } = this.props;

    // Accessor props for underlying layers
    const {updateTriggers, material} = this.props;

    // Filled Polygon Layer
    const CellLayer = this.getSubLayerClass('cell', PolygonLayer);
    return new CellLayer(
      {
        fp64,
        filled,
        wireframe,

        extruded,
        elevationScale,

        stroked,
        lineWidthUnits,
        lineWidthScale,
        lineWidthMinPixels,
        lineWidthMaxPixels,
        lineJointRounded,
        lineMiterLimit,
        lineDashJustified,

        material,

        getElevation,
        getFillColor,
        getLineColor,
        getLineWidth,
        getLineDashArray
      },
      this.getSubLayerProps({
        id: 'cell',
        updateTriggers: {
          getElevation: updateTriggers.getElevation,
          getFillColor: updateTriggers.getFillColor,
          getLineColor: updateTriggers.getLineColor,
          getLineWidth: updateTriggers.getLineWidth,
          getLineDashArray: updateTriggers.getLineDashArray
        }
      }),
      {
        data,
        getPolygon: x => getS2Polygon(getS2Token(x))
      }
    );
  }
}

S2Layer.layerName = 'S2Layer';
S2Layer.defaultProps = defaultProps;
