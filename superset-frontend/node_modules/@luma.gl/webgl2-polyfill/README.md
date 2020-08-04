# @luma.gl/webgl2-polyfill

This module installs a partial set of polyfills for WebGL1 contexts, making them more API compatible with WebGL2.

* It adds WebGL2 methods to the WebGL1 context, and simply forwards the calls to WebGL1 extensions.
* It also overrides some `getParameter` type calls returning default values when WebGL2 constants are used.

This way applications can use the WebGL2 API even when using WebGL1 with extensions. While you will still have to check that the extensions you need are available, using the WebGL2 API removes multiple code paths from your application and prepares your code base for WebGL2.


## Usage

```
yarn add @luma.gl/webgl2-polyfill
```

```
import polyfillContext from '@luma.gl/webgl2-polyfill';

const gl = canvas.getContext('webgl');
polyfillContext(gl);
// New methods are now available on the context
```


## Functions

### polyfillContext(gl : WebGLRenderingContext) : WebGLRenderingContext

Installs WebGL2 polyfills on the supplied context.

Returns: the supplied context, with additional methods added (unless it was already a `WebGL2RenderingContext` in which case those methods were already present).

Note: Can be called multiple times and will only install the polyfills once.


## Polyfill List

After `polyfillContext` has been called on a `WebGLRenderingContext`, the following `WebGL2RenderingContext` methods will be available on the context:

| Polyfilled Method            | Uses Extension            | Fallback if no extension |
| ---                          | ---                       | ---                      |
| `gl.createVertexArray()`     | `OES_vertex_array_object` | throws error             |
| `gl.deleteVertexArray()`     |                           | ignored                  |
| `gl.bindVertexArray()`       |                           | ignored                  |
| `gl.isVertexArray()`         |                           | ignored                  |

| Polyfilled Method            | Uses Extension            | Fallback if no extension |
| ---                          | ---                       | ---                      |
| `gl.vertexAttribDivisor()`   | `ANGLE_instanced_arrays`  | throws error             |
| `gl.drawElementsInstanced()` |                           | ignored                  |
| `gl.drawArraysInstanced()`   |                           | ignored                  |

| Polyfilled Method            | Uses Extension            | Fallback if no extension |
| ---                          | ---                       | ---                      |
| `gl.drawBuffers()`           | `WEBGL_draw_buffers`      | throws error             |

| Polyfilled Method            | Uses Extension            | Fallback if no extension |
| ---                          | ---                       | ---                      |
| `gl.createQuery()`           | `EXT_disjoint_timer_query` | throws error            |
| `gl.deleteQuery()`           |                           | ignored                  |
| `gl.beginQuery()`            |                           | ignored                  |
| `gl.endQuery()`              |                           | ignored                  |
| `gl.getQuery()`              |                           | ignored                  |
| `gl.getQueryParameter()`     |                           | ignored                  |



## Remarks

* This module was originally created as a helper for [luma.gl](http://luma.gl), but is designed to be independently usable in other projects. It has no dependencies and makes no assumptions about other modules being available.
