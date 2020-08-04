//
// A composite render pass.
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import Pass from './pass';

export default class CompositePass extends Pass {
  constructor(gl, props = {}) {
    props = Array.isArray(props) ? {passes: props} : props;
    super(gl, Object.assign({id: 'composite-pass'}, props));
  }

  // Override render() to just forward the call
  render(...args) {
    const {passes = []} = this.props;
    for (const pass of passes) {
      pass.render(...args);
    }
  }

  delete() {
    // Delete any resources crated
  }
}
