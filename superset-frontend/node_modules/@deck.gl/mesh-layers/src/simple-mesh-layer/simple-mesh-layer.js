// Note: This file will either be moved back to deck.gl or reformatted to web-monorepo standards
// Disabling lint temporarily to facilitate copying code in and out of this repo
/* eslint-disable */

// Copyright (c) 2015 Uber Technologies, Inc.
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

import {Layer, createIterable} from '@deck.gl/core';
import GL from '@luma.gl/constants';
import {Model, Geometry, Texture2D, fp64, PhongMaterial, isWebGL2} from '@luma.gl/core';
import {load} from '@loaders.gl/core';
import {loadImage} from '@loaders.gl/images';
const {fp64LowPart} = fp64;

import {MATRIX_ATTRIBUTES} from '../utils/matrix';

// NOTE(Tarek): Should eventually phase out the glsl1 versions.
import vs1 from './simple-mesh-layer-vertex.glsl1';
import fs1 from './simple-mesh-layer-fragment.glsl1';
import vs3 from './simple-mesh-layer-vertex.glsl';
import fs3 from './simple-mesh-layer-fragment.glsl';

// Replacement for the external assert method to reduce bundle size
function assert(condition, message) {
  if (!condition) {
    throw new Error(`deck.gl: ${message}`);
  }
}

/*
 * Load image data into luma.gl Texture2D objects
 * @param {WebGLContext} gl
 * @param {String|Texture2D|HTMLImageElement|Uint8ClampedArray} src - source of image data
 *   can be url string, Texture2D object, HTMLImageElement or pixel array
 * @returns {Promise} resolves to an object with name -> texture mapping
 */
function getTexture(gl, src, opts) {
  if (typeof src === 'string') {
    // Url, load the image
    return loadImage(src)
      .then(data => getTextureFromData(gl, data, opts))
      .catch(error => {
        throw new Error(`Could not load texture from ${src}: ${error}`);
      });
  }
  return new Promise(resolve => resolve(getTextureFromData(gl, src, opts)));
}

/*
 * Convert image data into texture
 * @returns {Texture2D} texture
 */
function getTextureFromData(gl, data, opts) {
  if (data instanceof Texture2D) {
    return data;
  }
  return new Texture2D(gl, Object.assign({data}, opts));
}

function validateGeometryAttributes(attributes) {
  assert(
    attributes.positions || attributes.POSITION,
    'SimpleMeshLayer requires "postions" or "POSITION" attribute in mesh property.'
  );
}

/*
 * Convert mesh data into geometry
 * @returns {Geometry} geometry
 */
function getGeometry(data) {
  if (data.attributes) {
    validateGeometryAttributes(data.attributes);
    if (data instanceof Geometry) {
      return data;
    } else {
      return new Geometry(data);
    }
  } else if (data.positions || data.POSITION) {
    validateGeometryAttributes(data);
    return new Geometry({
      attributes: data
    });
  }
  throw Error('Invalid mesh');
}

const DEFAULT_COLOR = [0, 0, 0, 255];
const defaultMaterial = new PhongMaterial();

const defaultProps = {
  fetch: (url, {propName}) => {
    if (propName === 'mesh') {
      return load(url);
    }

    return fetch(url).then(response => response.json());
  },
  mesh: {value: null, type: 'object', async: true},
  texture: null,
  sizeScale: {type: 'number', value: 1, min: 0},
  // TODO - parameters should be merged, not completely overridden
  parameters: {
    depthTest: true,
    depthFunc: GL.LEQUAL
  },
  fp64: false,
  // NOTE(Tarek): Quick and dirty wireframe. Just draws
  // the same mesh with LINE_STRIPS. Won't follow edges
  // of the original mesh.
  wireframe: false,
  // Optional material for 'lighting' shader module
  material: defaultMaterial,
  getPosition: {type: 'accessor', value: x => x.position},
  getColor: {type: 'accessor', value: DEFAULT_COLOR},

  // yaw, pitch and roll are in degrees
  // https://en.wikipedia.org/wiki/Euler_angles
  // [pitch, yaw, roll]
  getOrientation: {type: 'accessor', value: [0, 0, 0]},
  getScale: {type: 'accessor', value: [1, 1, 1]},
  getTranslation: {type: 'accessor', value: [0, 0, 0]},
  // 4x4 matrix
  getTransformMatrix: {type: 'accessor', value: []}
};

