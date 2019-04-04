// Copyright (c) 2015 - 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

// TODO - need to clean up this code to follow lint rules, disable for now
/* eslint-disable */

import 'babel-polyfill';

import {document, window} from 'global';
import {Buffer, createGLContext, Program, setParameters, assembleShaders, registerShaderModules, fp64} from 'luma.gl';

const BUFFER_DATA = new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]);

// Utilities functions that to be moved to a common place for future tests

function glEnumToString(gl, value) {
  // Optimization for the most common enum:
  if (value === gl.NO_ERROR) {
    return "NO_ERROR";
  }
  for (var p in gl) {
    if (gl[p] == value) {
      return p;
    }
  }
  return "0x" + value.toString(16);
};

function addSpan(contents, div) {
  if (div == undefined) {
    var divs = document.body.getElementsByClassName("testInfo");
    var lastDiv = divs[divs.length - 1];
    div = lastDiv;
  }

  var span = document.createElement("span");
  div.appendChild(span);
  span.innerHTML = contents + '<br />';
}

function addDiv(contents) {
  var testInfoDiv = document.createElement("div");
  document.body.appendChild(testInfoDiv);
  testInfoDiv.setAttribute("class", "testInfo");

  return testInfoDiv;
}

function logToConsole(msg) {
  if (window.console)
    window.console.log(msg);
}

function escapeHTML(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function testPassed(msg) {
  addSpan('<span><span class="pass" style="color:green">PASS</span> ' + escapeHTML(msg) + '</span>');
  logToConsole('PASS ' + msg);
}

function testFailed(msg) {
  addSpan('<span><span class="fail" style="color:red">FAIL</span> ' + escapeHTML(msg) + '</span>');
  logToConsole('FAIL ' + msg);
}

function glErrorShouldBe(gl, glErrors, opt_msg) {
  if (!glErrors.length) {
    glErrors = [glErrors];
  }
  opt_msg = opt_msg || "";
  var err = gl.getError();
  var ndx = glErrors.indexOf(err);
  var errStrs = [];
  for (var ii = 0; ii < glErrors.length; ++ii) {
    errStrs.push(glEnumToString(gl, glErrors[ii]));
  }
  var expected = errStrs.join(" or ");
  if (ndx < 0) {
    var msg = "getError expected" + ((glErrors.length > 1) ? " one of: " : ": ");
    testFailed(msg + expected +  ". Was " + glEnumToString(gl, err) + " : " + opt_msg);
  } else {
    //var msg = "getError was " + ((glErrors.length > 1) ? "one of: " : "expected value: ");
    //testPassed(msg + expected + " : " + opt_msg);
  }
};

// Special utility functions for df64 tests

function fp64ify(a) {
  const a_hi = Math.fround(a);
  const a_lo = a - Math.fround(a);
  return new Float32Array([a_hi, a_lo]);
}

function getFloat64(upper = 256) {
  return Math.random() * Math.pow(2.0, (Math.random() - 0.5) * upper);
}

function getVec4Float64() {
  return [getFloat64(), getFloat64(), getFloat64(), getFloat64()]
}

function getMat4Float64() {
  var result = [];
  for (var i = 0; i < 16; i++)
  {
    result.push(getFloat64());
  }
  return result;
}

function initializeGL(canvas)
{
  const gl = createGLContext(canvas);
  setParameters(gl, {
    viewport: [0, 0, canvas.width, canvas.height],
    clearColor: [0, 0, 0, 1],
    clearDepth: 1
  });
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // var fp_texture_support = gl.getExtension('OES_texture_float');
  // if (!fp_texture_support)
  // {
  //   console.error("no floating point texture support!");
  // }
  return gl;
}

function initializeTexTarget(gl)
{
  var framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  framebuffer.width = 10;
  framebuffer.height = 10;

  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, framebuffer.width, framebuffer.height, 0, gl.RGBA, gl.FLOAT, null);

  var renderbuffer = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, framebuffer.width, framebuffer.height);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

}

function render(gl)
{
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  glErrorShouldBe(gl, gl.NO_ERROR, "no error from draw");
}

function getGPUOutput(gl)
{

  var width = gl.canvas.width;
  var height = gl.canvas.height;
  var buf = new Float32Array(width * height * 4);

  gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, buf);

  return buf;
}

function checkError(result, reference)
{
  var currentDiv = addDiv();
  var line;
  addSpan("------------------------", currentDiv);

  let referece64 = reference[0] + reference[1];
  let result64 = result[0] + result[1];

  line = 'CPU output: (' + reference[0].toString() + ',' + reference[1].toString() + ') = ' + referece64.toString() + '<br>';
  addSpan(line, currentDiv);
  line = "GPU output: (" + result[0].toString() + ',' + result[1].toString() + ',' + result[2].toString() + ',' + result[3].toString() + ') = ' + result64.toString() + '<br>';
  addSpan(line, currentDiv);

  line = "error: " + Math.abs((referece64 - result64) / referece64) + '<br>';
  addSpan(line, currentDiv);


  // var referenceBits = new Int32Array(reference.buffer);
  // var resultBits = new Int32Array(result.buffer);

  // var refHiExp = (referenceBits[0] & 0x7F800000) >>> 23;
  // var refLoExp = (referenceBits[1] & 0x7F800000) >>> 23;
  // var resHiExp = (resultBits[0] & 0x7F800000) >>> 23;
  // var resLoExp = (resultBits[1] & 0x7F800000) >>> 23;

  // var refHiMan = referenceBits[0] & 0x007FFFFF;
  // var refLoMan = referenceBits[1] & 0x007FFFFF;
  // var resHiMan = resultBits[0] & 0x007FFFFF;
  // var resLoMan = resultBits[1] & 0x007FFFFF;

  // if (refHiExp !== resHiExp || refLoExp !== resLoExp)
  // {
  //   line = "High 8-bit exponent error: " + Math.abs(refHiExp - resHiExp).toString() + " ulp<br>";
  //   addSpan(line, currentDiv);
  //   line = "Low 8-bit exponent error: " + Math.abs(refLoExp - resLoExp).toString() + " ulp<br>";
  //   addSpan(line, currentDiv);
  // }

  // line = "High 24-bit mantissa reference: " + refHiMan.toString(2) + " result: " + resHiMan.toString(2) + " error: " + Math.abs(refHiMan - resHiMan).toString() + " ulp<br>";
  // addSpan(line, currentDiv);
  // line = "Low 24-bit mantissa reference: " + refLoMan.toString(2) + " result: " + resLoMan.toString(2) + " error: " + Math.abs(refLoMan - resLoMan).toString() + " ulp<br>";
  // addSpan(line, currentDiv);
}

