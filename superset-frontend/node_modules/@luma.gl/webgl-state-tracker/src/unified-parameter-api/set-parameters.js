import {setParameters as glSetParameters} from './unified-parameter-api';
import FUNCTION_STYLE_PARAMETER_SETTERS from './webgl-setter-function-table';

// Adds support for using gl function names (in addition to parameter constants)
// as keys in setParameters
//
// Note: Value may be "normalized" (in case a short form is supported).
// In that case the normalized value is returned.

export function setParameters(gl, parameters) {
  // Handles any GL parameter keys
  glSetParameters(gl, parameters);
  // Check for function style keys
  for (const key in parameters) {
    const setter = FUNCTION_STYLE_PARAMETER_SETTERS[key];
    if (setter) {
      setter(gl, parameters[key], key);
    }
  }
}
