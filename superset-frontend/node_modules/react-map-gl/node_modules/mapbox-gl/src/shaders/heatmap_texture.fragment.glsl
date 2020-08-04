uniform sampler2D u_image;
uniform sampler2D u_color_ramp;
uniform float u_opacity;
varying vec2 v_pos;

void main() {
    float t = texture2D(u_image, v_pos).r;
    vec4 color = texture2D(u_color_ramp, vec2(t, 0.5));
    gl_FragColor = color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
