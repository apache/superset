# @luma.gl/webgl-state-tracker

Provides WebGL context state tracking and a unified API for setting WebGL parameters

## State tracking

This module installs overrides on a `WebGLRenderingContext` that track state changes and allow context state to be saved and restored through push and pop operations.

This is useful when combining code written in different WebGL frameworks or code bases, as each code base can make changes to the global WebGLRenderingContext state and leave it in a state that causes problems for the other code base.


## Usage

```
yarn add @luma.gl/webgl-state-tracker
```

```
import trackContextState from '@luma.gl/webgl-state-tracker';

const gl = canvas.getContext('webgl');
trackContextState(gl);
```

## Functions

### trackContextState(gl : WebGLRenderingContext, options: Object)

Initialize WebGL state caching on a context. After calling this function, context state will be cached. State caching speeds up parameter access and enables `pushContextState` and `popContextState` to efficiently save and restore global WebGL context state.

`trackContextState(gl, {enable = true, copyState} = {})`

* `gl` (WebGLRenderingContext) - gl context
* `enable` (Boolean) - whether cache is being used
* `copyState` whether the state cache is initialized to WebGL defaults (fast) or read from the context (slow)

Remarks:
* `trackContextState` can be called multiple times to enable/disable state cache.
* `copyState`-`false` is fast, and yields correct results for newly created, unmodified contexts. If you are tracking a context created by an external framework, it is likely safest to use `copyState`=`true` to ensure the cache corresponds to the context state.


### pushContextState(gl : WebGLRenderingContext)

Saves the current state of the context by "pushing" it onto an internal stack, enabling it to be restored later.

`pushContextState(gl)`

* `gl` (WebGLRenderingContext) - gl context
Returns: nothing

Remarks:
* Can be called multiple times, enabling "nested" usage.
* Each invocation of `pushContextState` is expected to be matched by a call to `popContextState` at a later time.


### popContextState(gl : WebGLRenderingContext)

Restores the state of the context at the time of the latest call to `pushContextState`.

`popContextState(gl)`

* `gl` (WebGLRenderingContext) - gl context
Returns: nothing

Remarks;
* Any changes made to the context state after the last call to `pushContextState` are undone and "discarded".
* It is an error to call `popContextState` without first doing a matching call to `pushContextState`.


## Remarks

* This a helper module for [luma.gl](http://luma.gl), but is designed to be independently usable in other projects.
