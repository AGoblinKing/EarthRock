precision highp float;

uniform sampler2D map;

varying vec2 vUv;
varying vec3 vTint;
varying float vOpacity;

vec4 LinearToLinear(in vec4 value) {
  return value;
}

void main() {
  gl_FragColor = LinearToLinear(texture2D(map, vUv)) * vec4(vTint, vOpacity);
  if ( gl_FragColor.a < 0.5 ) discard;
}