//
// A pass that renders a given texture into screen space
//
// Attribution: This class and the multipass system were inspired by
// the THREE.js EffectComposer and *Pass classes

import {default as ClipSpace} from '../lib/clip-space';
import Pass from './pass';

const fs = `\
uniform sampler2D uDiffuseSampler;
uniform float uOpacity;
varying vec2 uv;

void main() {
  vec4 texel = texture2D(uDiffuseSampler, uv);
  gl_FragColor = uOpacity * texel;
}
`;

export default class TexturePass extends Pass {
  constructor(gl, options = {}) {
    super(gl, Object.assign({id: 'texture-pass'}, options));
    const {texture, opacity = 1.0} = options;
    this.clipspace = new ClipSpace(gl, {
      id: 'texture-pass',
      fs,
      uniforms: {
        uDiffuseSampler: texture,
        uOpacity: opacity
      }
    });
  }

  delete() {
    this.clipspace.delete();
    super.delete();
  }

  _renderPass() {
    this.clipspace.draw({
      parameters: {
        depthWrite: false,
        depthTest: false
      }
    });
  }
}
