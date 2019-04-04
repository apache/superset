
#pragma mapbox: define lowp float blur
#pragma mapbox: define lowp float opacity

uniform sampler2D u_image;

varying vec2 v_width2;
varying vec2 v_normal;
varying float v_gamma_scale;
varying highp float v_lineprogress;

void main() {
    #pragma mapbox: initialize lowp float blur
    #pragma mapbox: initialize lowp float opacity

    // Calculate the distance of the pixel from the line in pixels.
    float dist = length(v_normal) * v_width2.s;

    // Calculate the antialiasing fade factor. This is either when fading in
    // the line in case of an offset line (v_width2.t) or when fading out
    // (v_width2.s)
    float blur2 = (blur + 1.0 / DEVICE_PIXEL_RATIO) * v_gamma_scale;
    float alpha = clamp(min(dist - (v_width2.t - blur2), v_width2.s - dist) / blur2, 0.0, 1.0);

    // For gradient lines, v_lineprogress is the ratio along the entire line,
    // scaled to [0, 2^15), and the gradient ramp is stored in a texture.
    vec4 color = texture2D(u_image, vec2(v_lineprogress, 0.5));

    gl_FragColor = color * (alpha * opacity);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
