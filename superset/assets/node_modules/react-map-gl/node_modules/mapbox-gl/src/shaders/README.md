# Mapbox GL Shaders

This repository contains GL shaders which are shared by [Mapbox GL JS](https://github.com/mapbox/mapbox-gl-js) and [Mapbox GL Native](https://github.com/mapbox/mapbox-gl-native).

## Pragmas

Some variables change type depending on their context:

 - if the variable is the same for all features, we declare it as a `uniform`
 - if the variable is different for each feature, we declare it as an `attribute` (in the vertex shader) and an accompanying `varying` (in both the vertex and fragment shaders).
 - if the variable is different for each feature and a function of zoom, we declare several `attributes` and `uniforms` then calculate the value using interpolation

We abstract over this functionality using pragmas.

```glsl
#pragma mapbox: define highp vec4 color

main() {
    #pragma mapbox: initialize highp vec4 color
    ...
    gl_FragColor = color;
}
```

This program defines a variable within `main` called `color`, initialize the value of `color`, then sets `gl_FragColor` to the value of `color`.

Pragmas take the following form.

```glsl
#pragma mapbox: (define|initialize) (lowp|mediump|highp) (float|vec2|vec3|vec4) {name}
```

When using pragmas, the following requirements apply.

 - all pragma-defined variables must have both `define` and `initialize` pragmas
 - `define` pragmas must be in file scope
 - `initialize` pragmas must be in function scope
 - all pragma-defined variables defined and initialized in the fragment shader must also be defined and initialized in the vertex shader because `attribute`s are not accessible from the fragment shader

## Util

The `util.glsl` file is automatically included in all shaders by the compiler.
