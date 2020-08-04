attribute vec2 a_pos;
attribute vec2 a_anchor_pos;
attribute vec2 a_extrude;
attribute vec2 a_placed;

uniform mat4 u_matrix;
uniform vec2 u_extrude_scale;
uniform float u_camera_to_center_distance;

varying float v_placed;
varying float v_notUsed;
varying float v_radius;

varying vec2 v_extrude;
varying vec2 v_extrude_scale;

void main() {
    vec4 projectedPoint = u_matrix * vec4(a_anchor_pos, 0, 1);
    highp float camera_to_anchor_distance = projectedPoint.w;
    highp float collision_perspective_ratio = clamp(
        0.5 + 0.5 * (u_camera_to_center_distance / camera_to_anchor_distance),
        0.0, // Prevents oversized near-field circles in pitched/overzoomed tiles
        4.0);

    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

    highp float padding_factor = 1.2; // Pad the vertices slightly to make room for anti-alias blur
    gl_Position.xy += a_extrude * u_extrude_scale * padding_factor * gl_Position.w * collision_perspective_ratio;

    v_placed = a_placed.x;
    v_notUsed = a_placed.y;
    v_radius = abs(a_extrude.y); // We don't pitch the circles, so both units of the extrusion vector are equal in magnitude to the radius

    v_extrude = a_extrude * padding_factor;
    v_extrude_scale = u_extrude_scale * u_camera_to_center_distance * collision_perspective_ratio;
}
