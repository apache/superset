uniform float u_overscale_factor;

varying float v_placed;
varying float v_notUsed;
varying float v_radius;
varying vec2 v_extrude;
varying vec2 v_extrude_scale;

void main() {
    float alpha = 0.5;

    // Red = collision, hide label
    vec4 color = vec4(1.0, 0.0, 0.0, 1.0) * alpha;

    // Blue = no collision, label is showing
    if (v_placed > 0.5) {
        color = vec4(0.0, 0.0, 1.0, 0.5) * alpha;
    }

    if (v_notUsed > 0.5) {
        // This box not used, fade it out
        color *= .2;
    }

    float extrude_scale_length = length(v_extrude_scale);
    float extrude_length = length(v_extrude) * extrude_scale_length;
    float stroke_width = 15.0 * extrude_scale_length / u_overscale_factor;
    float radius = v_radius * extrude_scale_length;

    float distance_to_edge = abs(extrude_length - radius);
    float opacity_t = smoothstep(-stroke_width, 0.0, -distance_to_edge);

    gl_FragColor = opacity_t * color;
}
