
varying float v_placed;
varying float v_notUsed;

void main() {

    float alpha = 0.5;

    // Red = collision, hide label
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0) * alpha;

    // Blue = no collision, label is showing
    if (v_placed > 0.5) {
        gl_FragColor = vec4(0.0, 0.0, 1.0, 0.5) * alpha;
    }

    if (v_notUsed > 0.5) {
        // This box not used, fade it out
        gl_FragColor *= .1;
    }
}