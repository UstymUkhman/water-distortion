#version 300 es
precision mediump float;

// Uniforms:
uniform vec2 size;

// Attributes:
in vec2 position;

// Varyings:
out vec2 uv;

void main(void)
{
	// Convert pixels to clip space:
	vec2 coord = position / size * 2.0 - 1.0;
	gl_Position = vec4(coord, 0.0, 1.0);
	// Convert coords to UV space:
	uv = coord * 0.5 + 0.5;
}
