# Shader Module: fog

Implements a linear fog effect. Essentually attenuates a color based on
distance from viewer (fragment depth) and mixes in a fog color.


## Parameters

* `fogEnable` (Boolean, false) - Allows fog to be disabled
* `fogColor` (Array[4], [0.5,0.5,0.5,1]) - The color that will be mixed in
  when distance increases. Defaults to a "medium" grey.
* `fogNear` (Number, 1) - Distance where there is no fog.
* `fogFar` (Number, 100) - Distance with 100% fog.


## Vertex Shader Functions

None


## Fragment Shader Functions

### `vec4 fog_filterColor(vec4 color)`

Applies a fog effect to the color, based on fragment distance and uniforms.

Example:
```
gl_FragColor = fog_filterColor(gl_FragColor);
```
