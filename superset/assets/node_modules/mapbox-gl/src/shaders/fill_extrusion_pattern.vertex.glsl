uniform mat4 u_matrix;
uniform vec2 u_pixel_coord_upper;
uniform vec2 u_pixel_coord_lower;
uniform float u_height_factor;
uniform vec4 u_scale;
uniform float u_vertical_gradient;

uniform vec3 u_lightcolor;
uniform lowp vec3 u_lightpos;
uniform lowp float u_lightintensity;

attribute vec2 a_pos;
attribute vec4 a_normal_ed;

varying vec2 v_pos_a;
varying vec2 v_pos_b;
varying vec4 v_lighting;

#pragma mapbox: define lowp float base
#pragma mapbox: define lowp float height
#pragma mapbox: define lowp vec4 pattern_from
#pragma mapbox: define lowp vec4 pattern_to

void main() {
    #pragma mapbox: initialize lowp float base
    #pragma mapbox: initialize lowp float height
    #pragma mapbox: initialize mediump vec4 pattern_from
    #pragma mapbox: initialize mediump vec4 pattern_to

    vec2 pattern_tl_a = pattern_from.xy;
    vec2 pattern_br_a = pattern_from.zw;
    vec2 pattern_tl_b = pattern_to.xy;
    vec2 pattern_br_b = pattern_to.zw;

    float pixelRatio = u_scale.x;
    float tileRatio = u_scale.y;
    float fromScale = u_scale.z;
    float toScale = u_scale.w;

    vec3 normal = a_normal_ed.xyz;
    float edgedistance = a_normal_ed.w;

    vec2 display_size_a = vec2((pattern_br_a.x - pattern_tl_a.x) / pixelRatio, (pattern_br_a.y - pattern_tl_a.y) / pixelRatio);
    vec2 display_size_b = vec2((pattern_br_b.x - pattern_tl_b.x) / pixelRatio, (pattern_br_b.y - pattern_tl_b.y) / pixelRatio);

    base = max(0.0, base);
    height = max(0.0, height);

    float t = mod(normal.x, 2.0);
    float z = t > 0.0 ? height : base;

    gl_Position = u_matrix * vec4(a_pos, z, 1);

    vec2 pos = normal.x == 1.0 && normal.y == 0.0 && normal.z == 16384.0
        ? a_pos // extrusion top
        : vec2(edgedistance, z * u_height_factor); // extrusion side

    v_pos_a = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, fromScale * display_size_a, tileRatio, pos);
    v_pos_b = get_pattern_pos(u_pixel_coord_upper, u_pixel_coord_lower, toScale * display_size_b, tileRatio, pos);

    v_lighting = vec4(0.0, 0.0, 0.0, 1.0);
    float directional = clamp(dot(normal / 16383.0, u_lightpos), 0.0, 1.0);
    directional = mix((1.0 - u_lightintensity), max((0.5 + u_lightintensity), 1.0), directional);

    if (normal.y != 0.0) {
        // This avoids another branching statement, but multiplies by a constant of 0.84 if no vertical gradient,
        // and otherwise calculates the gradient based on base + height
        directional *= (
            (1.0 - u_vertical_gradient) +
            (u_vertical_gradient * clamp((t + base) * pow(height / 150.0, 0.5), mix(0.7, 0.98, 1.0 - u_lightintensity), 1.0)));
    }

    v_lighting.rgb += clamp(directional * u_lightcolor, mix(vec3(0.0), vec3(0.3), 1.0 - u_lightcolor), vec3(1.0));
}
