precision highp float;

uniform sampler2D u_map;

varying vec2 v_sprite;
varying vec4 v_color;

void main() {
	gl_FragColor = texture2D(u_map, v_sprite) * v_color;
	gl_FragColor.rgb *= gl_FragColor.a;

	// super important, removes low opacity frags
	if(gl_FragColor.a < 0.1) discard;
}