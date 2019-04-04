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

/* global window */
import {GL, Framebuffer, Model, Geometry} from 'luma.gl';
import Effect from '../lib/effect';
import WebMercatorViewport from '../../viewports/web-mercator-viewport';

import reflectionVertex from './reflection-effect-vertex.glsl';
import reflectionFragment from './reflection-effect-fragment.glsl';

export default class ReflectionEffect extends Effect {
  /**
   * @classdesc
   * ReflectionEffect
   *
   * @class
   * @param reflectivity How visible reflections should be over the map, between 0 and 1
   * @param blur how blurry the reflection should be, between 0 and 1
   */

  constructor(reflectivity = 0.5, blur = 0.5) {
    super();
    this.reflectivity = reflectivity;
    this.blur = blur;
    this.framebuffer = null;
    this.setNeedsRedraw();
  }

  getShaders() {
    return {
      vs: reflectionVertex,
      fs: reflectionFragment,
      modules: [],
      shaderCache: this.context.shaderCache
    };
  }

  initialize({gl, layerManager}) {
    this.unitQuad = new Model(
      gl,
      Object.assign({}, this.getShaders(), {
        id: 'reflection-effect',
        geometry: new Geometry({
          drawMode: GL.TRIANGLE_FAN,
          vertices: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0])
        })
      })
    );
    this.framebuffer = new Framebuffer(gl, {depth: true});
  }

  preDraw({gl, layerManager}) {
    const {viewport} = layerManager.context;
    /*
     * the renderer already has a reference to this, but we don't have a reference to the renderer.
     * when we refactor the camera code, we should make sure we get a reference to the renderer so
     * that we can keep this in one place.
     */
    const dpi = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    this.framebuffer.resize({width: dpi * viewport.width, height: dpi * viewport.height});
    const pitch = viewport.pitch;
    this.framebuffer.bind();
    /* this is a huge hack around the existing viewport class.
     * TODO in the future, once we implement bona-fide cameras, we really need to fix this.
     */
    layerManager.setViewport(
      new WebMercatorViewport(Object.assign({}, viewport, {pitch: -180 - pitch}))
    );
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    layerManager.drawLayers({pass: 'reflection'});
    layerManager.setViewport(viewport);
    this.framebuffer.unbind();
  }

  draw({gl, layerManager}) {
    /*
     * Render our unit quad.
     * This will cover the entire screen, but will lie behind all other geometry.
     * This quad will sample the previously generated reflection texture
     * in order to create the reflection effect
     */
    this.unitQuad.render({
      reflectionTexture: this.framebuffer.texture,
      reflectionTextureWidth: this.framebuffer.width,
      reflectionTextureHeight: this.framebuffer.height,
      reflectivity: this.reflectivity,
      blur: this.blur
    });
  }

  finalize({gl, layerManager}) {
    /* TODO: Free resources? */
  }
}
