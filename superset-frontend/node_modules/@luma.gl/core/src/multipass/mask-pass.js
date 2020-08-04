//
// A mask pass.
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import Pass from './pass';

export default class MaskPass extends Pass {
  constructor(gl, props = {}) {
    super(gl, Object.assign({id: 'mask-pass'}, props));
    this.inverse = false;
    this.clearStencil = true;
  }

  _renderPass({gl}) {
    let writeValue = 1;
    let clearValue = 0;
    if (this.inverse) {
      writeValue = 0;
      clearValue = 1;
    }

    // don't update color or depth
    gl.colorMask(false, false, false, false);
    gl.depthMask(false);

    // set up stencil
    gl.enable(gl.STENCIL_TEST);
    gl.stencilOp(gl.REPLACE, gl.REPLACE, gl.REPLACE);
    gl.stencilFunc(gl.ALWAYS, writeValue, 0xffffffff);
    gl.clearStencil(clearValue);

    // TODO - draw into the stencil buffers of the two framebuffers
    // renderer.render(this.scene, this.camera, this.readBuffer, this.clear);
    // renderer.render(this.scene, this.camera, this.writeBuffer, this.clear);

    // re-enable update of color and depth
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);

    // only render where stencil is set to 1
    gl.stencilFunc(gl.EQUAL, 1, 0xffffffff); // draw if == 1
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }
}
