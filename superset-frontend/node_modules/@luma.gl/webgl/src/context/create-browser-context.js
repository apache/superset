/**
 * Create a WebGL context for a canvas
 * Note calling this multiple time on the same canvas does return the same context
 */
export function createBrowserContext(canvas, options) {
  const {onError = message => null} = options;

  // Try to extract any extra information about why context creation failed
  const onCreateError = error => onError(`WebGL context: ${error.statusMessage || 'error'}`);
  canvas.addEventListener('webglcontextcreationerror', onCreateError, false);

  const {webgl1 = true, webgl2 = true} = options;
  let gl = null;
  // Prefer webgl2 over webgl1, prefer conformant over experimental
  if (webgl2) {
    gl = gl || canvas.getContext('webgl2', options);
    gl = gl || canvas.getContext('experimental-webgl2', options);
  }
  if (webgl1) {
    gl = gl || canvas.getContext('webgl', options);
    gl = gl || canvas.getContext('experimental-webgl', options);
  }

  canvas.removeEventListener('webglcontextcreationerror', onCreateError, false);

  if (!gl) {
    return onError(`Failed to create ${webgl2 && !webgl1 ? 'WebGL2' : 'WebGL'} context`);
  }

  return gl;
}
