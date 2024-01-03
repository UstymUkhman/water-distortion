import Distortion from '/distortion.png';
import Fragment from '@/main.frag';
import Vertex from '@/main.vert';
import Roboto from '/roboto.png';
import Ocean from '/ocean.jpg';
import Waves from '@/waves';
import Text from '@/text';

export default class
{
	private text!: Text;
	private raf!: number;
	private waves!: Waves;
	private moving = false;

	private movement?: NodeJS.Timeout;
	private positionLocation!: number;
	private positionData!: Float32Array;

	private readonly program: WebGLProgram;
	private readonly gl: WebGL2RenderingContext;
	private readonly mouse: [number, number] = [0, 0];
	private positionBuffer: WebGLBuffer | null = null;

	private readonly onUpdate = this.update.bind(this);
	private readonly onResize = this.resize.bind(this);
	private readonly onMove = this.mouseMove.bind(this);
	private readonly onTouch = this.touchMove.bind(this);

	public constructor(private readonly canvas: HTMLCanvasElement)
	{
		// Create WebGL2 context:
		this.gl = canvas.getContext('webgl2',
		{
			powerPreference: 'high-performance',
			failIfMajorPerformanceCaveat: true,
			preserveDrawingBuffer: false,
			premultipliedAlpha: false,
			desynchronized: false,
			xrCompatible: false,
			antialias: true,
			stencil: false,
			depth: false,
			alpha: true
		}) as WebGL2RenderingContext;

		// Create, compile and use "main" WebGL program:
		this.program = this.createProgram() as WebGLProgram;

		// Create event listeners to handle user events:
		canvas.addEventListener('touchmove', this.onTouch);
		canvas.addEventListener('mousemove', this.onMove);
		window.addEventListener('resize', this.onResize);

		// Load all required textures:
		this.loadImages().then(images =>
		{
			// Create background scene:
			this.createScene(images[0]);

			// Initialize distortion waves
			// to render onto a framebuffer:
			this.waves = new Waves(this.gl, images[1]);

			// Initialize text program
			// to render onto a framebuffer:
			this.text = new Text(this.gl, images[2]);

			// Update sizes, uniforms and
			// start rendering to screen:
			this.resize(); this.update();
		});
	}

