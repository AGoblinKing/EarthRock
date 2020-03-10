precision lowp float;

uniform sampler2D u_map;

varying vec2 v_sprite;
varying vec4 v_color;

void main() {
	vec4 f_color = texture2D(u_map, v_sprite);

	f_color = f_color * v_color;

	// super important, removes low opacity frags
	if(f_color.a < 0.1) discard;

	gl_FragColor = f_color;
}
