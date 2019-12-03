
precision highp float;

uniform mat4 model_view_matrix;
uniform mat4 projectionMatrix;

uniform float time;

attribute float scale;
attribute vec3 position;

attribute float sprite;
attribute float opacity;
attribute float color;
attribute vec2 slice;

varying float vOpacity;
varying vec3 vTint;
varying vec2 vUv;

void main() {
  vTint = tint;
  vOpacity = opacity;
  vUv = uv * cellsize + slice * cellsize;

  vec2 huv = vec2((translate.x + 100.0)/200.0, (-translate.y + 100.0)/200.0);

  float alpha = texture2D(heightmap, huv).a;

  vec4 offset = vec4(translate.x - 0.5, alpha * 255.0 * 0.2 + 0.5, translate.y - 0.5, 1.0);

  vec4 mvPosition = model_view_matrix * offset;
  mvPosition.xyz += position.xyz * scale;

  gl_Position = projectionMatrix * mvPosition;
}