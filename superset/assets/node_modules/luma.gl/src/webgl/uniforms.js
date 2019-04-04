import Framebuffer from './framebuffer';
import Texture from './texture';
import Sampler from './sampler';
import {formatValue, log} from '../utils';
import assert from '../utils/assert';

// Local constants, will be "collapsed" during minification

// WebGL1

const GL_FLOAT = 0x1406;
const GL_FLOAT_VEC2 = 0x8B50;
const GL_FLOAT_VEC3 = 0x8B51;
const GL_FLOAT_VEC4 = 0x8B52;

const GL_INT = 0x1404;
const GL_INT_VEC2 = 0x8B53;
const GL_INT_VEC3 = 0x8B54;
const GL_INT_VEC4 = 0x8B55;

const GL_BOOL = 0x8B56;
const GL_BOOL_VEC2 = 0x8B57;
const GL_BOOL_VEC3 = 0x8B58;
const GL_BOOL_VEC4 = 0x8B59;

const GL_FLOAT_MAT2 = 0x8B5A;
const GL_FLOAT_MAT3 = 0x8B5B;
const GL_FLOAT_MAT4 = 0x8B5C;

const GL_SAMPLER_2D = 0x8B5E;
const GL_SAMPLER_CUBE = 0x8B60;

// WebGL2

const GL_UNSIGNED_INT = 0x1405;
const GL_UNSIGNED_INT_VEC2 = 0x8DC6;
const GL_UNSIGNED_INT_VEC3 = 0x8DC7;
const GL_UNSIGNED_INT_VEC4 = 0x8DC8;

/* eslint-disable camelcase */
const GL_FLOAT_MAT2x3 = 0x8B65;
const GL_FLOAT_MAT2x4 = 0x8B66;
const GL_FLOAT_MAT3x2 = 0x8B67;
const GL_FLOAT_MAT3x4 = 0x8B68;
const GL_FLOAT_MAT4x2 = 0x8B69;
const GL_FLOAT_MAT4x3 = 0x8B6A;

const GL_SAMPLER_3D = 0x8B5F;
const GL_SAMPLER_2D_SHADOW = 0x8B62;
const GL_SAMPLER_2D_ARRAY = 0x8DC1;
const GL_SAMPLER_2D_ARRAY_SHADOW = 0x8DC4;
const GL_SAMPLER_CUBE_SHADOW = 0x8DC5;
const GL_INT_SAMPLER_2D = 0x8DCA;
const GL_INT_SAMPLER_3D = 0x8DCB;
const GL_INT_SAMPLER_CUBE = 0x8DCC;
const GL_INT_SAMPLER_2D_ARRAY = 0x8DCF;
const GL_UNSIGNED_INT_SAMPLER_2D = 0x8DD2;
const GL_UNSIGNED_INT_SAMPLER_3D = 0x8DD3;
const GL_UNSIGNED_INT_SAMPLER_CUBE = 0x8DD4;
const GL_UNSIGNED_INT_SAMPLER_2D_ARRAY = 0x8DD7;

