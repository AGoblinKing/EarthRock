#version 300 es
precision highp float;

uniform mat4 u_view_projection;
uniform float u_sprite_size;
uniform float u_sprite_columns;
uniform float u_time;
uniform float u_background_color;

in vec3 translate;
in vec3 translate_last;

in float scale;
in float scale_last;

in float rotation;
in float rotation_last;

in float alpha;
in float alpha_last;

in float color;
in float color_last;

in float sprite;

in vec2 position;

out vec2 v_sprite;
out vec4 v_color;

void main() {
	// mix the last color and the new color
	int c_last = int(color_last);
	int c = int(color);

	v_color = mix(
		vec4((c_last>>16) &0x0ff, (c_last>>8) &0x0ff, (c_last) & 0x0ff, alpha_last),
		vec4((c>>16) &0x0ff, (c>>8) &0x0ff, (c) & 0x0ff, alpha),
		u_time
	);

	// mix the color with the background color
	// int ubc = int(u_background_color);
	// vec4 color_bg = vec4((ubc>>16) &0x0ff, (ubc>>8) &0x0ff, (ubc) & 0x0ff, alpha);

	// v_color = mix(color_bg, v_color, alpha);

	// scale
	float s = mix(scale_last, scale, u_time);

	// Grabbing the tile
	float x = mod(sprite, u_sprite_columns);
	float y = floor(sprite / u_sprite_columns);

	vec2 pos_scale = position * s;
	vec2 coords = (position + vec2(0.5, 0.5) + vec2(x, y))/u_sprite_columns;
	v_sprite = coords;

	// position
	vec3 t = mix(translate_last, translate, u_time);

	mat4 mv = u_view_projection;
	vec3 pos = vec3(pos_scale, 0.0) + t;

	gl_Position = mv * vec4(
		pos,
		1.0
	);
}
