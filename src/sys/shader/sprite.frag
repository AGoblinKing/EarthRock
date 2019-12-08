precision highp float;
uniform sampler2D u_map;

varying vec2 v_sprite;
varying vec4 v_color;

void main() {
  gl_FragColor = texture2D(u_map, v_sprite) * v_color;
}