//
// Render state helper class for the multi pass system
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import {Framebuffer} from '@luma.gl/webgl';

export default class RenderState {
  constructor(gl, props = {}) {
    this.gl = gl;

    this.framebuffer1 = new Framebuffer(gl, {id: 'multi-pass-1', stencil: true});
    this.framebuffer2 = new Framebuffer(gl, {id: 'multi-pass-2', stencil: true});

    this.reset();
  }

  reset() {
    this.framebuffer1.resize();
    this.framebuffer2.resize();

    this.writeBuffer = this.framebuffer1;
    this.readBuffer = this.framebuffer2;

    this.maskActive = false;
  }

  delete() {
    this.framebuffer1.delete();
    this.framebuffer2.delete();
  }

  _swapFramebuffers() {
    const tmp = this.readBuffer;
    this.readBuffer = this.writeBuffer;
    this.writeBuffer = tmp;
  }
}
