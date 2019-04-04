// Helper definitions for validation of webgl parameters
/* eslint-disable no-inline-comments, max-len */

// Errors - Constants returned from getError().
const GL_NO_ERROR = 0; // Returned from getError.
const GL_INVALID_ENUM = 0x0500; //  Returned from getError.
const GL_INVALID_VALUE = 0x0501; //  Returned from getError.
const GL_INVALID_OPERATION = 0x0502; //  Returned from getError.
const GL_OUT_OF_MEMORY = 0x0505; //  Returned from getError.
const GL_CONTEXT_LOST_WEBGL = 0x9242; //  Returned from getError.
const GL_INVALID_FRAMEBUFFER_OPERATION = 0x0506;

// GL errors

const GL_ERROR_MESSAGES = {
  //  If the WebGL context is lost, this error is returned on the
  // first call to getError. Afterwards and until the context has been
  // restored, it returns gl.NO_ERROR.
  [GL_CONTEXT_LOST_WEBGL]: 'WebGL context lost',
  // An unacceptable value has been specified for an enumerated argument.
  [GL_INVALID_ENUM]: 'WebGL invalid enumerated argument',
  // A numeric argument is out of range.
  [GL_INVALID_VALUE]: 'WebGL invalid value',
  // The specified command is not allowed for the current state.
  [GL_INVALID_OPERATION]: 'WebGL invalid operation',
  // The currently bound framebuffer is not framebuffer complete
  // when trying to render to or to read from it.
  [GL_INVALID_FRAMEBUFFER_OPERATION]: 'WebGL invalid framebuffer operation',
  // Not enough memory is left to execute the command.
  [GL_OUT_OF_MEMORY]: 'WebGL out of memory'
};

function glGetErrorMessage(gl, glError) {
  return GL_ERROR_MESSAGES[glError] || `WebGL unknown error ${glError}`;
}

// Returns an Error representing the Latest webGl error or null
export function glGetError(gl) {
  // Loop to ensure all errors are cleared
  const errorStack = [];
  let glError = gl.getError();
  while (glError !== GL_NO_ERROR) {
    errorStack.push(glGetErrorMessage(gl, glError));
    glError = gl.getError();
  }
  return errorStack.length ? new Error(errorStack.join('\n')) : null;
}

export function glCheckError(gl) {
  if (gl.debug) {
    const error = glGetError(gl);
    if (error) {
      throw error;
    }
  }
}
