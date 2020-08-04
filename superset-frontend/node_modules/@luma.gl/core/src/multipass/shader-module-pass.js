//
// A pass that renders a given texture into screen space
//

import Pass from './pass';
import CompositePass from './composite-pass';
import ClipSpace from '../lib/clip-space';

import {normalizeShaderModule} from '@luma.gl/shadertools';

class ShaderModuleSinglePass extends Pass {
  constructor(gl, props = {}) {
    super(gl, Object.assign({swap: true}, props));
  }

  _renderPass({inputBuffer, swapBuffers}) {
    this.props.model.setUniforms(this.props);

    // swapBuffers();
    this.props.model.draw({
      uniforms: {
        texture: inputBuffer,
        texSize: [inputBuffer.width, inputBuffer.height]
      },
      parameters: {
        depthWrite: false,
        depthTest: false
      }
    });
  }
}

export default class ShaderModulePass extends CompositePass {
  constructor(gl, module, props = {}) {
    const id = `${module.name}-pass`;
    normalizeShaderModule(module);
    const passes = normalizePasses(gl, module, id, props);
    super(gl, Object.assign({id, passes}, props));
    this.module = module;
  }

  _renderPass({inputBuffer, swapBuffers}) {
    let first = true;
    for (const pass of this.props.passes) {
      if (!first) {
        swapBuffers();
      }
      first = false;
      const {uniforms, model} = pass.props;
      if (uniforms) {
        model.setUniforms(uniforms);
      }
      // swapBuffers();
      model.draw({
        uniforms: {
          texture: inputBuffer,
          texSize: [inputBuffer.width, inputBuffer.height]
        },
        parameters: {
          depthWrite: false,
          depthTest: false
        }
      });
    }
  }
}

function normalizePasses(gl, module, id, props) {
  if (module.filter || module.sampler) {
    const fs = getFragmentShaderForRenderPass(module);
    const pass = new ShaderModuleSinglePass(gl, {
      id,
      model: getModel(gl, module, fs, id, props),
      uniforms: null
    });
    return [pass];
  }

  const passes = module.passes || [];
  return passes.map(pass => {
    const fs = getFragmentShaderForRenderPass(module, pass);
    const idn = `${id}-${passes.length + 1}`;

    return new ShaderModuleSinglePass(
      gl,
      Object.assign(
        {
          id: idn,
          model: getModel(gl, module, fs, idn, props),
          uniforms: pass.uniforms
        },
        props
      )
    );
  });
}

function getModel(gl, module, fs, id, props) {
  const model = new ClipSpace(gl, {id, fs, modules: [module]});

  const uniforms = Object.assign(module.getUniforms(), module.getUniforms(props));

  model.setUniforms(uniforms);
  return model;
}

const FILTER_FS_TEMPLATE = func => `\
uniform sampler2D texture;
uniform vec2 texSize;

varying vec2 position;
varying vec2 coordinate;
varying vec2 uv;

void main() {
  vec2 texCoord = coordinate;

  gl_FragColor = texture2D(texture, texCoord);
  gl_FragColor = ${func}(gl_FragColor, texSize, texCoord);
}
`;

const SAMPLER_FS_TEMPLATE = func => `\
uniform sampler2D texture;
uniform vec2 texSize;

varying vec2 position;
varying vec2 coordinate;
varying vec2 uv;

void main() {
  vec2 texCoord = coordinate;

  gl_FragColor = ${func}(texture, texSize, texCoord);
}
`;

function getFragmentShaderForRenderPass(module, pass = module) {
  if (pass.filter) {
    const func = typeof pass.filter === 'string' ? pass.filter : `${module.name}_filterColor`;
    return FILTER_FS_TEMPLATE(func);
  }

  if (pass.sampler) {
    const func = typeof pass.sampler === 'string' ? pass.sampler : `${module.name}_sampleColor`;
    return SAMPLER_FS_TEMPLATE(func);
  }

  // console.error(`${module.name} no fragment shader generated`);
  return null;
}
