#version 300 es
precision highp float;

uniform sampler2D u_map;

in vec2 v_sprite;
in vec4 v_color;

out vec4 f_color;

void main() {
	f_color = texture(u_map, v_sprite);

	// grayscale to remove any color from the image
	float gray = dot(f_color.rgb, vec3(0.299, 0.587, 0.114));
	f_color = gray * vec4(v_color.rgb, v_color.a);

	// super important, removes low opacity frags
	if(f_color.a < 0.1) discard;
}