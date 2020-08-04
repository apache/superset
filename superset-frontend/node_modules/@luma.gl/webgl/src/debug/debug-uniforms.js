import {formatValue, assert} from '../utils';

// Prepares a table suitable for console.table
/* eslint-disable max-statements, complexity */
export function getDebugTableForUniforms({
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
    if (
      !uniformName.match(SHADER_MODULE_UNIFORM_REGEXP) &&
      !uniformName.match(PROJECT_MODULE_UNIFORM_REGEXP)
    ) {
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
