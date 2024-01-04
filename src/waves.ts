import Fragment from "@/wave.frag";
import Vertex from "@/wave.vert";

// 360 angle in radians:
const TAU = Math.PI * 2.0;

export default class Waves
{
	private current = 0;

	private readonly size = 128;
	private readonly amount = 64;

	// Wave planes initialization:
	private readonly planes = Array
		.from({ length: this.amount })
		.map(() => ({
			rotation: Math.random() * TAU,
			translation: [0.0, 0.0],
			scale: 0.256,
			alpha: 0.002
		}));

	private positionLocation!: number;
	private positionData!: Float32Array;
	private readonly program: WebGLProgram;

	private positionBuffer: WebGLBuffer | null = null;
	private framebuffer: WebGLFramebuffer | null = null;
	private framebufferTexture: WebGLTexture | null = null;

	private translation: WebGLUniformLocation | null = null;
	private rotation: WebGLUniformLocation | null = null;
	private scale: WebGLUniformLocation | null = null;
	private alpha: WebGLUniformLocation | null = null;

	public constructor(
		private readonly gl: WebGL2RenderingContext,
		image: HTMLImageElement
	) {
		// Create, compile and use "wave" WebGL program:
		if (this.program = this.createProgram() as WebGLProgram)
		{
			// Create a plane mask object:
			this.createWavePlane(image);

			// Create waves framebuffer:
			this.createFramebuffer();
		}
	}

