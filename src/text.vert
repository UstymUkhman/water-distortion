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
precision mediump float;

// Directives:
#define ONE_THIRD 1.0 / 3.0

// Uniforms:
uniform vec2  textureSize;
uniform float borderSize;
uniform mat3  transform;

// Attributes:
in vec2  position;
in vec2  texture;
in float scale;

// Varyings:
out vec2  uv;
out vec2  sdfTexel;
out float sdfOffset;
out float subpixelOffset;

void main(void)
{
	// Clip space (world position * transform matrix):
	vec3 coord = vec3(position, 1.0) * transform;
    gl_Position = vec4(coord.xy, 0.0, 1.0);

	// Signed distance field size in pixels:
    float sdfSize = borderSize * scale * 2.0;

	// Convert one third of a pixel to texels:
    subpixelOffset = ONE_THIRD / scale;

	// Convert font texture size to texels:
    sdfTexel = 1.0 / textureSize;

	// Distance field delta in pixels:
    sdfOffset = 1.0 / sdfSize;

	// Set text UV coords:
	uv = texture;
}
