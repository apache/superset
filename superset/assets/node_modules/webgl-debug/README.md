# webgl-debug

[![stable](http://badges.github.io/stability-badges/dist/stable.svg)](http://github.com/badges/stability-badges)

WebGL Debug Utils. This is a node port of [WebGLDeveloperTools](https://github.com/KhronosGroup/WebGLDeveloperTools) by Khronos Group.

## Usage

[![NPM](https://nodei.co/npm/webgl-debug.png)](https://www.npmjs.com/package/webgl-debug)

`var WebGLDebugUtil = require('webgl-debug');`

## Examples

Get error code string representation.

```javascript
var WebGLDebugUtil = require('webgl-debug');

var str = WebGLDebugUtil.glEnumToString(gl.getError());
```

Create debug context that will throw error on invalid WebGL operation.

```javascript
var WebGLDebugUtil = require('webgl-debug');

function throwOnGLError(err, funcName, args) {
   throw WebGLDebugUtils.glEnumToString(err) 
   + "was caused by call to " 
   + funcName;
};


gl = WebGLDebugUtils.makeDebugContext(gl, throwOnGLError);
```

## Tutorial

[WebGL Wiki: Debugging](https://www.khronos.org/webgl/wiki/Debugging)

## API

#### init()
Initializes this module. Safe to call more than once.

#### mightBeEnum(value)
Returns true or false if value matches any WebGL enum

#### glEnumToString(value)
Gets an string version of an WebGL enum.

#### glFunctionArgToString(functionName, numArgs, argumentIndx, value)
Converts the argument of a WebGL function to a string

#### glFunctionArgsToString(functionName, args)
Converts the arguments of a WebGL function to a string.

#### makeDebugContext(ctx, onErrorCb, onFuncCallCb)
returns a wrapped context that calls gl.getError after every command and calls a function if the result is not NO_ERROR

#### makeLostContextSimulatingCanvas(canvas)
returns a wrapped canvas element that will simulate lost context

#### resetToInitialState(gl)
Resets a context to the initial state

## License

MIT, see [LICENSE.md](http://github.com/vorg/webgl-debug/blob/master/LICENSE.md) for details.
