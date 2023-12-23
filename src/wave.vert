#version 300 es
precision mediump float;

// Uniforms:
uniform vec2  translation;
uniform vec2  canvasSize;
uniform float planeSize;
uniform float rotation;
uniform float scale;

// Attributes:
in vec2 position;

// Varyings:
out vec2 uv;

void main(void)
{
	// World position * scale:
	vec2 scaledPosition = position * scale;

	// Get rotation direction of plane angle:
	vec2 direction = vec2(sin(rotation), cos(rotation));

	// Scaled world position * rotation:
	vec2 rotatedScaledPosition = vec2(
		scaledPosition.x * direction.y +
		scaledPosition.y * direction.x,
		scaledPosition.y * direction.y -
		scaledPosition.x * direction.x
	);

	// Local position (scaled & rotated world position + translation):
	vec2 location = rotatedScaledPosition + translation;

	// Convert pixels to clip space:
	vec2 coord = location / canvasSize * 2.0 - 1.0;

	// Flip coords to start from top-left corner:
	gl_Position = vec4(coord * vec2(1.0, -1.0), 0.0, 1.0);

	// Normalize world position, flip coords to start
	// from top-left corner and convert them to UV space:
	uv = position / planeSize * vec2(1.0, -1.0) * 0.5 + 0.5;
}
