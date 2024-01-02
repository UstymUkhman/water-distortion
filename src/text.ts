type RGBA = [number, number, number, number];
type Chars = keyof typeof Roboto['chars'];
type Char = typeof Roboto['chars'][Chars];

import Roboto from '@/roboto.json';
import Fragment from '@/text.frag';
import Vertex from '@/text.vert';

type Font = typeof Roboto & {
	kern?: Record<string, number>;
};

type Metrics = {
	ascentScale: number;
	lineHeight: number;
	lowScale: number;
	upScale: number;
	size: number;
};

export default class Text
{
	private vertices!: number;
	private rectangle!: number[];

	private readonly subpixel = true;
	private readonly program: WebGLProgram;
	private transform = new Float32Array(9);

	private vertexData = new Float32Array(3e5);
	private vertexBuffer: WebGLBuffer | null = null;
	private readonly color: RGBA = [1.0, 1.0, 1.0, 1.0];

	private framebuffer: WebGLFramebuffer | null = null;
	private framebufferTexture: WebGLTexture | null = null;

	public constructor(
		private readonly gl: WebGL2RenderingContext,
		image: HTMLImageElement
	) {
		// Create, compile and use "text" WebGL program:
		if (this.program = this.createProgram() as WebGLProgram)
		{
			// Use "Roboto Bold" font texture:
			this.createFontTexture(image);

			// Create text vertex buffer:
			this.createTextBufferData();

			// Create SDF text uniforms:
			this.createTextUniforms();

			// Create text framebuffer:
			this.createFramebuffer();
		}
	}