// Actual tests for different arithmetic functions

function test_float_add(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // float +
  const float0 = getFloat64();
  const float1 = getFloat64();
  const float_ref = float0 + float1;

  const float0_vec2 = fp64ify(float0);
  const float1_vec2 = fp64ify(float1);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_add.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }
    ));
  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    b: float1_vec2,
    ONE: 1.0
  });

  var line;
  line = "(" + float0_vec2.toString() + ') + (' + float1_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_sub(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // float -
  const float0 = getFloat64();
  const float1 = getFloat64();
  const float_ref = float0 - float1;

  const float0_vec2 = fp64ify(float0);
  const float1_vec2 = fp64ify(float1);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
      vs: require('./vs_float_sub.glsl'),
      fs: require('./fs.glsl'),
      modules: ['fp64']
    }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    b: float1_vec2,
    ONE: 1.0
  });

  var line;
  line = "(" + float0_vec2.toString() + ') - (' + float1_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_mul(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // float x
  const float0 = getFloat64(128);
  const float1 = getFloat64(128);

  const float_ref = float0 * float1;

  const float0_vec2 = fp64ify(float0);
  const float1_vec2 = fp64ify(float1);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
    vs: require('./vs_float_mul.glsl'),
    fs: require('./fs.glsl'),
    modules: ['fp64']
  }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    b: float1_vec2,
    ONE: 1.0
  });

  var line;
  line = "(" + float0_vec2.toString() + ') * (' + float1_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_div(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // float /
  const float0 = getFloat64(128);
  const float1 = getFloat64(128);
  const float_ref = float0 / float1;

  const float0_vec2 = fp64ify(float0);
  const float1_vec2 = fp64ify(float1);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
    vs: require('./vs_float_div.glsl'),
    fs: require('./fs.glsl'),
    modules: ['fp64']
  }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    b: float1_vec2,
    ONE: 1.0
  });

  var line;
  line = "(" + float0_vec2.toString() + ') / (' + float1_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_sqrt(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // sqrt
  const float0 = getFloat64(128);
  const float_ref = Math.sqrt(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_sqrt.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "sqrt(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_exp(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // exp
  const float0 = getFloat64(6);
  const float_ref = Math.exp(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_exp.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "exp(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_log(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // log
  const float0 = getFloat64(24);
  const float_ref = Math.log(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_log.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "log(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}


function test_float_sin(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // sin
  const float0 = getFloat64(8);
  const float_ref = Math.sin(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_sin.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "sin(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_cos(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // cos
  const float0 = getFloat64(8);
  const float_ref = Math.cos(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_cos.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "cos(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_tan(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // tan
  const float0 = getFloat64(8);
  const float_ref = Math.tan(float0);

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_tan.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "tan(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

function test_float_radians(gl, testName) {
  var currentDiv = addDiv();
  addSpan(testName, currentDiv);

 // radians
  const float0 = getFloat64(16);
  const float_ref = float0 * Math.PI / 180.0;

  const float0_vec2 = fp64ify(float0);
  const float_ref_vec2 = fp64ify(float_ref);

  const program = new Program(gl, assembleShaders(gl, {
        vs: require('./vs_float_radians.glsl'),
        fs: require('./fs.glsl'),
        modules: ['fp64']
      }));

  program.use();
  program.setBuffers({
    positions: new Buffer(gl, {target: gl.ARRAY_BUFFER, data: BUFFER_DATA, size: 2})
  }).setUniforms({
    a: float0_vec2,
    ONE: 1.0
  });

  var line;
  line = "tan(" + float0_vec2.toString() + ')<br>';
  addSpan(line, currentDiv);
  return float_ref_vec2;
}

// Main entrance
window.onload = () => {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  canvas.width = 16;
  canvas.height = 16;

  // Initialize GL

  var gl = initializeGL(canvas);
  initializeTexTarget(gl);


  registerShaderModules([fp64]);

  var idx0;
  var test_no = 0;
  const loop = 100;

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_add(gl, "Float addition test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_sub(gl, "Float subtraction test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_mul(gl, "Float multiplication test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_div(gl, "Float division test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_sqrt(gl, "Float sqrt test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_exp(gl, "Float exp test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_log(gl, "Float log test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_sin(gl, "Float sin test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
   }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);

    var cpu_result = test_float_cos(gl, "Float cos test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);


  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);


    var cpu_result = test_float_tan(gl, "Float tan test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }

  for (idx0 = 0; idx0 < loop; idx0++) {
    var currentDiv = addDiv();
    addSpan("------------------------", currentDiv);
    addSpan("Loop No. " + test_no++, currentDiv);


    var cpu_result = test_float_radians(gl, "Float radians test");

    render(gl);

    var gpu_result = getGPUOutput(gl);

    checkError(gpu_result, cpu_result);

    addSpan("------------------------", currentDiv);
  }
}
