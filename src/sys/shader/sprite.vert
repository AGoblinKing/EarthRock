#version 300 es
precision lowp float;

uniform mat4 u_view_projection;
uniform float u_sprite_size;
uniform float u_sprite_columns;
uniform float u_time;

in vec3 translate;
in vec3 translate_last;

in float scale;
in float scale_last;

in float rotation;
in float rotation_last;

in vec4 color;
in vec4 color_last;

in float sprite;

in vec2 position;

in int flags;

out vec2 v_sprite;
out vec4 v_color;

void main() {
	// mix the last color and the new color
	v_color = mix(
		color,
		color_last,
		u_time
	);

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
