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

const experimental = {};

//
// CORE LIBRARY
//

export {
  // CONSTANTS
  COORDINATE_SYSTEM,
  // Main class
  Deck,
  // Base Layers
  Layer,
  CompositeLayer,
  // Views
  View,
  MapView,
  FirstPersonView,
  ThirdPersonView,
  OrbitView,
  PerspectiveView,
  OrthographicView,
  // Viewports
  Viewport,
  WebMercatorViewport,
  // Controllers
  Controller,
  MapController,
  // For custom layers
  AttributeManager,
  // Shader modules
  project,
  project64,
  // Internal classes
  LayerManager,
  DeckRenderer,
  // Logging
  log,
  // Controllers
  _OrbitController,
  _FirstPersonController,
  // Transition bindings
  TRANSITION_EVENTS,
  LinearInterpolator,
  FlyToInterpolator,
  // Effects
  Effect,
  LightingEffect,
  PostProcessEffect,
  // Lights
  AmbientLight,
  PointLight,
  DirectionalLight
} from '@deck.gl/core';

// EXPERIMENTAL CORE LIB CLASSES (May change in minor version bumps, use at your own risk)
import {experimental as CoreExperimental} from '@deck.gl/core';
import {experimental as AggregationExperimental} from '@deck.gl/aggregation-layers';

// Experimental Data Accessor Helpers
// INTERNAL - TODO remove from experimental exports
const {
  // For layers
  count,
  flattenVertices,
  fillArray
} = CoreExperimental;

const {
  BinSorter,
  linearScale,
  getLinearScale,
  quantizeScale,
  getQuantizeScale,
  defaultColorRange
} = AggregationExperimental;

Object.assign(experimental, {
  // For layers
  BinSorter,
  linearScale,
  getLinearScale,
  quantizeScale,
  getQuantizeScale,
  defaultColorRange,
  count,
  flattenVertices,
  fillArray
});

//
// LAYERS PACKAGES
//

export {
  ArcLayer,
  BitmapLayer,
  IconLayer,
  LineLayer,
  PointCloudLayer,
  ScatterplotLayer,
  GridCellLayer,
  ColumnLayer,
  PathLayer,
  PolygonLayer,
  SolidPolygonLayer,
  GeoJsonLayer,
  TextLayer
} from '@deck.gl/layers';

export {
  ScreenGridLayer,
  CPUGridLayer,
  HexagonLayer,
  ContourLayer,
  GridLayer,
  GPUGridLayer
} from '@deck.gl/aggregation-layers';

export {
  GreatCircleLayer,
  S2Layer,
  H3ClusterLayer,
  H3HexagonLayer,
  TileLayer,
  TripsLayer
} from '@deck.gl/geo-layers';

export {SimpleMeshLayer, ScenegraphLayer} from '@deck.gl/mesh-layers';

//
// REACT BINDINGS PACKAGE
//

export {default, DeckGL} from '@deck.gl/react';

//
// EXPERIMENTAL EXPORTS
//

export {experimental};
