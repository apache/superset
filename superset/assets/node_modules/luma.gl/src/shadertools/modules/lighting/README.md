# Shader Module: Lighting

A "Classical" lighting module. Supports ambient light, one directional light,
and up to four point lights.

Note that lighting can be done in vertex shader or fragment shader.


## Parameters

`getUniforms` take the following parameters when the `picking` module is
included.

* `lightingEnable` (boolean, false) - Activates picking
* `lightingAmbientColor` ([0.2, 0.2, 0.2]) - 
* `lightingDirection` ([1, 1, 1]) - 
* `lightingDirectionalColor` ([0, 0, 0]) - 
* `lightingPointLights` ([]) - array of point light descriptors
* `lightingSpecularHighlights` (boolean, true) - 


## Vertex Shader Functions

### `void lighting_setParameters(vec3)`

* `normal` (`vec3`) - Lighting calculations need the vertex normal


### `vec4 lighting_filterColor(vec4 color)`

Does a vertex shader side lighting calculation.

Example:
```
gl_FragColor = lighting_filterColor(gl_FragColor);
```


## Fragment Shader Functions

### `vec4 lighting_filterColor(vec4 color)`

Returns the lighting color set by `lighting_setPickingColor`,
if is lighting enabled. Otherwise returns its argument, unmodified.

Example:
```
gl_FragColor = lighting_filterColor(gl_FragColor);
```