const UNIFORM_SETTERS = {

  // WEBGL1

  /* eslint-disable max-len */
  [GL_FLOAT]: (gl, location, value) => gl.uniform1f(location, value),
  [GL_FLOAT_VEC2]: (gl, location, value) => gl.uniform2fv(location, toFloatArray(value, 2)),
  [GL_FLOAT_VEC3]: (gl, location, value) => gl.uniform3fv(location, toFloatArray(value, 3)),
  [GL_FLOAT_VEC4]: (gl, location, value) => gl.uniform4fv(location, toFloatArray(value, 4)),

  [GL_INT]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_INT_VEC2]: (gl, location, value) => gl.uniform2iv(location, toIntArray(value, 2)),
  [GL_INT_VEC3]: (gl, location, value) => gl.uniform3iv(location, toIntArray(value, 3)),
  [GL_INT_VEC4]: (gl, location, value) => gl.uniform4iv(location, toIntArray(value, 4)),

  [GL_BOOL]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_BOOL_VEC2]: (gl, location, value) => gl.uniform2iv(location, toIntArray(value, 2)),
  [GL_BOOL_VEC3]: (gl, location, value) => gl.uniform3iv(location, toIntArray(value, 3)),
  [GL_BOOL_VEC4]: (gl, location, value) => gl.uniform4iv(location, toIntArray(value, 4)),

  // uniformMatrix(false): don't transpose the matrix
  [GL_FLOAT_MAT2]: (gl, location, value) => gl.uniformMatrix2fv(location, false, toFloatArray(value, 4)),
  [GL_FLOAT_MAT3]: (gl, location, value) => gl.uniformMatrix3fv(location, false, toFloatArray(value, 9)),
  [GL_FLOAT_MAT4]: (gl, location, value) => gl.uniformMatrix4fv(location, false, toFloatArray(value, 16)),

  [GL_SAMPLER_2D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_SAMPLER_CUBE]: (gl, location, value) => gl.uniform1i(location, value),

  // WEBGL2 - unsigned integers, irregular matrices, additional texture samplers

  [GL_UNSIGNED_INT]: (gl, location, value) => gl.uniform1ui(location, value),
  [GL_UNSIGNED_INT_VEC2]: (gl, location, value) => gl.uniform2uiv(location, toUIntArray(value, 2)),
  [GL_UNSIGNED_INT_VEC3]: (gl, location, value) => gl.uniform3uiv(location, toUIntArray(value, 3)),
  [GL_UNSIGNED_INT_VEC4]: (gl, location, value) => gl.uniform4uiv(location, toUIntArray(value, 4)),

  // uniformMatrix(false): don't transpose the matrix
  [GL_FLOAT_MAT2x3]: (gl, location, value) => gl.uniformMatrix2x3fv(location, false, toFloatArray(value, 6)),
  [GL_FLOAT_MAT2x4]: (gl, location, value) => gl.uniformMatrix2x4fv(location, false, toFloatArray(value, 8)),
  [GL_FLOAT_MAT3x2]: (gl, location, value) => gl.uniformMatrix3x2fv(location, false, toFloatArray(value, 6)),
  [GL_FLOAT_MAT3x4]: (gl, location, value) => gl.uniformMatrix3x4fv(location, false, toFloatArray(value, 12)),
  [GL_FLOAT_MAT4x2]: (gl, location, value) => gl.uniformMatrix4x2fv(location, false, toFloatArray(value, 8)),
  [GL_FLOAT_MAT4x3]: (gl, location, value) => gl.uniformMatrix4x3fv(location, false, toFloatArray(value, 12)),

  [GL_SAMPLER_3D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_SAMPLER_2D_SHADOW]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_SAMPLER_2D_ARRAY]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_SAMPLER_2D_ARRAY_SHADOW]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_SAMPLER_CUBE_SHADOW]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_INT_SAMPLER_2D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_INT_SAMPLER_3D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_INT_SAMPLER_CUBE]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_INT_SAMPLER_2D_ARRAY]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_UNSIGNED_INT_SAMPLER_2D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_UNSIGNED_INT_SAMPLER_3D]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_UNSIGNED_INT_SAMPLER_CUBE]: (gl, location, value) => gl.uniform1i(location, value),
  [GL_UNSIGNED_INT_SAMPLER_2D_ARRAY]: (gl, location, value) => gl.uniform1i(location, value)
  /* eslint-enable max-len */
};

// Pre-allocated typed arrays for temporary conversion
const FLOAT_ARRAY = {};
const INT_ARRAY = {};
const UINT_ARRAY = {};

/* Functions to ensure the type of uniform values */
function toTypedArray(value, uniformLength, Type, cache) {
  const length = value.length;
  if (length % uniformLength) {
    log.warn(`Uniform size should be multiples of ${uniformLength}`, value)();
  }

  if (value instanceof Type) {
    return value;
  }
  let result = cache[length];
  if (!result) {
    result = new Type(length);
    cache[length] = result;
  }
  for (let i = 0; i < length; i++) {
    result[i] = value[i];
  }
  return result;
}

function toFloatArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Float32Array, FLOAT_ARRAY);
}

function toIntArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Int32Array, INT_ARRAY);
}

function toUIntArray(value, uniformLength) {
  return toTypedArray(value, uniformLength, Uint32Array, UINT_ARRAY);
}

