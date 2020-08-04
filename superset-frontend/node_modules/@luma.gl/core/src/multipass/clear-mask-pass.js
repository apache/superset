//
// A pass that disables stencil test.
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import Pass from './pass.js';

export default class ClearMaskPass extends Pass {
  constructor(gl, props) {
    super(gl, Object.assign({id: 'clear-mask-pass'}, props));
  }

  render(gl) {
    gl.disable(gl.STENCIL_TEST);
  }
}