	private createProgram(): WebGLProgram | void
	{
		// Create and compile "wave" vertext shader:
		const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
		this.gl.shaderSource(vertexShader, Vertex);
		this.gl.compileShader(vertexShader);

		if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling vertex shader: ${this.gl.getShaderInfoLog(vertexShader)}`);
			return this.gl.deleteShader(vertexShader);
		}

		// Create and compile "wave" fragment shader:
		const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
		this.gl.shaderSource(fragmentShader, Fragment);
		this.gl.compileShader(fragmentShader);

		if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling fragment shader: ${this.gl.getShaderInfoLog(fragmentShader)}`);
			return this.gl.deleteShader(fragmentShader);
		}

		// Attach shaders and link "wave" WebGL program:
		const program = this.gl.createProgram() as WebGLProgram;
		this.gl.attachShader(program, fragmentShader);
		this.gl.attachShader(program, vertexShader);
		this.gl.linkProgram(program);

		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS))
		{
			return console.error(`Unable to initialize shader program: ${this.gl.getProgramInfoLog(program)}`);
		}

		// Use "wave" WebGL program:
		this.gl.useProgram(program);

		return program;
	}

	private createWavePlane(image: HTMLImageElement): void
	{
		// Cache "wave" WebGL program's uniforms:
		this.alpha = this.gl.getUniformLocation(this.program, "alpha");
		this.scale = this.gl.getUniformLocation(this.program, "scale");

		this.rotation = this.gl.getUniformLocation(this.program, "rotation");
		this.translation = this.gl.getUniformLocation(this.program, "translation");

		// Get position attribute and create its buffer and data for a plane object:
		this.positionLocation = this.gl.getAttribLocation(this.program, "position");
		this.positionBuffer = this.gl.createBuffer();

		const offset = this.size * -0.5;
		const size = this.size * 0.5;

		// Use sizes in pixels to draw triangles, position data
		// will be converted and normalized in vertex shader.
		// By using negative coordinates, the rotation pivot
		// of the plane will correspond to its center:
		this.positionData = new Float32Array([
			offset, offset,
			size  , offset,
			size  ,   size,
			size  ,   size,
			offset,   size,
			offset, offset
		]);

		// Create and bind distortion texture:
		const texture = this.gl.createTexture();
		this.gl.activeTexture(this.gl.TEXTURE1);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0.0,
			this.gl.RGBA,
			this.gl.RGBA,
			this.gl.UNSIGNED_BYTE,
			image
		);

		// Set distortion texture rendering parameters:
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

		// Set "wave" WebGL program uniforms:
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, "distortion"), 1.0);
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, "planeSize"), size);

		this.gl.uniform1f(this.scale, 0.256);
		this.gl.uniform1f(this.alpha, 0.002);
	}

	private createFramebuffer(): void
	{
		// Create, bind and scale framebuffer
		// texture according to canvas size:
		this.gl.activeTexture(this.gl.TEXTURE2);
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

	public update(position: [number, number], moving: boolean): void
	{
		// Bind distortion framebuffer to draw onto it:
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

		// Clear framebuffer before drawing:
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		// Use "wave" WebGL program:
		this.gl.useProgram(this.program);

		// Enable plane position attributes,
		// bind its buffer and update buffer data:
		this.gl.enableVertexAttribArray(this.positionLocation);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positionData, this.gl.STATIC_DRAW);
		this.gl.vertexAttribPointer(this.positionLocation, 2.0, this.gl.FLOAT, false, 0.0, 0.0);

		if (moving)
		{
			// Get current plane and reset its properties:
			this.current = (this.current + 1) % this.amount;
			const plane = this.planes[this.current];

			plane.rotation = Math.random() * TAU;
			plane.scale = 0.256;
			plane.alpha = 0.192;
		}

		for (let p = 0; p < this.amount; p++)
		{
			// Cache this plane:
			const plane = this.planes[p];

			// Skip rendering if it's not visible:
			if (plane.alpha === 0.002)
			{
				continue;
			}

			// Update position only of the current plane:
			if (this.current === p)
			{
				plane.translation[0] = position[0];
				plane.translation[1] = position[1];
			}

			// Update other plane properties:
			plane.rotation = plane.rotation + 0.02;
			plane.scale = plane.scale * 0.982 + 0.108;
			plane.alpha = Math.max(plane.alpha * 0.96, 0.002);

			// Update "wave" WebGL program uniforms:
			this.gl.uniform2fv(this.translation, plane.translation);
			this.gl.uniform1f(this.rotation, plane.rotation);
			this.gl.uniform1f(this.scale, plane.scale);
			this.gl.uniform1f(this.alpha, plane.alpha);

			// Draw this plane to the framebuffer:
			this.gl.drawArrays(this.gl.TRIANGLES, 0.0, 6.0);
		}

		// Unbind distortion framebuffer to render to screen:
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
	}

	public resize(): void
	{
		// Switch to "wave" program:
		this.gl.useProgram(this.program);

		// Update size uniform:
		this.gl.uniform2f(
			this.gl.getUniformLocation(this.program, "canvasSize"),
			this.gl.canvas.width, this.gl.canvas.height
		);

		// Bind and scale framebuffer
		// texture according to canvas size:
		this.gl.activeTexture(this.gl.TEXTURE2);
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
		// Remove all planes:
		this.planes.length = 0;

		// Unbind distortion texture:
		this.gl.activeTexture(this.gl.TEXTURE1);
		this.gl.bindTexture(this.gl.TEXTURE_2D, null);

		// Unbind framebuffer texture:
		this.gl.activeTexture(this.gl.TEXTURE2);
		this.gl.bindTexture(this.gl.TEXTURE_2D, null);

		// Bind an "empty" position buffer to clear its data:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, 0, this.gl.STATIC_DRAW);

		// Bind distortion framebuffer with no texture to clear it:
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

		this.gl.framebufferTexture2D(
			this.gl.FRAMEBUFFER,
			this.gl.COLOR_ATTACHMENT0,
			this.gl.TEXTURE_2D,
			null,
			0.0
		);

		// Unbind buffers:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

		// Delete framebuffer and its texture:
		this.gl.deleteFramebuffer(this.framebuffer);
		this.gl.deleteTexture(this.framebufferTexture);

		// Delete position buffer and "wave" WebGL program:
		this.gl.deleteBuffer(this.positionBuffer);
		this.gl.deleteProgram(this.program);

		// Remove all references:
		this.framebufferTexture = null;
		this.positionBuffer = null;
		this.framebuffer = null;
		this.translation = null;
		this.rotation = null;
		this.scale = null;
		this.alpha = null;
	}
}
