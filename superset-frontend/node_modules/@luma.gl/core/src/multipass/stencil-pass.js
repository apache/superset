//
// A composite stencil pass.
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import {withParameters, setParameters} from '@luma.gl/webgl';
import Pass from './pass';

function getMask(indices = [], bits = 8) {
  let mask = 0;
  indices.forEach(index => {
    // assert(index >= 0 && index < bits);
    mask = mask & (1 >> index);
  });
  return mask;
}

export default class StencilPass extends Pass {
  constructor(gl, props = {}) {
    super(gl, Object.assign({id: 'simple-outline-pass', swap: false}, props));
    this.props = Object.assign({}, props);
    this.setProps(props);
  }

  _renderPass({inputBuffer, outputBuffer, animationPropst}) {
    const {gl} = this;
    const stencilReadMask = getMask(this.props.stencils);
    const stencilWriteMask = getMask(this.props.updateStencil);

    withParameters(
      gl,
      {
        stencilTest: stencilReadMask !== 0 && stencilWriteMask !== 0, // turn on stencil buffers
        stencilOp: [gl.KEEP, gl.KEEP, gl.REPLACE] // update stencil if both stencil+depth tests pass
      },
      () => {
        if (stencilReadMask) {
          setParameters(gl, {
            stencilFunc: [gl.EQUAL, 0, stencilReadMask]
          });
        }

        setParameters(gl, {
          stencilMask: stencilWriteMask
        });

        if (this.props.clearStencil) {
          gl.clear(gl.STENCIL_BUFFER_BIT);
        }

        // draw
        for (const model of this.props.models) {
          model.setUniforms(this.props.normalUniforms);
          model.draw(this.props.drawParams);
        }

        // Disable stencil writing, mask to stencil plane 0
        setParameters(gl, {
          stencilFunc: [gl.EQUAL, 0, stencilReadMask],
          stencilMask: 0x00 // disable writing to the stencil buffer
        });

        for (const model of this.props.models) {
          model.setUniforms(this.props.outlineUniforms);
          model.draw(this.props.drawParams);
          model.setUniforms(this.props.normalUniforms);
        }

        // All gl settings will reset here...
      }
    );
  }
}