export default class SimpleMeshLayer extends Layer {
  getShaders() {
    const projectModule = this.use64bitProjection() ? 'project64' : 'project32';
    const gl2 = isWebGL2(this.context.gl);
    const vs = gl2 ? vs3 : vs1;
    const fs = gl2 ? fs3 : fs1;

    return {vs, fs, modules: [projectModule, 'phong-lighting', 'picking']};
  }

  initializeState() {
    const attributeManager = this.getAttributeManager();

    attributeManager.addInstanced({
      instancePositions: {
        transition: true,
        size: 3,
        accessor: 'getPosition'
      },
      instancePositions64xy: {
        size: 2,
        accessor: 'getPosition',
        update: this.calculateInstancePositions64xyLow
      },
      instanceColors: {
        transition: true,
        size: 4,
        accessor: 'getColor',
        defaultValue: [0, 0, 0, 255]
      },
      instanceModelMatrix: MATRIX_ATTRIBUTES
    });

    this.setState({
      // Avoid luma.gl's missing uniform warning
      // TODO - add feature to luma.gl to specify ignored uniforms?
      emptyTexture: new Texture2D(this.context.gl, {
        data: new Uint8Array(4),
        width: 1,
        height: 1
      })
    });
  }

  updateState({props, oldProps, changeFlags}) {
    super.updateState({props, oldProps, changeFlags});

    if (props.mesh !== oldProps.mesh || props.fp64 !== oldProps.fp64) {
      if (this.state.model) {
        this.state.model.delete();
      }
      if (props.mesh) {
        this.setState({model: this.getModel(props.mesh)});

        const attributes = props.mesh.attributes || props.mesh;
        this.setState({
          hasNormals: Boolean(attributes.NORMAL || attributes.normals)
        });
      }
      this.getAttributeManager().invalidateAll();
    }

    if (props.texture !== oldProps.texture) {
      this.setTexture(props.texture);
    }

    if (this.state.model) {
      this.state.model.setDrawMode(this.props.wireframe ? GL.LINE_STRIP : GL.TRIANGLES);
    }
  }

  finalizeState() {
    super.finalizeState();

    this.state.emptyTexture.delete();
    if (this.state.texture) {
      this.state.texture.delete();
    }
  }

  draw({uniforms}) {
    if (!this.state.model) {
      return;
    }

    const {sizeScale} = this.props;

    this.state.model.draw({
      uniforms: Object.assign({}, uniforms, {
        sizeScale,
        flatShade: !this.state.hasNormals
      })
    });
  }

  getModel(mesh) {
    const model = new Model(
      this.context.gl,
      Object.assign({}, this.getShaders(), {
        id: this.props.id,
        geometry: getGeometry(mesh),
        isInstanced: true,
        shaderCache: this.context.shaderCache
      })
    );

    if (this.state.texture) {
      model.setUniforms({sampler: this.state.texture, hasTexture: 1});
    } else {
      model.setUniforms({sampler: this.state.emptyTexture, hasTexture: 0});
    }

    return model;
  }

  setTexture(src) {
    const {gl} = this.context;
    const {emptyTexture} = this.state;

    if (this.state.texture) {
      this.state.texture.delete();
    }

    if (src) {
      getTexture(gl, src).then(texture => {
        this.setState({texture});
        if (this.state.model) {
          this.state.model.setUniforms({sampler: this.state.texture, hasTexture: 1});
        }
      });
    } else {
      // reset
      this.setState({texture: null});
      if (this.state.model) {
        this.state.model.setUniforms({sampler: emptyTexture, hasTexture: 0});
      }
    }
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
    for (const object of iterable) {
      objectInfo.index++;
      const position = getPosition(object, objectInfo);
      value[i++] = fp64LowPart(position[0]);
      value[i++] = fp64LowPart(position[1]);
    }
  }
}

SimpleMeshLayer.layerName = 'SimpleMeshLayer';
SimpleMeshLayer.defaultProps = defaultProps;
