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
/* eslint-disable max-len */

export {default as ScreenGridLayer} from './screen-grid-layer/screen-grid-layer';
export {default as CPUGridLayer} from './cpu-grid-layer/cpu-grid-layer';
export {default as HexagonLayer} from './hexagon-layer/hexagon-layer';
export {default as ContourLayer} from './contour-layer/contour-layer';
export {default as GridLayer} from './grid-layer/grid-layer';
export {default as GPUGridLayer} from './gpu-grid-layer/gpu-grid-layer';
export {AGGREGATION_OPERATION} from './utils/aggregation-operation-utils';

// experimental export
export {default as _GPUGridAggregator} from './utils/gpu-grid-aggregation/gpu-grid-aggregator';

import {default as BinSorter} from './utils/bin-sorter';
import {linearScale, getLinearScale, quantizeScale, getQuantizeScale} from './utils/scale-utils';
import {defaultColorRange} from './utils/color-utils';

export const experimental = {
  BinSorter,

  linearScale,
  getLinearScale,
  quantizeScale,
  getQuantizeScale,

  defaultColorRange
};
