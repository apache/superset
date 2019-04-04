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

// Core Layers
export {default as ArcLayer} from './arc-layer/arc-layer';
export {default as IconLayer} from './icon-layer/icon-layer';
export {default as LineLayer} from './line-layer/line-layer';
export {default as PointCloudLayer} from './point-cloud-layer/point-cloud-layer';
export {default as ScatterplotLayer} from './scatterplot-layer/scatterplot-layer';

export {default as ScreenGridLayer} from './screen-grid-layer/screen-grid-layer';
export {default as GridLayer} from './grid-layer/grid-layer';
export {default as GridCellLayer} from './grid-cell-layer/grid-cell-layer';

export {default as HexagonLayer} from './hexagon-layer/hexagon-layer';
export {default as HexagonCellLayer} from './hexagon-cell-layer/hexagon-cell-layer';

export {default as PathLayer} from './path-layer/path-layer';
export {default as PolygonLayer} from './polygon-layer/polygon-layer';
export {default as GeoJsonLayer} from './geojson-layer/geojson-layer';

export {default as TextLayer} from './text-layer/text-layer';

// Experimental layer exports
export {default as _SolidPolygonLayer} from './solid-polygon-layer/solid-polygon-layer';
export {default as _MultiIconLayer} from './text-layer/multi-icon-layer/multi-icon-layer';
