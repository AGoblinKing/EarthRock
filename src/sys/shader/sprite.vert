precision highp float;
uniform mat4 u_view_projection;

attribute vec3 position;
attribute float sprite;
attribute vec4 color;

varying vec4 v_color;
varying vec2 v_sprite;

void main() {
  v_color = color;
  v_sprite = vec2(mod(sprite,32.0), floor(sprite / 32.0));
  
  gl_Position = u_view_projection * vec4(position, 1.0);
}