var WebGLDebugUtils = require('../')

function logGLCall (functionName, args) {
  // console.log('gl.' + functionName + '(' + WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ')')
}

function throwOnGLError (err, funcName, args) {
  throw new Error(WebGLDebugUtils.glEnumToString(err) + ' was caused by call to ' + funcName + ' ' + Object.keys(args).map((i) => `"${args[i]}"`))
}

var canvas = document.createElement('canvas')
var gl = canvas.getContext('webgl')
console.log('gl1')
var tex = gl.createTexture()

gl.bindTexture(gl.TEXTURE_2D, tex) // no problem
gl.bindTexture(gl.TEXTURE_3D, tex) // not avail in webgl1, warning but no problem

var dgl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError, logGLCall)
try {
  dgl.bindTexture(gl.TEXTURE_3D, tex) // not avail in webg1, throws
} catch (e) {
  console.log(e)
}

var canvas2 = document.createElement('canvas')
var gl2 = canvas2.getContext('webgl2')
console.log('gl2', gl2)
var tex2 = gl2.createTexture()

gl2.bindTexture(gl2.TEXTURE_2D, tex2) // no problem
gl2.texStorage2D(gl2.TEXTURE_2D, 0, gl2.RGBA88, 512, 512) // typo, double 8, no problem

var dgl2 = WebGLDebugUtils.makeDebugContext(gl2, throwOnGLError, logGLCall)
dgl2.texStorage2D(gl2.TEXTURE_2D, 0, gl2.RGBA88, 512, 512) // typo, throws
