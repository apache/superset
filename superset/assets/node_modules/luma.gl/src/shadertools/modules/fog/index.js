export const name = 'fog';

/* eslint-disable camelcase */
export function getUniforms({
  fogEnable = false,
  fogColor = [0.5, 0.5, 0.5],
  fogNear = 1,
  fogFar = 100
} = {}) {
  return {
    fog_uEnable: fogEnable,
    fog_uColor: fogColor,
    fog_uNear: fogNear,
    fog_uFar: fogFar
  };
}

export const vs = '';

export const fs = `\
// fog configuration
uniform bool fog_uEnable;
uniform vec3 fog_uColor;
uniform float fog_uNear;
uniform float fog_uFar;

/*
 * Applies linear fog to a color
 * param - unfogged color
 * return - fogged color
 */
vec4 fog_filterColor(vec4 color) {
  if (fog_uEnable) {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep(fog_uNear, fog_uFar, depth);
    return mix(color, vec4(fog_uColor, gl_FragColor.w), fogFactor);
  } else {
    return color;
  }
}

// Other fog shaders, exponential etc, see
// http://in2gpu.com/2014/07/22/create-fog-shader/
`;
