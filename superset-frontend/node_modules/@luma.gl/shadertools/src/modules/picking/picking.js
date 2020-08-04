const DEFAULT_HIGHLIGHT_COLOR = new Uint8Array([0, 255, 255, 255]);

const DEFAULT_MODULE_OPTIONS = {
  pickingSelectedColor: null, //  Set to a picking color to visually highlight that item
  pickingHighlightColor: DEFAULT_HIGHLIGHT_COLOR, // Color of visual highlight of "selected" item
  pickingThreshold: 1.0,
  pickingActive: false // Set to true when rendering to off-screen "picking" buffer
};

/* eslint-disable camelcase */
function getUniforms(opts = DEFAULT_MODULE_OPTIONS) {
  const uniforms = {};
  if (opts.pickingSelectedColor !== undefined) {
    if (opts.pickingSelectedColor === null) {
      uniforms.picking_uSelectedColorValid = 0;
    } else {
      const selectedColor = [
        opts.pickingSelectedColor[0],
        opts.pickingSelectedColor[1],
        opts.pickingSelectedColor[2]
      ];
      uniforms.picking_uSelectedColorValid = 1;
      uniforms.picking_uSelectedColor = selectedColor;
    }
  }
  if (opts.pickingHighlightColor !== undefined) {
    uniforms.picking_uHighlightColor = opts.pickingHighlightColor;
  }
  // TODO - major hack - decide on normalization and remove
  if (opts.pickingThreshold !== undefined) {
    uniforms.picking_uThreshold = opts.pickingThreshold;
  }
  if (opts.pickingActive !== undefined) {
    uniforms.picking_uActive = opts.pickingActive ? 1 : 0;
  }
  return uniforms;
}

const vs = `\
uniform vec3 picking_uSelectedColor;
uniform float picking_uThreshold;
uniform bool picking_uSelectedColorValid;

out vec4 picking_vRGBcolor_Aselected;

const float COLOR_SCALE = 1. / 255.;

bool isVertexPicked(vec3 vertexColor) {
  return
    picking_uSelectedColorValid &&
    abs(vertexColor.r - picking_uSelectedColor.r) < picking_uThreshold &&
    abs(vertexColor.g - picking_uSelectedColor.g) < picking_uThreshold &&
    abs(vertexColor.b - picking_uSelectedColor.b) < picking_uThreshold;
}

void picking_setPickingColor(vec3 pickingColor) {
  // Do the comparison with selected item color in vertex shader as it should mean fewer compares
  picking_vRGBcolor_Aselected.a =
    float(isVertexPicked(pickingColor));

  // Stores the picking color so that the fragment shader can render it during picking
  picking_vRGBcolor_Aselected.rgb = pickingColor * COLOR_SCALE;
}
`;

const fs = `\
uniform bool picking_uActive; // true during rendering to offscreen picking buffer
uniform vec3 picking_uSelectedColor;
uniform vec4 picking_uHighlightColor;

in vec4 picking_vRGBcolor_Aselected;

const float COLOR_SCALE = 1. / 255.;

/*
 * Returns highlight color if this item is selected.
 */
vec4 picking_filterHighlightColor(vec4 color) {
  bool selected = bool(picking_vRGBcolor_Aselected.a);

  if (selected) {
    vec4 highLightColor = picking_uHighlightColor * COLOR_SCALE;

    float highLightAlpha = highLightColor.a;
    float blendedAlpha = highLightAlpha + color.a * (1.0 - highLightAlpha);
    float highLightRatio = highLightAlpha / blendedAlpha;

    vec3 blendedRGB = mix(color.rgb, highLightColor.rgb, highLightRatio);
    return vec4(blendedRGB, blendedAlpha);
  } else {
    return color;
  }
}

/*
 * Returns picking color if picking enabled else unmodified argument.
 */
vec4 picking_filterPickingColor(vec4 color) {
  vec3 pickingColor = picking_vRGBcolor_Aselected.rgb;
  if (picking_uActive && length(pickingColor) < 0.001) {
    discard;
  }
  return picking_uActive ? vec4(pickingColor, 1.0) : color;
}

/*
 * Returns picking color if picking is enabled if not
 * highlight color if this item is selected, otherwise unmodified argument.
 */
vec4 picking_filterColor(vec4 color) {
  vec4 highightColor = picking_filterHighlightColor(color);
  return picking_filterPickingColor(highightColor);
}

`;

export default {
  name: 'picking',
  vs,
  fs,
  getUniforms
};
