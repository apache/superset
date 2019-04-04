import {resolveModules, getShaderModule} from './shader-modules';
import {getPlatformShaderDefines, getVersionDefines} from './platform-defines';
import {MODULE_INJECTORS_VS, MODULE_INJECTORS_FS} from '../modules/module-injectors';
import assert from '../../utils/assert';
import {log} from '../../utils';

const VERTEX_SHADER = 'vs';
const FRAGMENT_SHADER = 'fs';

const SHADER_TYPE = {
  [VERTEX_SHADER]: 'vertex',
  [FRAGMENT_SHADER]: 'fragment'
};

const MODULE_INJECTORS = {
  [VERTEX_SHADER]: MODULE_INJECTORS_VS,
  [FRAGMENT_SHADER]: MODULE_INJECTORS_FS
};

// Precision prologue to inject before functions are injected in shader
// TODO - extract any existing prologue in the fragment source and move it up...
const FRAGMENT_SHADER_PROLOGUE = `\
#ifdef GL_ES
precision highp float;
#endif

`;

// Generate "glslify-compatible" SHADER_NAME defines
// These are understood by the GLSL error parsing function
// If id is provided and no SHADER_NAME constant is present in source, create one
function getShaderName({id, source, type}) {
  const injectShaderName = id && typeof id === 'string' && source.indexOf('SHADER_NAME') === -1;
  return injectShaderName ? `
#define SHADER_NAME ${id}_${SHADER_TYPE[type]}

` : '';
}

// Generates application defines from an object
function getApplicationDefines(defines = {}) {
  let count = 0;
  let sourceText = '';
  for (const define in defines) {
    if (count === 0) {
      sourceText += '\n// APPLICATION DEFINES\n';
    }
    count++;
    sourceText += `#define ${define.toUpperCase()} ${defines[define]}\n`;
  }
  if (count === 0) {
    sourceText += '\n';
  }
  return sourceText;
}

// Warn about deprecated uniforms or functions
function checkDeprecation(moduleName, shaderSource) {
  const shaderModule = getShaderModule(moduleName);

  shaderModule.deprecations.forEach(def => {
    if (def.regex.test(shaderSource)) {
      if (def.deprecated) {
        log.deprecated(def.old, def.new)();
      } else {
        log.removed(def.old, def.new)();
      }
    }
  });
}

// Extracts the source code chunk for the specified shader type from the named shader module
function getModuleSource(moduleName, type) {
  const shaderModule = getShaderModule(moduleName);
  let moduleSource;
  switch (type) {
  case VERTEX_SHADER:
    moduleSource = shaderModule.vs || shaderModule.vertexShader;
    break;
  case FRAGMENT_SHADER:
    moduleSource = shaderModule.fs || shaderModule.fragmentShader;
    break;
  default:
    assert(false);
  }

  if (typeof moduleSource !== 'string') {
    return '';
  }

  return `\
#define MODULE_${moduleName.toUpperCase()}
${moduleSource}\
// END MODULE_${moduleName}

`;
}

// Pulls together complete source code for either a vertex or a fragment shader
// adding prologues, requested module chunks, and any final injections.
function assembleShader(gl, {
  id,
  source,
  type,
  modules = [],
  defines = {}
}) {
  assert(typeof source === 'string', 'shader source must be a string');

  const sourceLines = source.split('\n');
  let versionLine = '';
  let coreSource = source;
  // Extract any version directive string from source.
  // TODO : keep all pre-processor statements at the begining of the shader.
  if (sourceLines[0].indexOf('#version ') === 0) {
    versionLine = sourceLines[0];
    coreSource = sourceLines.slice(1).join('\n');
  }

  // Add platform defines (use these to work around platform-specific bugs and limitations)
  // Add common defines (GLSL version compatibility, feature detection)
  // Add precision declaration for fragment shaders
  let assembledSource = `\
${getShaderName({id, source, type})}
${getPlatformShaderDefines(gl)}
${getVersionDefines(gl)}
${getApplicationDefines(defines)}
${type === FRAGMENT_SHADER ? FRAGMENT_SHADER_PROLOGUE : ''}
`;

  // Add source of dependent modules in resolved order
  let inject = false;
  for (const moduleName of modules) {
    switch (moduleName) {
    case 'inject':
      inject = true;
      break;
    default:
      checkDeprecation(moduleName, coreSource);
      // Add the module source, and a #define that declares it presence
      assembledSource += getModuleSource(moduleName, type);
    }
  }

  // Add the version directive and actual source of this shader
  assembledSource = versionLine + assembledSource + coreSource;

  // Finally, if requested, insert an automatic module injector chunk
  if (inject) {
    assembledSource.replace('}\s*$', MODULE_INJECTORS);
  }

  return assembledSource;
}

// Returns a combined `getUniforms` covering the options for all the modules,
// the created function will pass on options to the inidividual `getUniforms`
// function of each shader module and combine the results into one object that
// can be passed to setUniforms.
function assembleGetUniforms(modules) {

  return function getUniforms(opts) {
    const uniforms = {};
    for (const moduleName of modules) {
      const shaderModule = getShaderModule(moduleName);
      // `modules` is already sorted by dependency level. This guarantees that
      // modules have access to the uniforms that are generated by their dependencies.
      const moduleUniforms = shaderModule.getUniforms ?
        shaderModule.getUniforms(opts, uniforms) : {};
      Object.assign(uniforms, moduleUniforms);
    }
    return uniforms;
  };

}

// Returns a map with module names as keys, resolving to their module definitions
// The presence of a key indicates that the module is available in this program,
// whether directly included, or through a dependency of some other module
function assembleModuleMap(modules) {
  const result = {};
  for (const moduleName of modules) {
    const shaderModule = getShaderModule(moduleName);
    result[moduleName] = shaderModule;
  }
  return result;
}

/**
 * Apply set of modules
 */
export function assembleShaders(gl, opts = {}) {
  const {vs, fs} = opts;
  const modules = resolveModules(opts.modules || []);
  return {
    gl,
    vs: assembleShader(gl, Object.assign({}, opts, {source: vs, type: VERTEX_SHADER, modules})),
    fs: assembleShader(gl, Object.assign({}, opts, {source: fs, type: FRAGMENT_SHADER, modules})),
    getUniforms: assembleGetUniforms(modules),
    modules: assembleModuleMap(modules)
  };
}
