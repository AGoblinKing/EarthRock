precision highp float;

uniform sampler2D u_map;

varying vec2 v_sprite;
varying vec4 v_color;

void main() {
	gl_FragColor = texture2D(u_map, v_sprite);

	// grayscale to remove any color from the image
	float gray = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
	gl_FragColor = vec4(vec3(gray) * v_color.rgb, v_color.a * gl_FragColor.a);

	// super important, removes low opacity frags
	if(gl_FragColor.a < 0.1) discard;
}