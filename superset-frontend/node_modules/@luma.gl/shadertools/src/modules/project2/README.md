# Shader Module: Project

A basic projection module.

Makes it easy to ensure a set of shaders all use the same uniforms when
calculating positions.


## Parameters

`getUniforms` take the following parameters when the `picking` module is
included.

* `projection` (Array[16], false) -
* `view` (Array[16], identity) -


## Vertex Shader Functions

### `vec4 project_toClipspace(vec4 point)`

The most frequently used project operation.

* `point` (`vec3`) - Projects a point to clipspace

Example:
```
// A "minimal" vertex shader
void main(void) {
  gl_Position = project_toClipspace(position);
}
```

## Fragment Shader Functions

The same functions that are available to the vertex shader are also available
to the fragment shader. This is intended to support e.g. lighting calculations
in the fragment shader.
