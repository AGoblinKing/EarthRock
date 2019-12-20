precision highp float;

uniform mat4 u_view_projection;
uniform float u_sprite_size;
uniform float u_sprite_columns;
uniform float u_time;

attribute vec3 translate;
attribute vec3 translate_last;

attribute float scale;
attribute float scale_last;
attribute float sprite;
attribute vec2 position;

varying vec2 v_sprite;

void main() {
  float x = mod(sprite, u_sprite_columns);
  float y = floor(sprite / u_sprite_columns);

  float s = mix(scale_last, scale, u_time);

  vec2 pos_scale = position * s;
  vec2 coords = (position + vec2(0.5, 0.5) + vec2(x, y))/u_sprite_columns;
  v_sprite = coords;

  vec3 t = mix(translate_last, translate, u_time);
  mat4 mv = u_view_projection;
  vec3 pos = vec3(pos_scale, 0.0) + t;

  gl_Position = mv * vec4(
    pos,
    1.0
  );

  gl_Position -= vec4(
    (gl_Position.xy) * gl_Position.z,
    0.0, 0.0
  );
}