export function parseUniformName(name) {
  // name = name[name.length - 1] === ']' ?
  // name.substr(0, name.length - 3) : name;

  // if array name then clean the array brackets
  const UNIFORM_NAME_REGEXP = /([^\[]*)(\[[0-9]+\])?/;
  const matches = name.match(UNIFORM_NAME_REGEXP);
  if (!matches || matches.length < 2) {
    throw new Error(`Failed to parse GLSL uniform name ${name}`);
  }

  return {
    name: matches[1],
    length: matches[2] || 1,
    isArray: Boolean(matches[2])
  };
}

// Returns a Magic Uniform Setter
/* eslint-disable complexity */
export function getUniformSetter(gl, location, info) {
  const setter = UNIFORM_SETTERS[info.type];
  if (!setter) {
    throw new Error(`Unknown GLSL uniform type ${info.type}`);
  }
  return setter.bind(null, gl, location);
}

// Basic checks of uniform values without knowledge of program
// To facilitate early detection of e.g. undefined values in JavaScript
export function checkUniformValues(uniforms, source) {
  for (const uniformName in uniforms) {
    const value = uniforms[uniformName];
    if (!checkUniformValue(value)) {
      // Add space to source
      source = source ? `${source} ` : '';
      // Value could be unprintable so write the object on console
      console.error(`${source} Bad uniform ${uniformName}`, value); // eslint-disable-line
      /* eslint-enable no-console */
      throw new Error(`${source} Bad uniform ${uniformName}`);
    }
  }
  return true;
}

// TODO use type information during validation
function checkUniformValue(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    return checkUniformArray(value);
  }

  // Check if single value is a number
  if (isFinite(value)) {
    return true;
  } else if (value === true || value === false) {
    return true;
  } else if (value instanceof Texture || value instanceof Sampler) {
    return true;
  } else if (value instanceof Framebuffer) {
    return Boolean(value.texture);
  }
  return false;
}

function checkUniformArray(value) {
  // Check that every element in array is a number, and at least 1 element
  if (value.length === 0) {
    return false;
  }

  const checkLength = Math.min(value.length, 16);

  for (let i = 0; i < checkLength; ++i) {
    if (!Number.isFinite(value[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Given two values of a uniform, returns `true` if they are equal
 */
export function areUniformsEqual(uniform1, uniform2) {
  if (Array.isArray(uniform1) || ArrayBuffer.isView(uniform1)) {
    if (!uniform2) {
      return false;
    }
    const len = uniform1.length;
    if (uniform2.length !== len) {
      return false;
    }
    for (let i = 0; i < len; i++) {
      if (uniform1[i] !== uniform2[i]) {
        return false;
      }
    }
    return true;
  }
  return uniform1 === uniform2;
}

// Prepares a table suitable for console.table
/* eslint-disable max-statements */
export function getUniformsTable({
  header = 'Uniforms',
  program,
  uniforms,
  undefinedOnly = false
} = {}) {
  assert(program);

  const SHADER_MODULE_UNIFORM_REGEXP = '.*_.*';
  const PROJECT_MODULE_UNIFORM_REGEXP = '.*Matrix'; // TODO - Use explicit list

  const uniformLocations = program._uniformSetters;
  const table = {}; // {[header]: {}};

  // Add program's provided uniforms (in alphabetical order)
  const uniformNames = Object.keys(uniformLocations).sort();

  let count = 0;

  // First add non-underscored uniforms (assumed not coming from shader modules)
  for (const uniformName of uniformNames) {
    if (!uniformName.match(SHADER_MODULE_UNIFORM_REGEXP) &&
      !uniformName.match(PROJECT_MODULE_UNIFORM_REGEXP)) {
      if (addUniformToTable({table, header, uniforms, uniformName, undefinedOnly})) {
        count++;
      }
    }
  }

  // add underscored uniforms (assumed from shader modules)
  for (const uniformName of uniformNames) {
    if (uniformName.match(PROJECT_MODULE_UNIFORM_REGEXP)) {
      if (addUniformToTable({table, header, uniforms, uniformName, undefinedOnly})) {
        count++;
      }
    }
  }

  for (const uniformName of uniformNames) {
    if (!table[uniformName]) {
      if (addUniformToTable({table, header, uniforms, uniformName, undefinedOnly})) {
        count++;
      }
    }
  }

  // Create a table of unused uniforms
  let unusedCount = 0;
  const unusedTable = {};
  if (!undefinedOnly) {
    for (const uniformName in uniforms) {
      const uniform = uniforms[uniformName];
      if (!table[uniformName]) {
        unusedCount++;
        unusedTable[uniformName] = {
          Type: `NOT USED: ${uniform}`,
          [header]: formatValue(uniform)
        };
      }
    }
  }

  return {table, count, unusedTable, unusedCount};
}

// Helper
function addUniformToTable({table, header, uniforms, uniformName, undefinedOnly}) {
  const value = uniforms[uniformName];
  const isDefined = isUniformDefined(value);
  if (!undefinedOnly || !isDefined) {
    table[uniformName] = {
      // Add program's unprovided uniforms
      [header]: isDefined ? formatValue(value) : 'N/A',
      'Uniform Type': isDefined ? value : 'NOT PROVIDED'
    };
    return true;
  }
  return false;
}

function isUniformDefined(value) {
  return value !== undefined && value !== null;
}
