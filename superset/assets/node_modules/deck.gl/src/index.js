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
  PerspectiveViewport,
  OrthographicViewport,
  // Controllers
  Controller,
  MapController,
  // For custom layers
  AttributeManager,
  // Shader modules
  project,
  project64,
  lighting,
  // Internal classes
  LayerManager,
  // Logging
  log
} from '@deck.gl/core';

// EXPERIMENTAL CORE LIB CLASSES (May change in minor version bumps, use at your own risk)
import {experimental as CoreExperimental} from '@deck.gl/core';

const {
  // Controllers
  OrbitController,
  FirstPersonController,

  // Viewports
  FirstPersonViewport,
  OrbitViewport,
  ThirdPersonViewport,

  // Transition bindings
  TRANSITION_EVENTS,
  LinearInterpolator,
  ViewportFlyToInterpolator,

  EffectManager,
  Effect
} = CoreExperimental;

Object.assign(experimental, {
  // Controller helper classes
  OrbitController,
  FirstPersonController,

  // Experimental viewports
  FirstPersonViewport,
  OrbitViewport,
  ThirdPersonViewport,

  // Transition bindings
  TRANSITION_EVENTS,
  LinearInterpolator,
  ViewportFlyToInterpolator,

  // Effects base classes
  EffectManager,
  Effect
});

// Experimental Data Accessor Helpers
// INTERNAL - TODO remove from experimental exports
const {
  // For layers
  BinSorter,
  linearScale,
  getLinearScale,
  quantizeScale,
  getQuantizeScale,
  defaultColorRange,
  flattenVertices,
  fillArray,

  ReflectionEffect
} = CoreExperimental;

Object.assign(experimental, {
  // For layers
  BinSorter,
  linearScale,
  getLinearScale,
  quantizeScale,
  getQuantizeScale,
  defaultColorRange,
  flattenVertices,
  fillArray,

  ReflectionEffect
});

//
// CORE LAYERS PACKAGE
//

export {
  ArcLayer,
  IconLayer,
  LineLayer,
  PointCloudLayer,
  ScatterplotLayer,
  ScreenGridLayer,
  GridLayer,
  GridCellLayer,
  HexagonLayer,
  HexagonCellLayer,
  PathLayer,
  PolygonLayer,
  GeoJsonLayer,
  TextLayer
} from '@deck.gl/layers';

//
// REACT BINDINGS PACKAGE
//

export {default, DeckGL} from '@deck.gl/react';

import {
  ViewportController // TODO - merge with deck.gl?
} from '@deck.gl/react';

Object.assign(experimental, {
  ViewportController
});

//
// EXPERIMENTAL EXPORTS
//

export {experimental};