	private createProgram(): WebGLProgram | void
	{
		// Create and compile "text" vertext shader:
		const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
		this.gl.shaderSource(vertexShader, Vertex);
		this.gl.compileShader(vertexShader);

		if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling vertex shader: ${this.gl.getShaderInfoLog(vertexShader)}`);
			return this.gl.deleteShader(vertexShader);
		}

		// Create and compile "text" fragment shader:
		const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
		this.gl.shaderSource(fragmentShader, Fragment);
		this.gl.compileShader(fragmentShader);

		if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling fragment shader: ${this.gl.getShaderInfoLog(fragmentShader)}`);
			return this.gl.deleteShader(fragmentShader);
		}

		// Attach shaders and link "text" WebGL program:
		const program = this.gl.createProgram() as WebGLProgram;
		this.gl.attachShader(program, fragmentShader);
		this.gl.attachShader(program, vertexShader);
		this.gl.linkProgram(program);

		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS))
		{
			return console.error(`Unable to initialize shader program: ${this.gl.getProgramInfoLog(program)}`);
		}

		// Use "text" WebGL program:
		this.gl.useProgram(program);

		return program;
	}

	private getFontMetrics(size: number, lineGap = 0.0): Metrics
	{
		const { cap_height, x_height, ascent, descent, line_gap } = Roboto;

		// Uppercase characters use "cap_height" to fit to the pixels:
		const upScale = size / cap_height;

		// Set scale for lowercase characters so that height of character "x" fits the pixel grid.
		const lowScale = Math.round(x_height * upScale) / x_height;

		// Line height and ascent scale have to be integers since they're used to
		// calculate the baseline position which should lie at the pixel boundary:
		const lineHeight = Math.round((ascent + descent + line_gap) * upScale + lineGap);
		const ascentScale = Math.round(ascent * upScale);

		return {
			ascentScale,
			lineHeight,
			lowScale,
			upScale,
			size
		};
	}

	private createFontTexture(image: HTMLImageElement): void
	{
		// Create and bind font texture:
		const texture = this.gl.createTexture() as WebGLTexture;
		this.gl.activeTexture(this.gl.TEXTURE3);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0.0,
			this.gl.LUMINANCE,
			this.gl.LUMINANCE,
			this.gl.UNSIGNED_BYTE,
			image
		);

		// Set font texture rendering parameters:
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

		// Set font texture size uniform:
		this.gl.uniform2f(
			this.gl.getUniformLocation(this.program, 'textureSize'),
			image.width, image.height
		);
	}

	private createTextBufferData(): void
	{
		// Create and bind text position attributes:
		this.vertexBuffer = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);

		// "DYNAMIC_DRAW" is used here 'cause even if text won't change, `vertexData`
		// will be updated in the resize callback along with text position and font size:
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.vertexData, this.gl.DYNAMIC_DRAW);
	}

	private createTextUniforms(): void
	{
		// Set SDF text rendering and font texture uniforms:
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'subpixelRendering'), +this.subpixel);
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'hintAmount'), this.hintAmount);
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'borderSize'), Roboto.iy);
		this.gl.uniform4f(this.gl.getUniformLocation(this.program, 'color'), ...this.color);
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'fontTexture'), 3.0);
	}

	private createFramebuffer(): void
	{
		// Create, bind and scale framebuffer
		// texture according to canvas size:
		this.gl.activeTexture(this.gl.TEXTURE4);
		this.framebufferTexture = this.gl.createTexture();
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebufferTexture);

		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0.0,
			this.gl.RGBA,
			this.gl.canvas.width,
			this.gl.canvas.height,
			0.0,
			this.gl.RGBA,
			this.gl.UNSIGNED_BYTE,
			null
		);

		// Set framebuffer texture rendering parameters:
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

		// Create and bind a framebuffer and set its texture:
		this.framebuffer = this.gl.createFramebuffer();
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

		this.gl.framebufferTexture2D(
			this.gl.FRAMEBUFFER,
			this.gl.COLOR_ATTACHMENT0,
			this.gl.TEXTURE_2D,
			this.framebufferTexture,
			0.0
		);
	}

	private get hintAmount(): number
	{
		// Best hint amount for a black text is 1 and 0 for a white one, so:
		return 1.0 - (this.color[0] + this.color[1] + this.color[2]) / 3.0;
	}

	private setTextRectangle(
		position: [number, number],
		vertices: Float32Array,
		metrics: Metrics,
		text: string,
		first = true
	): void {
		const { lineHeight, upScale } = metrics;

		// Used to calculate kerning:
		let previousCharacter = ' ';

		// Current pen position:
		let penPosition = position;

		// Current vertex index:
		let arrayPosition = 0.0;

		// Current text character:
		let textPosition = 0.0;

		// Used for bounding box:
		let maxWidth = 0.0;

		while(true)
		{
			if (textPosition === text.length)
			{
				break;
			}

			// Glyph floats count: 2 triangles (6 vertices) * 5 floats per vertex = 30
			if (vertices.length <= arrayPosition + 30)
			{
				break;
			}

			// Get current text character:
			let character = text[textPosition++];

			if (character === '\n')
			{
				// Expand character's the bounding box:
				if (penPosition[0] > maxWidth)
				{
					maxWidth = penPosition[0];
				}

				penPosition[0] = position[0];
				penPosition[1] -= lineHeight;
				previousCharacter = ' ';
				continue;
			}

			if (character === ' ')
			{
				penPosition[0] += Roboto.space_advance * upScale;
				previousCharacter = ' ';
				continue;
			}

			// Replace unavailable characters with "?":
			let fontCharacter = Roboto.chars[character as Chars];

			if (!fontCharacter)
			{
				fontCharacter = Roboto.chars[ "?" ];
				character = "?";
			}

			// Calculate the glyph rectangle and copy it to the vertex array:
			const kern = (Roboto as Font).kern?.[previousCharacter + character];
			const rect = this.getCharacterRectangle(penPosition, metrics, fontCharacter, kern);

			for ( var i = 0; i < rect.vertices.length; i++)
			{
				vertices[arrayPosition++] = rect.vertices[i];
			}

			previousCharacter = character;
			penPosition = rect.position;
		}

		const [x, y] = position;
		const width = maxWidth - x;
		const height = y - penPosition[1] + lineHeight;

		// Set text bounding box and vertices count:
		this.rectangle = [x, y, width, height];
		this.vertices = arrayPosition / 5;

		// Center text on canvas:
		first && this.setTextRectangle(
			[penPosition[0] * -0.5, height * 0.5],
			this.vertexData,
			metrics,
			text,
			!!0
		);
	}

	private getCharacterRectangle(
		[x, y]: [number, number],
		metrics: Metrics,
		character: Char,
		kern = 0.0
	): {
		vertices: number[],
		position: [number, number]
	} {
		const { rect, bearing_x, advance_x } = character;
		const { lowScale, upScale, ascentScale } = metrics;

		// Lowercase characters have first bit set in "flags" and use their own scale:
		const scale = character.flags & 1 ? lowScale : upScale;
		const scaleRatio = Roboto.aspect * scale;

		// Calculate glyph rectangle bounding box and set its vertices:
		const b = (y - ascentScale) - (Roboto.descent + Roboto.iy) * scale;
		const l = (bearing_x + kern - Roboto.ix) * scaleRatio + x;

		const r = (rect[2] - rect[0]) * scaleRatio + l;
		const t = Roboto.row_height * scale + b;

		// Move pen position forward on X axis:
		x += (advance_x + kern) * scaleRatio;

		return {
			position: [x, y],
			vertices:
			[
				l, t, rect[0], rect[1], scale,
				r, t, rect[2], rect[1], scale,
				l, b, rect[0], rect[3], scale,

				l, b, rect[0], rect[3], scale,
				r, t, rect[2], rect[1], scale,
				r, b, rect[2], rect[3], scale
			]
		};
	}

	public update(): void
	{
		// Bind text framebuffer to draw onto it:
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

		// Clear framebuffer before drawing:
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		// Use "text" WebGL program:
		this.gl.useProgram(this.program);

		// Enable text position attributes, bind its buffer
		// and update a subset of buffer object's data store:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
		this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.vertexData);

		for (let a = 0; a < 3; a++)
		{
			this.gl.enableVertexAttribArray(a);
			this.gl.vertexAttribPointer(a, 1.0 + +(a < 2.0), this.gl.FLOAT, false, 20.0, a * 8.0);
		}

		// Update blending function and blend color for this program
		// (not required if `subpixel` is enabled and text color is white):
		/* if (this.subpixel)
		{
            // Subpixel antialiasing by Radek Dutkiewicz (https://github.com/oomek).
            // Text color goes to constant blend factor and triplet alpha comes from the shader output:
            this.gl.blendFunc(this.gl.CONSTANT_COLOR, this.gl.ONE_MINUS_SRC_COLOR);
            this.gl.blendColor(...this.color);
        }
		else
		{
            // Grayscale antialising:
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        } */

		// Draw text texture to the framebuffer:
        this.gl.drawArrays(this.gl.TRIANGLES, 0.0, this.vertices);

		// Unbind text framebuffer to render to screen:
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	}

	public resize(): void
	{
		// Set text font size to be 2 / 3 of the canvas width:
		const fontSize = Math.round(this.gl.canvas.width * 0.02 / 0.3);

		// Update text size and position:
		this.setTextRectangle(
			[0.0, 0.0],
			this.vertexData,
			this.getFontMetrics(fontSize),
			'WATER DISTORTION'
		);

		// Get new transform matrix for the vertex shader:
		const x = Math.round(this.rectangle[2] * -0.5);
        const y = Math.round(this.rectangle[3] * 0.5);

        const height = 2.0 / this.gl.canvas.height;
        const width = 2.0 / this.gl.canvas.width;

		this.transform[0] = width;
		this.transform[4] = height;
		this.transform[6] = x * width;
		this.transform[7] = y * height;

		// Switch to "text" program:
		this.gl.useProgram(this.program);

		// Update transform uniform:
		this.gl.uniformMatrix3fv(
			this.gl.getUniformLocation(this.program, 'transform'),
			false, this.transform
		);

		// Bind and scale framebuffer
		// texture according to canvas size:
		this.gl.activeTexture(this.gl.TEXTURE4);
		this.gl.bindTexture(this.gl.TEXTURE_2D, this.framebufferTexture);

		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0.0,
			this.gl.RGBA,
			this.gl.canvas.width,
			this.gl.canvas.height,
			0.0,
			this.gl.RGBA,
			this.gl.UNSIGNED_BYTE,
			null
		);
	}

	public dispose(): void
	{
	}
}
