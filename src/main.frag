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
uniform sampler2D  text;

// Varyings:
in vec2 uv;

// Output color:
out vec4 fragColor;

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
	// Get distorted UVs from waves framebuffer:
	vec2 distortion = distort();

	// Sample text framebuffer with distorted UVs:
	vec4 textColor = texture(text, distortion);

	// Flip distorted UVs along Y-axis:
	distortion.y = 1.0 - distortion.y;

	// Sample ocean texture, add it to the text
	// framebuffer and render onto the screen:
	fragColor = texture(ocean, distortion) + textColor;

	/* // Sample ocean texture with flipped UVs:
	vec4 oceanColor = texture(ocean, distortion);

	// Get smooth alpha between text and ocean textures:
	float a = smoothstep(textColor.a, oceanColor.a, textColor.a);

	// Get texture color based on alpha value:
	vec4 color = mix(textColor, oceanColor, a);

	// Get highest component in "color" vector:
	float m = max(max(color.r, color.g), color.b);

	// Blend between textures using an "opposite" value:
	fragColor = mix(textColor, oceanColor, 1.0 - m); */
#endif
}
