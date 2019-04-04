#ifdef GL_ES
precision highp float;
#endif

uniform sampler2D u_image;
varying vec2 v_pos;
uniform vec2 u_dimension;
uniform float u_zoom;
uniform float u_maxzoom;

float getElevation(vec2 coord, float bias) {
    // Convert encoded elevation value to meters
    vec4 data = texture2D(u_image, coord) * 255.0;
    return (data.r + data.g * 256.0 + data.b * 256.0 * 256.0) / 4.0;
}

void main() {
    vec2 epsilon = 1.0 / u_dimension;

    // queried pixels:
    // +-----------+
    // |   |   |   |
    // | a | b | c |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | d | e | f |
    // |   |   |   |
    // +-----------+
    // |   |   |   |
    // | g | h | i |
    // |   |   |   |
    // +-----------+

    float a = getElevation(v_pos + vec2(-epsilon.x, -epsilon.y), 0.0);
    float b = getElevation(v_pos + vec2(0, -epsilon.y), 0.0);
    float c = getElevation(v_pos + vec2(epsilon.x, -epsilon.y), 0.0);
    float d = getElevation(v_pos + vec2(-epsilon.x, 0), 0.0);
    float e = getElevation(v_pos, 0.0);
    float f = getElevation(v_pos + vec2(epsilon.x, 0), 0.0);
    float g = getElevation(v_pos + vec2(-epsilon.x, epsilon.y), 0.0);
    float h = getElevation(v_pos + vec2(0, epsilon.y), 0.0);
    float i = getElevation(v_pos + vec2(epsilon.x, epsilon.y), 0.0);

    // here we divide the x and y slopes by 8 * pixel size
    // where pixel size (aka meters/pixel) is:
    // circumference of the world / (pixels per tile * number of tiles)
    // which is equivalent to: 8 * 40075016.6855785 / (512 * pow(2, u_zoom))
    // which can be reduced to: pow(2, 19.25619978527 - u_zoom)
    // we want to vertically exaggerate the hillshading though, because otherwise
    // it is barely noticeable at low zooms. to do this, we multiply this by some
    // scale factor pow(2, (u_zoom - u_maxzoom) * a) where a is an arbitrary value
    // Here we use a=0.3 which works out to the expression below. see 
    // nickidlugash's awesome breakdown for more info
    // https://github.com/mapbox/mapbox-gl-js/pull/5286#discussion_r148419556
    float exaggeration = u_zoom < 2.0 ? 0.4 : u_zoom < 4.5 ? 0.35 : 0.3;

    vec2 deriv = vec2(
        (c + f + f + i) - (a + d + d + g),
        (g + h + h + i) - (a + b + b + c)
    ) /  pow(2.0, (u_zoom - u_maxzoom) * exaggeration + 19.2562 - u_zoom);

    gl_FragColor = clamp(vec4(
        deriv.x / 2.0 + 0.5,
        deriv.y / 2.0 + 0.5,
        1.0,
        1.0), 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
