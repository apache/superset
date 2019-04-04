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

import lightingShader from './lighting.glsl';
import project from '../project/project';
import {COORDINATE_SYSTEM} from '../../lib/constants';
import {projectPosition} from '../project/project-functions';
import memoize from '../../utils/memoize';

export default {
  name: 'lighting',
  dependencies: [project],
  vs: lightingShader,
  getUniforms,
  deprecations: [
    // Deprecated lighting functions
    {type: 'function', old: 'getLightWeight', new: 'lighting_getLightWeight', deprecated: true}
  ]
};

const INITIAL_MODULE_OPTIONS = {};

const DEFAULT_LIGHTS_POSITION = [-122.45, 37.75, 8000];
const DEFAULT_LIGHTS_STRENGTH = [2.0, 0.0];
const DEFAULT_AMBIENT_RATIO = 0.4;
const DEFAULT_DIFFUSE_RATIO = 0.6;
const DEFAULT_SPECULAR_RATIO = 0.8;
const DEFAULT_COORDINATE_ORIGIN = [0, 0, 0];

const getMemoizedLightPositions = memoize(preprojectLightPositions);

// TODO: support partial update, e.g.
// `lightedModel.setModuleParameters({diffuseRatio: 0.3});`
function getUniforms(opts = INITIAL_MODULE_OPTIONS) {
  if (!opts.lightSettings) {
    return {};
  }

  const {
    numberOfLights = 1,

    lightsPosition = DEFAULT_LIGHTS_POSITION,
    lightsStrength = DEFAULT_LIGHTS_STRENGTH,
    coordinateSystem = COORDINATE_SYSTEM.LNGLAT,
    coordinateOrigin = DEFAULT_COORDINATE_ORIGIN,
    modelMatrix = null,

    ambientRatio = DEFAULT_AMBIENT_RATIO,
    diffuseRatio = DEFAULT_DIFFUSE_RATIO,
    specularRatio = DEFAULT_SPECULAR_RATIO
  } = opts.lightSettings;

  // Pre-project light positions
  const lightsPositionWorld = getMemoizedLightPositions({
    lightsPosition,
    numberOfLights,
    viewport: opts.viewport,
    modelMatrix,
    coordinateSystem: opts.coordinateSystem,
    coordinateOrigin: opts.coordinateOrigin,
    fromCoordinateSystem: coordinateSystem,
    fromCoordinateOrigin: coordinateOrigin
  });

  return {
    lighting_lightPositions: lightsPositionWorld,
    lighting_lightStrengths: lightsStrength,
    lighting_ambientRatio: ambientRatio,
    lighting_diffuseRatio: diffuseRatio,
    lighting_specularRatio: specularRatio,
    lighting_numberOfLights: numberOfLights
  };
}

// Pre-project light positions
function preprojectLightPositions({
  lightsPosition,
  numberOfLights,
  viewport,
  modelMatrix,
  coordinateSystem,
  coordinateOrigin,
  fromCoordinateSystem,
  fromCoordinateOrigin
}) {
  const projectionParameters = {
    viewport,
    modelMatrix,
    coordinateSystem,
    coordinateOrigin,
    fromCoordinateSystem,
    fromCoordinateOrigin
  };

  const lightsPositionWorld = [];
  for (let i = 0; i < numberOfLights; i++) {
    const position = projectPosition(lightsPosition.slice(i * 3, i * 3 + 3), projectionParameters);

    lightsPositionWorld[i * 3] = position[0];
    lightsPositionWorld[i * 3 + 1] = position[1];
    lightsPositionWorld[i * 3 + 2] = position[2];
  }

  return lightsPositionWorld;
}
