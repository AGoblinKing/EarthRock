precision highp float;

uniform mat4 u_view_projection;
uniform float u_sprite_size;
uniform float u_sprite_columns;

attribute vec3 translate;
attribute float scale;
attribute float sprite;
attribute vec2 position;

varying vec2 v_sprite;

void main() {
  float x = mod(sprite, u_sprite_columns);
  float y = floor(sprite / u_sprite_columns);

  vec2 pos_scale = position * scale;
  vec2 coords = (pos_scale + vec2(0.5, 0.5) + vec2(x, y))/u_sprite_columns;
  v_sprite = coords;

  mat4 mv = u_view_projection;
  vec3 pos = vec3(pos_scale, 0.0) + translate.xzy;

  gl_Position = mv * vec4(
    pos,
    1.0
  );

  gl_Position -= vec4(
    (gl_Position.xy) * gl_Position.z,
    0.0, 0.0
  );
}
