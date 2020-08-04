import {VERTEX_SHADER, FRAGMENT_SHADER} from './constants';
import {resolveModules, getShaderModule} from './resolve-modules';
import {getPlatformShaderDefines, getVersionDefines} from './platform-defines';
import injectShader, {DECLARATION_INJECT_MARKER} from './inject-shader';
import {assert} from '../utils';
/* eslint-disable max-depth, complexity */

const INJECT_SHADER_DECLARATIONS = `\n\n${DECLARATION_INJECT_MARKER}\n\n`;

const SHADER_TYPE = {
  [VERTEX_SHADER]: 'vertex',
  [FRAGMENT_SHADER]: 'fragment'
};

const HOOK_FUNCTIONS = {
  [VERTEX_SHADER]: {},
  [FRAGMENT_SHADER]: {}
};

const MODULE_INJECTIONS = {
  [VERTEX_SHADER]: {},
  [FRAGMENT_SHADER]: {}
};

// Precision prologue to inject before functions are injected in shader
// TODO - extract any existing prologue in the fragment source and move it up...
const FRAGMENT_SHADER_PROLOGUE = `\
precision highp float;

`;

export function createShaderHook(hook, opts = {}) {
  hook = hook.trim();
  const [stage, signature] = hook.split(':');
  const name = hook.replace(/\(.+/, '');
  HOOK_FUNCTIONS[stage][name] = Object.assign(opts, {signature});
}

export function createModuleInjection(moduleName, opts) {
  const {hook, injection, order = 0} = opts;
  const shaderStage = hook.slice(0, 2);

  const moduleInjections = MODULE_INJECTIONS[shaderStage];
  moduleInjections[moduleName] = moduleInjections[moduleName] || {};

  assert(!moduleInjections[moduleName][hook], 'Module injection already created');

  moduleInjections[moduleName][hook] = {
    injection,
    order
  };
}

// Helpful for tests
export function resetGlobalShaderHooks() {
  HOOK_FUNCTIONS[VERTEX_SHADER] = {};
  HOOK_FUNCTIONS[FRAGMENT_SHADER] = {};

  MODULE_INJECTIONS[VERTEX_SHADER] = {};
  MODULE_INJECTIONS[FRAGMENT_SHADER] = {};
}

// Inject a list of modules
export function assembleShaders(gl, opts) {
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

// Pulls together complete source code for either a vertex or a fragment shader
// adding prologues, requested module chunks, and any final injections.
function assembleShader(
  gl,
  {
    id,
    source,
    type,
    modules,
    defines = {},
    hookFunctions = HOOK_FUNCTIONS,
    moduleInjections = MODULE_INJECTIONS,
    inject = {},
    prologue = true,
    log
  }
) {
  assert(typeof source === 'string', 'shader source must be a string');

  // TODO(Tarek): Supporting global hooks, remove when they're removed.
  if (hookFunctions !== HOOK_FUNCTIONS) {
    hookFunctions = {
      [VERTEX_SHADER]: Object.assign(
        {},
        HOOK_FUNCTIONS[VERTEX_SHADER],
        hookFunctions[VERTEX_SHADER]
      ),
      [FRAGMENT_SHADER]: Object.assign(
        {},
        HOOK_FUNCTIONS[FRAGMENT_SHADER],
        hookFunctions[FRAGMENT_SHADER]
      )
    };
  }

  if (moduleInjections !== MODULE_INJECTIONS) {
    moduleInjections = {
      [VERTEX_SHADER]: Object.assign(
        {},
        MODULE_INJECTIONS[VERTEX_SHADER],
        moduleInjections[VERTEX_SHADER]
      ),
      [FRAGMENT_SHADER]: Object.assign(
        {},
        MODULE_INJECTIONS[FRAGMENT_SHADER],
        moduleInjections[FRAGMENT_SHADER]
      )
    };
  }

  const isVertex = type === VERTEX_SHADER;

  const sourceLines = source.split('\n');
  let glslVersion = 100;
  let versionLine = '';
  let coreSource = source;
  // Extract any version directive string from source.
  // TODO : keep all pre-processor statements at the begining of the shader.
  if (sourceLines[0].indexOf('#version ') === 0) {
    glslVersion = 300; // TODO - regexp that matches atual version number
    versionLine = sourceLines[0];
    coreSource = sourceLines.slice(1).join('\n');
  } else {
    versionLine = `#version ${glslVersion}`;
  }

  // Combine Module and Application Defines
  const allDefines = {};
  modules.forEach(module => {
    Object.assign(allDefines, module.getDefines());
  });
  Object.assign(allDefines, defines);

  // Add platform defines (use these to work around platform-specific bugs and limitations)
  // Add common defines (GLSL version compatibility, feature detection)
  // Add precision declaration for fragment shaders
  let assembledSource = prologue
    ? `\
${versionLine}
${getShaderName({id, source, type})}
${getShaderType({type})}
${getPlatformShaderDefines(gl)}
${getVersionDefines(gl, glslVersion, !isVertex)}
${getApplicationDefines(allDefines)}
${isVertex ? '' : FRAGMENT_SHADER_PROLOGUE}
`
    : `${versionLine}
`;

  // Add source of dependent modules in resolved order
  let injectStandardStubs = false;
  const hookInjections = {};
  const mainInjections = {};

  for (const key in inject) {
    const injection =
      typeof inject[key] === 'string' ? {injection: inject[key], order: 0} : inject[key];
    if (key.match(/^(v|f)s:/)) {
      if (key[3] === '#') {
        mainInjections[key] = [injection];
      } else {
        hookInjections[key] = [injection];
      }
    } else {
      // Regex injection
      mainInjections[key] = [injection];
    }
  }

  for (const module of modules) {
    switch (module.name) {
      case 'inject':
        injectStandardStubs = true;
        break;

      default:
        if (log) {
          module.checkDeprecations(coreSource, log);
        }
        const moduleSource = module.getModuleSource(type, glslVersion);
        // Add the module source, and a #define that declares it presence
        assembledSource += moduleSource;

        if (moduleInjections[type][module.name]) {
          const injections = moduleInjections[type][module.name];
          for (const key in injections) {
            if (key.match(/^(v|f)s:#/)) {
              mainInjections[key] = mainInjections[key] || [];
              mainInjections[key].push(injections[key]);
            } else {
              hookInjections[key] = hookInjections[key] || [];
              hookInjections[key].push(injections[key]);
            }
          }
        }
    }
  }

  // For injectShader
  assembledSource += INJECT_SHADER_DECLARATIONS;

  assembledSource += getHookFunctions(hookFunctions[type], hookInjections);

  // Add the version directive and actual source of this shader
  assembledSource += coreSource;

  // Apply any requested shader injections
  assembledSource = injectShader(assembledSource, type, mainInjections, injectStandardStubs);

  return assembledSource;
}

// Returns a combined `getUniforms` covering the options for all the modules,
// the created function will pass on options to the inidividual `getUniforms`
// function of each shader module and combine the results into one object that
// can be passed to setUniforms.
function assembleGetUniforms(modules) {
  return function getUniforms(opts) {
    const uniforms = {};
    for (const module of modules) {
      // `modules` is already sorted by dependency level. This guarantees that
      // modules have access to the uniforms that are generated by their dependencies.
      const moduleUniforms = module.getUniforms(opts, uniforms);
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

function getShaderType({type}) {
  return `
#define SHADER_TYPE_${SHADER_TYPE[type].toUpperCase()}
`;
}

// Generate "glslify-compatible" SHADER_NAME defines
// These are understood by the GLSL error parsing function
// If id is provided and no SHADER_NAME constant is present in source, create one
function getShaderName({id, source, type}) {
  const injectShaderName = id && typeof id === 'string' && source.indexOf('SHADER_NAME') === -1;
  return injectShaderName
    ? `
#define SHADER_NAME ${id}_${SHADER_TYPE[type]}

`
    : '';
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

    const value = defines[define];
    if (value || Number.isFinite(value)) {
      sourceText += `#define ${define.toUpperCase()} ${defines[define]}\n`;
    }
  }
  if (count === 0) {
    sourceText += '\n';
  }
  return sourceText;
}

function getHookFunctions(hookFunctions, hookInjections) {
  let result = '';
  for (const hookName in hookFunctions) {
    const hookFunction = hookFunctions[hookName];
    result += `void ${hookFunction.signature} {\n`;
    if (hookFunction.header) {
      result += `  ${hookFunction.header}`;
    }
    if (hookInjections[hookName]) {
      const injections = hookInjections[hookName];
      injections.sort((a, b) => a.order - b.order);
      for (const injection of injections) {
        result += `  ${injection.injection}\n`;
      }
    }
    if (hookFunction.footer) {
      result += `  ${hookFunction.footer}`;
    }
    result += '}\n';
  }

  return result;
}
