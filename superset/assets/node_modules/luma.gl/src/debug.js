// Expose Khronos Debug support module on global context
/* global window, global */
const WebGLDebug = require('webgl-debug');
const global_ = typeof global !== 'undefined' ? global : window;
global_.WebGLDebug = WebGLDebug;

import {installParameterDefinitions} from './webgl-debug/debug-parameters';
installParameterDefinitions();