	private createProgram(): WebGLProgram | void
	{
		// Create and compile "main" vertext shader:
		const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
		this.gl.shaderSource(vertexShader, Vertex);
		this.gl.compileShader(vertexShader);

		if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling vertex shader: ${this.gl.getShaderInfoLog(vertexShader)}`);
			return this.gl.deleteShader(vertexShader);
		}

		// Create and compile "main" fragment shader:
		const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
		this.gl.shaderSource(fragmentShader, Fragment);
		this.gl.compileShader(fragmentShader);

		if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS))
		{
			console.error(`An error occurred compiling fragment shader: ${this.gl.getShaderInfoLog(fragmentShader)}`);
			return this.gl.deleteShader(fragmentShader);
		}

		// Attach shaders and link "main" WebGL program:
		const program = this.gl.createProgram() as WebGLProgram;
		this.gl.attachShader(program, fragmentShader);
		this.gl.attachShader(program, vertexShader);
		this.gl.linkProgram(program);

		if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS))
		{
			return console.error(`Unable to initialize shader program: ${this.gl.getProgramInfoLog(program)}`);
		}

		// Enable WebGL blending:
		this.gl.enable(this.gl.BLEND);
		// Additive blending which respects plane
		// transparency to control the wave fade effect:
		this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

		// Flip uploaded textures pixels along Y-axis:
		// this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);
		// Moved to the fragment shader since it conflicts with text rendering.

		// Set canvas clear color (opaque black):
		this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

		// Use "main" WebGL program:
		this.gl.useProgram(program);

		return program;
	}

	private async loadImages(): Promise<HTMLImageElement[]>
	{
		return Promise.all<HTMLImageElement>(
		[
			// Background image:
			new Promise(resolve =>
			{
				const onLoad = () => resolve(image);
				const image = new Image();
				image.onload = onLoad;
				image.src = Ocean;
			}),

			// Distortion mask:
			new Promise(resolve =>
			{
				const onLoad = () => resolve(image);
				const image = new Image();
				image.src = Distortion;
				image.onload = onLoad;
			}),

			// Roboto font:
			new Promise(resolve =>
			{
				const onLoad = () => resolve(image);
				const image = new Image();
				image.onload = onLoad;
				image.src = Roboto;
			})
		]);
	}

	private createScene(image: HTMLImageElement): void
	{
		// Get position attribute and create its buffer and data for a background texture:
		this.positionLocation = this.gl.getAttribLocation(this.program, 'position');
		this.positionBuffer = this.gl.createBuffer();

		// Use sizes in pixels to draw triangles, position data
		// will be converted and normalized in vertex shader:
		this.positionData = new Float32Array([
			0.0              ,                0.0,
			this.canvas.width,                0.0,
			this.canvas.width, this.canvas.height,
			this.canvas.width, this.canvas.height,
			0.0              , this.canvas.height,
			0.0              ,                0.0
		]);

		// Create and bind background texture:
		const texture = this.gl.createTexture();
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

		this.gl.texImage2D(
			this.gl.TEXTURE_2D,
			0.0,
			this.gl.RGBA,
			this.gl.RGBA,
			this.gl.UNSIGNED_BYTE,
			image
		);

		// Set background texture rendering parameters:
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
		this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

		// Set "main" WebGL program uniforms:
		this.gl.uniform1f(this.gl.getUniformLocation(this.program, 'force'), 0.1);
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'ocean'), 0.0);
		this.gl.uniform1i(this.gl.getUniformLocation(this.program, 'waves'), 2.0);
		this.gl.uniform1i(this.gl.getUniformLocation(this.program,  'text'), 4.0);
	}

	private touchMove(event: TouchEvent): void
	{
		// Get canvas reference and touch coordinates:
		const canvas = this.gl.canvas as HTMLCanvasElement;

		const x = event.changedTouches[0].clientX;
		const y = event.changedTouches[0].clientY;

		// Get canvas bounding box:
		const top = canvas.offsetTop;
		const left = canvas.offsetLeft;

		const right = left + canvas.offsetWidth;
		const bottom = top + canvas.offsetHeight;

		// Check if touch coordinates are within
		// the canvas and trigger mouse move event:
		y > top && x > left && x < right && y < bottom &&
			this.mouseMove({ offsetX: x - left, offsetY: y - top });
	}

	private mouseMove(coords: { offsetX: number, offsetY: number }): void
	{
		// Start/continue mouse movement:
		this.moving = true;

		// Prevent stopping mouse movement:
		clearTimeout(this.movement);

		// Update mouse coordinates with device pixel ratio:
		this.mouse[0] = coords.offsetX * devicePixelRatio;
		this.mouse[1] = coords.offsetY * devicePixelRatio;

		// Stop mouse movement next frame:
		this.movement = setTimeout(() =>
			this.moving = false
		, 16.667);
	}

	private update(): void
	{
		// Update distortion waves framebuffer:
		this.waves.update(this.mouse, this.moving);

		// Draw text and check for alpha usage:
		/* const resetBlending = */ this.text.update();

		// Clear canvas before rendering on screen:
		this.gl.clear(this.gl.COLOR_BUFFER_BIT);

		// Use "main" WebGL program:
		this.gl.useProgram(this.program);

		// Enable canvas position attributes,
		// bind its buffer and update buffer data:
		this.gl.enableVertexAttribArray(this.positionLocation);
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, this.positionData, this.gl.STATIC_DRAW);
		this.gl.vertexAttribPointer(this.positionLocation, 2.0, this.gl.FLOAT, false, 0.0, 0.0);

		// Reset to additive blending with plane transparency
		// if a different one was used in "text" program:
		/* if (resetBlending)
		{
			// Reset blending function and blend color:
			this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
			const clearColor = this.gl.getParameter(this.gl.COLOR_CLEAR_VALUE);
			this.gl.blendColor(clearColor[0], clearColor[1], clearColor[2], clearColor[3]);
		} */

		// Render canvas to screen by drawing its triangles:
		this.gl.drawArrays(this.gl.TRIANGLES, 0.0, 6.0);

		// Request next rendering frame:
		this.raf = requestAnimationFrame(this.onUpdate);
	}

	private resize(): void
	{
		// Define canvas size based on screen width (in portrait mode) or
		// screen height (in landscape mode) and 16 / 9 aspect ratio:
		let height: number, width: number, dpr = devicePixelRatio;

		if (innerWidth / 16.0 * 9.0 < innerHeight)
		{
			width = Math.min(innerWidth * 0.9, 1600.0) | 0;
			height = width / 16.0 * 9.0 | 0;
		}
		else
		{
			height = Math.min(innerHeight * 0.9, 900.0) | 0;
			width = height / 9.0 * 16.0 | 0;
		}

		// Correct the canvas size, including the device pixel ratio:
		this.canvas.width = Math.round(width * dpr * 0.5) * 2.0;
        this.canvas.height = Math.round(height * dpr * 0.5) * 2.0;

        this.canvas.style.height = `${this.canvas.height / dpr}px`;
		this.canvas.style.width  = `${this.canvas.width / dpr}px`;

		// Update position attribute data:
		this.positionData[2] = this.canvas.width;
		this.positionData[4] = this.canvas.width;
		this.positionData[6] = this.canvas.width;

		this.positionData[5] = this.canvas.height;
		this.positionData[7] = this.canvas.height;
		this.positionData[9] = this.canvas.height;

		// Resize text:
		this.text.resize();

		// Resize waves:
		this.waves.resize();

		// Use "main" WebGL program:
		this.gl.useProgram(this.program);

		// Update canvas viewport with updated width and height:
		this.gl.viewport(0.0, 0.0, this.canvas.width, this.canvas.height);

		// Update size uniform:
		this.gl.uniform2f(
			this.gl.getUniformLocation(this.program, 'size'),
			this.canvas.width, this.canvas.height
		);
	}

	public dispose(): void
	{
		// Get canvas reference from WebGL context:
		const canvas = this.gl.canvas as HTMLCanvasElement;

		// Remove event listeners used to handle user events:
		canvas.removeEventListener('touchmove', this.onTouch);
		canvas.removeEventListener('mousemove', this.onMove);
		window.removeEventListener('resize', this.onResize);

		// Cancel next rendering frame:
		cancelAnimationFrame(this.raf);

		// Clean-up distortion waves:
		this.waves.dispose();

		// Clean-up text program:
		this.text.dispose();

		// Unbind background texture:
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, null);

		// Bind an "empty" position buffer to clear its data:
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, 0, this.gl.STATIC_DRAW);

		// Delete position buffer and "main" WebGL program:
		this.gl.deleteBuffer(this.positionBuffer);
		this.gl.deleteProgram(this.program);

		// Empty buffer commands and block execution until
		// all previously called commands are finished:
		this.gl.flush(); this.gl.finish();

		// Simulate losing this WebGL2 context:
		this.gl.getExtension('WEBGL_lose_context')?.loseContext();

		// Remove position buffer reference:
		this.positionBuffer = null;

		// Stop and reset mouse movement:
		clearTimeout(this.movement);
		this.moving = false;
		this.mouse.fill(0);

		// Remove canvas from DOM:
		canvas.remove();
	}
}
