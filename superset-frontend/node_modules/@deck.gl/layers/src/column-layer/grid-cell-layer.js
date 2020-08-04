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

import {CubeGeometry} from '@luma.gl/core';
import ColumnLayer from './column-layer';

const defaultProps = {
  cellSize: {type: 'number', min: 0, value: 1000},
  offset: {type: 'array', min: 0, value: [1, 1]}
};

export default class GridCellLayer extends ColumnLayer {
  getGeometry(diskResolution) {
    return new CubeGeometry();
  }

  draw({uniforms}) {
    const {elevationScale, extruded, offset, coverage, cellSize, angle} = this.props;
    this.state.model
      .setUniforms(
        Object.assign({}, uniforms, {
          radius: cellSize / 2,
          angle,
          offset,
          extruded,
          coverage,
          elevationScale,
          edgeDistance: 1,
          isWireframe: false
        })
      )
      .draw();
  }
}

GridCellLayer.layerName = 'GridCellLayer';
GridCellLayer.defaultProps = defaultProps;
