precision highp float;
uniform mat4 u_view_projection;
uniform float u_sprite_columns;

attribute vec4 translate;
attribute float sprite;
attribute vec4 color;
attribute vec2 position;

varying vec4 v_color;
varying vec2 v_sprite;

void main() {
  v_color = color;
  v_sprite = vec2(
    0.0, 0.0
  ); 
  
  mat4 mv = u_view_projection;
  vec3 pos = vec3(position * translate.w, 0.0) + translate.xzy;

  gl_Position = mv * vec4(
    pos,
    1.0 
  );

  gl_Position -= vec4(
    (gl_Position.xy) * gl_Position.z, 
    0.0, 0.0
  );
}
