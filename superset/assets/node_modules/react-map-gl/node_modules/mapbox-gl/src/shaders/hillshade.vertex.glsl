uniform mat4 u_matrix;

attribute vec2 a_pos;
attribute vec2 a_texture_pos;

varying vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos = a_texture_pos / 8192.0;
}
