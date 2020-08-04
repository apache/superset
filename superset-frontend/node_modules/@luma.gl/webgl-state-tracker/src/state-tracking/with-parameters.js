import {pushContextState, popContextState} from './track-context-state';
import {setParameters} from '../unified-parameter-api/set-parameters';
import {assert, isObjectEmpty} from '../utils';

// Stores current "global" WebGL context settings, changes selected parameters,
// executes function, restores parameters
export function withParameters(gl, parameters, func) {
  // assertWebGLContext(gl);

  if (isObjectEmpty(parameters)) {
    // Avoid setting state if no parameters provided. Just call and return
    return func(gl);
  }

  const {nocatch = true} = parameters;

  // frameBuffer not supported: use framebuffer API
  // TODO - is this still true?
  assert(!parameters.frameBuffer);

  pushContextState(gl);
  setParameters(gl, parameters);

  // Setup is done, call the function
  let value;

  if (nocatch) {
    // Avoid try catch to minimize stack size impact for safe execution paths
    value = func(gl);
    popContextState(gl);
  } else {
    // Wrap in a try-catch to ensure that parameters are restored on exceptions
    try {
      value = func(gl);
    } finally {
      popContextState(gl);
    }
  }

  return value;
}
