#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
	precision mediump float;
#else
	precision highp float;
#endif

// Directives:
#define TAU 6.2831853
// #define FRAMEBUFFER

// Uniforms:
uniform float 	  force;
uniform sampler2D ocean;
uniform sampler2D waves;

// Varyings:
in vec2 uv;

// Output color:
out vec4 fragColor;

// UV distortion:
vec2 distort(void)
{
	// Get color from waves framebuffer:
	vec4 distortion = texture(waves, uv);

	// Angle in radians of one channel:
	float theta = distortion.g * TAU;

	// Get rotation direction of that angle:
	vec2 direction = vec2(sin(theta), cos(theta));

	// Update UV with a distortion strength value
	// applied to the current rotation direction:
	return uv + distortion.g * force * direction;
}

void main(void)
{
#ifdef FRAMEBUFFER
	// Render waves framebuffer to the screen:
	fragColor = vec4(texture(waves, uv).rgb, 1.0);
#else
	vec2 distortion = distort();

	// Flip texture UVs along Y-axis:
	distortion.y = 1.0 - distortion.y;

	// Render distorted texture to the screen:
	fragColor = texture(ocean, distortion);
#endif
}
