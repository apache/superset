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

// Intialize globals, check version
import './lib/init';

// Import shaderlib to make sure shader modules are initialized
import './shaderlib';

// Core Library
export {COORDINATE_SYSTEM} from './lib/constants';

// Effects
export {default as LightingEffect} from './effects/lighting/lighting-effect';
export {default as PointLight} from './effects/lighting/point-light';
export {default as DirectionalLight} from './effects/lighting/directional-light';
export {default as _CameraLight} from './effects/lighting/camera-light';
export {default as _SunLight} from './effects/lighting/sun-light';
export {default as PostProcessEffect} from './effects/post-process-effect';

// Passes
export {default as _LayersPass} from './passes/layers-pass';

// Experimental Pure JS (non-React) bindings
export {default as Deck} from './lib/deck';

export {default as LayerManager} from './lib/layer-manager';
export {default as AttributeManager} from './lib/attribute-manager';
export {default as Layer} from './lib/layer';
export {default as CompositeLayer} from './lib/composite-layer';
export {default as DeckRenderer} from './lib/deck-renderer';

// Viewports
export {default as Viewport} from './viewports/viewport';
export {default as WebMercatorViewport} from './viewports/web-mercator-viewport';

// Shader modules
export {default as project} from './shaderlib/project/project';
export {default as project64} from './shaderlib/project64/project64';

export {default as View} from './views/view';
export {default as MapView} from './views/map-view';
export {default as FirstPersonView} from './views/first-person-view';
export {default as ThirdPersonView} from './views/third-person-view';
export {default as OrbitView} from './views/orbit-view';
export {default as PerspectiveView} from './views/perspective-view';
export {default as OrthographicView} from './views/orthographic-view';

// Controllers
export {default as Controller} from './controllers/controller';
export {default as MapController} from './controllers/map-controller';
// Experimental Controllers
export {default as _FirstPersonController} from './controllers/first-person-controller';
export {default as _OrbitController} from './controllers/orbit-controller';
export {default as _OrthographicController} from './controllers/orthographic-controller';

// EXPERIMENTAL EXPORTS

// Experimental Effects (non-React) bindings
export {default as Effect} from './lib/effect';

// Eperimental Transitions
export {TRANSITION_EVENTS} from './controllers/transition-manager';
export {default as LinearInterpolator} from './transitions/linear-interpolator';
export {default as FlyToInterpolator} from './transitions/viewport-fly-to-interpolator';

// Layer utilities
export {default as log} from './utils/log';
import {flattenVertices, fillArray} from './utils/flatten'; // Export? move to luma.gl or math.gl?

export {createIterable} from './utils/iterable-utils';
import Tesselator from './utils/tesselator'; // Export? move to luma.gl or math.gl?
import {count} from './utils/count';
import memoize from './utils/memoize';

// lighting
export {AmbientLight} from '@luma.gl/core';

// Exports for layers
// Experimental Features may change in minor version bumps, use at your own risk)
export const experimental = {
  Tesselator,
  flattenVertices,
  fillArray,
  count,
  memoize
};
