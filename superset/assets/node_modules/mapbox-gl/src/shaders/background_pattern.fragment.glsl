uniform vec2 u_pattern_tl_a;
uniform vec2 u_pattern_br_a;
uniform vec2 u_pattern_tl_b;
uniform vec2 u_pattern_br_b;
uniform vec2 u_texsize;
uniform float u_mix;
uniform float u_opacity;

uniform sampler2D u_image;

varying vec2 v_pos_a;
varying vec2 v_pos_b;

void main() {
    vec2 imagecoord = mod(v_pos_a, 1.0);
    vec2 pos = mix(u_pattern_tl_a / u_texsize, u_pattern_br_a / u_texsize, imagecoord);
    vec4 color1 = texture2D(u_image, pos);

    vec2 imagecoord_b = mod(v_pos_b, 1.0);
    vec2 pos2 = mix(u_pattern_tl_b / u_texsize, u_pattern_br_b / u_texsize, imagecoord_b);
    vec4 color2 = texture2D(u_image, pos2);

    gl_FragColor = mix(color1, color2, u_mix) * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
