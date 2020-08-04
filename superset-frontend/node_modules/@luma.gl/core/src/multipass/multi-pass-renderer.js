//
// A top-level composite render pass, that manages render state
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import CompositePass from './composite-pass';
import RenderState from './render-state';

export default class MultiPassRenderer extends CompositePass {
  constructor(gl, props = {}) {
    props = Array.isArray(props) ? {passes: props} : props;
    super(gl, Object.assign({id: 'multi-pass'}, props));
    this.renderState = new RenderState(gl, props);
  }

  // Override render() to just forward the call
  render(animationProps) {
    this.renderState.reset();
    const {passes = []} = this.props;
    for (const pass of passes) {
      pass.render(this.renderState, animationProps);
    }
    return this;
  }

  delete() {
    this.renderState.delete();
    super.delete();
  }
}
