/*
 * Copyright (c) 2017 Anton Stepin astiopin@gmail.com
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

#version 300 es

#ifndef GL_FRAGMENT_PRECISION_HIGH
	precision mediump float;
#else
	precision highp float;
#endif

// Uniforms:
uniform bool 	  subpixelRendering;
uniform sampler2D fontTexture;
uniform vec4  	  color;

// Varyings:
in vec2  uv;
in vec2  sdfTexel;
in float sdfOffset;
in float subpixelOffset;

// Output color:
out vec4 fragColor;

// SDF functions:
#include sdf.glsl;

void main(void)
{
    // Sample the texture with L pattern:
    float sdf  = texture(fontTexture, uv).g;
    float sdfX = texture(fontTexture, uv + vec2(sdfTexel.x, 0.0)).g;
    float sdfY = texture(fontTexture, uv + vec2(0.0, sdfTexel.y)).g;

    // Estimate stroke direction by the distance field gradient vector:
    vec2 strokeGradient = vec2(sdfX - sdf, sdfY - sdf);
    float strokeGradientLength = max(length(strokeGradient), 0.0078125);

	// Calculate stroke vertical gradient from its direction length:
    vec2 gradient = strokeGradient / vec2(strokeGradientLength);
    float verticalGradient = abs(gradient.y);

    if (subpixelRendering)
	{
        // Subpixel SDF samples:
        vec2 subpixel = vec2(subpixelOffset, 0.0);

        // For displays with vertical subpixel placement:
        // vec2 subpixel = vec2(0.0, subpixelOffset);

        float x = texture(fontTexture, uv - subpixel).g;
        float z = texture(fontTexture, uv + subpixel).g;

		// Horizontal scale should equal to a subpixel
		// size (1 / 3), but that seems to be too colorful:
        vec3 tripletAlpha = SDFAlpha(vec3(x, sdf, z), 0.5, 0.6, verticalGradient);

        // For BGR subpixels:
        // tripletAlpha = tripletAlpha.bgr;

		// Keep text color by multiplying it by the SDF:
        fragColor = vec4(tripletAlpha * color.rgb, color.a);
    }
	else
	{
		// Calculate alpha factor from stroke vertical gradient:
		float alpha = SDFAlpha(sdf, 1.1, 0.6, verticalGradient);
        fragColor = vec4(color.rgb, color.a * alpha);
    }
}
