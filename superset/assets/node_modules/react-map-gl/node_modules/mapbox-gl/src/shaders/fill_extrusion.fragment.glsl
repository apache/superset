varying vec4 v_color;

void main() {
    gl_FragColor = v_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
