import GL from '@luma.gl/constants';

/**
 * Provides strings identifying the GPU vendor and driver.
 * https://www.khronos.org/registry/webgl/extensions/WEBGL_debug_renderer_info/
 * @param {WebGLRenderingContext} gl - context
 * @return {Object} - 'vendor' and 'renderer' string fields.
 */
export function getContextDebugInfo(gl) {
  const vendorMasked = gl.getParameter(GL.VENDOR);
  const rendererMasked = gl.getParameter(GL.RENDERER);
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const vendorUnmasked = ext && gl.getParameter(ext.UNMASKED_VENDOR_WEBGL || GL.VENDOR);
  const rendererUnmasked = ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL || GL.RENDERER);
  return {
    vendor: vendorUnmasked || vendorMasked,
    renderer: rendererUnmasked || rendererMasked,
    vendorMasked,
    rendererMasked,
    version: gl.getParameter(GL.VERSION),
    shadingLanguageVersion: gl.getParameter(GL.SHADING_LANGUAGE_VERSION)
  };
}
