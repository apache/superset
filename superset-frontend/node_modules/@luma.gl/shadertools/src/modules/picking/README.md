# Shader Module: Picking

Provides support for color-coding-based picking and highlighting. In particular, supports picking a specific instance in an instanced draw call and highlighting an instance based on its picking color, and correspondingly, supports picking and highlighting groups of primitives with the same picking color in non-instanced draw-calls

Color based picking lets the application draw a primitive with a color that can later be used to index this specific primitive.

Highlighting allows application to specify a picking color corresponding to an object that need to be highlighted and the highlight color to be used.

## Usage

In your vertex shader, your inform the picking module what object we are currently rendering by supplying a picking color, perhaps from an attribute.
```
attribute vec3 aPickingColor;
main() {
  picking_setColor(aPickingColor);
  ...
}
```

In your fragment shader, you simply apply (call) the `picking_filterColor` filter function at the very end of the shader. This will return the normal color, or the highlight color, or the picking color, as appropriate.
```
main() {
  gl_FragColor = ...
  gl_FragColor = picking_filterColor(color);
}
```

If highlighting is not needed, you simply apply (call) the `picking_filterPickingColor` filter function at the very end of the shader. This will return the normal color or the picking color, as appropriate.
```
main() {
  gl_FragColor = ...
  gl_FragColor = picking_filterPickingColor(gl_FragColor);
}
```

If additional filters need to be applied on the non-picking color (vertex or highlight color) you can use above functions in following order.
 ```
main() {
   gl_FragColor = ...
   gl_FragColor = picking_filterHighlightColor(gl_FragColor);
    ... apply any filters on gl_FragColor ...
  gl_FragColor = picking_filterPickingColor(gl_FragColor);
}
```

## JavaScript Functions

### getUniforms

`getUniforms` takes an object takes a set of key/value pairs, returns an object with key/value pairs representing the uniforms that the `picking` module shaders need.

`getUniforms(opts)`
opts can contain following keys:
* `pickingSelectedColorValid` (*boolean*) - When true current instance picking color is ignored, hence no instance is highlighted.
* `pickingSelectedColor` (*array*) - Picking color of the currently selected instance.
* `pickingHighlightColor` (*array*)- Color used to highlight the currently selected instance.
* `pickingActive`=`false` (*boolean*) - When true, renders the picking colors instead of the normal colors. Normally only used with an off-screen framebuffer during picking. Default value is `false`.

Note that the selected item will be rendered using `pickingHighlightColor`, if blending is enabled for the draw, alpha channel can be used to control the blending result.


## Vertex Shader Functions

### `void picking_setPickingColor(vec3)`

Sets the color that will be returned by the fragment shader if color based picking is enabled. Typically set from a `pickingColor` uniform or a `pickingColors` attribute (e.g. when using instanced rendering, to identify the actual instance that was picked).


## Fragment Shader Functions

### picking_filterPickingColor

If picking active, returns the current vertex's picking color set by `picking_setPickingColor`, otherwise returns its argument unmodified.

`vec4 picking_filterPickingColor(vec4 color)`

### picking_filterHighlightColor

Returns picking highlight color if the pixel belongs to currently selected model, otherwise returns its argument unmodified.

`vec4 picking_filterHighlightColor(vec4 color)`

## Remarks

* It is strongly recommended that `picking_filterPickingColor` is called last in a fragment shader, as the picking color (returned when picking is enabled) must not be modified in any way (and alpha must remain 1) or picking results will not be correct.
