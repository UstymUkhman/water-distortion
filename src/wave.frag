#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
	precision mediump float;
#else
	precision highp float;
#endif

// Uniforms:
uniform sampler2D distortion;
uniform float 	  alpha;

// Varyings:
in vec2 uv;

// Output color:
out vec4 fragColor;

void main(void)
{
	// Multiply distortion texture alpha
	// by uniform alpha to preserve fade:
	vec4 color = texture(distortion, uv);
	fragColor = vec4(color.rgb, color.a * alpha);
}
