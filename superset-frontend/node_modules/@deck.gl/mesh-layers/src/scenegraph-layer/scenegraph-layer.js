// Copyright (c) 2019 Uber Technologies, Inc.
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

/* global fetch */
import {Layer, createIterable} from '@deck.gl/core';
import {fp64, ScenegraphNode, isWebGL2, pbr, log} from '@luma.gl/core';
import {load} from '@loaders.gl/core';

import {MATRIX_ATTRIBUTES} from '../utils/matrix';

import vs from './scenegraph-layer-vertex.glsl';
import fs from './scenegraph-layer-fragment.glsl';

const {fp64LowPart} = fp64;

const DEFAULT_COLOR = [255, 255, 255, 255];

const defaultProps = {
  scenegraph: {type: 'object', value: null, async: true},

  fetch: (url, {propName, layer}) => {
    if (propName === 'scenegraph') {
      return load(url, layer.getLoadOptions());
    }

    return fetch(url).then(response => response.json());
  },

  getScene: scenegraph => (scenegraph && scenegraph.scenes ? scenegraph.scenes[0] : scenegraph),
  getAnimator: scenegraph => scenegraph && scenegraph.animator,

  sizeScale: {type: 'number', value: 1, min: 0},
  getPosition: {type: 'accessor', value: x => x.position},
  getColor: {type: 'accessor', value: DEFAULT_COLOR},

  // flat or pbr
  _lighting: 'flat',
  // _lighting must be pbr for this to work
  _imageBasedLightingEnvironment: null,

  // yaw, pitch and roll are in degrees
  // https://en.wikipedia.org/wiki/Euler_angles
  // [pitch, yaw, roll]
  getOrientation: {type: 'accessor', value: [0, 0, 0]},
  getScale: {type: 'accessor', value: [1, 1, 1]},
  getTranslation: {type: 'accessor', value: [0, 0, 0]},
  // 4x4 matrix
  getTransformMatrix: {type: 'accessor', value: []}
};

export default class ScenegraphLayer extends Layer {
  initializeState() {
    const attributeManager = this.getAttributeManager();
    attributeManager.addInstanced({
      instancePositions: {
        size: 3,
        accessor: 'getPosition',
        transition: true
      },
      instancePositions64xy: {
        size: 2,
        accessor: 'getPosition',
        update: this.calculateInstancePositions64xyLow
      },
      instanceColors: {
        size: 4,
        accessor: 'getColor',
        defaultValue: DEFAULT_COLOR,
        transition: true
      },
      instanceModelMatrix: MATRIX_ATTRIBUTES
    });
  }

  calculateInstancePositions64xyLow(attribute, {startRow, endRow}) {
    const isFP64 = this.use64bitPositions();
    attribute.constant = !isFP64;

    if (!isFP64) {
      attribute.value = new Float32Array(2);
      return;
    }

    const {data, getPosition} = this.props;
    const {value, size} = attribute;
    let i = startRow * size;
    const {iterable, objectInfo} = createIterable(data, startRow, endRow);
    for (const point of iterable) {
      objectInfo.index++;
      const position = getPosition(point, objectInfo);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }

  updateState(params) {
    super.updateState(params);
    const {props, oldProps} = params;

    if (props.scenegraph !== oldProps.scenegraph) {
      const scenegraph = props.getScene(props.scenegraph);
      const animator = props.getAnimator(props.scenegraph);

      if (scenegraph instanceof ScenegraphNode) {
        this._deleteScenegraph();
        this._applyAllAttributes(scenegraph);
        this._applyAnimationsProp(scenegraph, animator, props._animations);
        this.setState({scenegraph, animator});
      } else if (scenegraph !== null) {
        log.warn('invalid scenegraph:', scenegraph)();
      }
    } else if (props._animations !== oldProps._animations) {
      this._applyAnimationsProp(this.state.scenegraph, this.state.animator, props._animations);
    }
  }

  finalizeState() {
    this._deleteScenegraph();
  }

  _applyAllAttributes(scenegraph) {
    if (this.state.attributesAvailable) {
      const allAttributes = this.getAttributeManager().getAttributes();
      scenegraph.traverse(model => {
        this._setModelAttributes(model.model, allAttributes);
      });
    }
  }

  _applyAnimationsProp(scenegraph, animator, animationsProp) {
    if (!scenegraph || !animator || !animationsProp) {
      return;
    }

    const animations = animator.getAnimations();

    Object.keys(animationsProp).forEach(key => {
      // Key can be:
      //  - number for index number
      //  - name for animation name
      //  - * to affect all animations
      const value = animationsProp[key];

      if (key === '*') {
        animations.forEach(animation => {
          Object.assign(animation, value);
        });
      } else if (Number.isFinite(Number(key))) {
        const number = Number(key);
        if (number >= 0 && number < animations.length) {
          Object.assign(animations[number], value);
        } else {
          log.warn(`animation ${key} not found`)();
        }
      } else {
        const findResult = animations.find(({name}) => name === key);
        if (findResult) {
          Object.assign(findResult, value);
        } else {
          log.warn(`animation ${key} not found`)();
        }
      }
    });
  }

  _deleteScenegraph() {
    const {scenegraph} = this.state;
    if (scenegraph instanceof ScenegraphNode) {
      scenegraph.delete();
    }
  }

  addVersionToShader(source) {
    if (isWebGL2(this.context.gl)) {
      return `#version 300 es\n${source}`;
    }

    return source;
  }

  getLoadOptions() {
    const modules = ['project32', 'picking'];
    const {_lighting, _imageBasedLightingEnvironment} = this.props;

    if (_lighting === 'pbr') {
      modules.push(pbr);
    }

    let env = null;
    if (_imageBasedLightingEnvironment) {
      if (typeof _imageBasedLightingEnvironment === 'function') {
        env = _imageBasedLightingEnvironment({gl: this.context.gl, layer: this});
      } else {
        env = _imageBasedLightingEnvironment;
      }
    }

    return {
      gl: this.context.gl,
      waitForFullLoad: true,
      imageBasedLightingEnvironment: env,
      modelOptions: {
        vs: this.addVersionToShader(vs),
        fs: this.addVersionToShader(fs),
        modules,
        isInstanced: true
      },
      // tangents are not supported
      useTangents: false
    };
  }

  updateAttributes(props) {
    super.updateAttributes(props);
    this.setState({attributesAvailable: true});
    if (!this.state.scenegraph) return;

    const attributeManager = this.getAttributeManager();
    const changedAttributes = attributeManager.getChangedAttributes({clearChangedFlags: true});
    this.state.scenegraph.traverse(model => {
      this._setModelAttributes(model.model, changedAttributes);
    });
  }

  draw({moduleParameters = null, parameters = {}, context}) {
    if (!this.state.scenegraph) return;

    if (this.props._animations && this.state.animator) {
      this.state.animator.animate(context.animationProps.time);
    }

    const {sizeScale} = this.props;
    const numInstances = this.getNumInstances();
    this.state.scenegraph.traverse((model, {worldMatrix}) => {
      model.model.setInstanceCount(numInstances);
      model.updateModuleSettings(moduleParameters);
      model.draw({
        parameters,
        uniforms: {
          sizeScale,
          sceneModelMatrix: worldMatrix,
          // Needed for PBR (TODO: find better way to get it)
          u_Camera: model.model.program.uniforms.project_uCameraPosition
        }
      });
    });
  }
}

ScenegraphLayer.layerName = 'ScenegraphLayer';
ScenegraphLayer.defaultProps = defaultProps;
