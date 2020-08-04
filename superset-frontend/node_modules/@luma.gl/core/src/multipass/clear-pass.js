//
// A pass that clears the input buffer or the screen.
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import Pass from './pass';

export default class ClearPass extends Pass {
  constructor(gl, props = {}) {
    super(gl, Object.assign({id: 'clear-pass'}, props));
  }

  // TODO - add support for colors, align with model.clear and framebuffer.clear
  // TODO - integrate with luma.gl clear, make sure right buffer is cleared
  _renderPass() {
    const {gl} = this;
    const {clearBits = gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT} = this.props;
    gl.clear(clearBits);
  }
}
