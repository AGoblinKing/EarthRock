precision highp float;

uniform mat4 u_view_projection;
uniform float u_sprite_size;
uniform float u_sprite_columns;
uniform float u_time;

attribute vec3 translate;
attribute vec3 translate_last;

attribute float scale;
attribute float scale_last;

attribute float rotation;
attribute float rotation_last;

attribute float alpha;
attribute float alpha_last;

attribute float color;
attribute float color_last;

attribute float sprite;

attribute vec2 position;

varying vec2 v_sprite;
varying vec4 v_color;

void main() {
  v_color = mix(
    vec4(color_last/256.0/256.0, mod(color_last/256.0, 256.0), mod(color_last, 256.0), alpha_last),
    vec4(color/256.0/256.0, mod(color/256.0, 256.0), mod(color, 256.0), alpha),
    u_time
  );

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
}
