uniform float hintAmount;

float RDOffset(
	in float horizontalScale,
	in float verticalScale,
	in float verticalGradient
) {
	return mix(
		sdfOffset,
		mix(
			sdfOffset * horizontalScale,
			sdfOffset * verticalScale,
			verticalGradient
		),
		hintAmount
	);
}

vec3 SDFAlpha(
	in vec3 sdf,
	in float horizontalScale,
	in float verticalScale,
	in float verticalGradient
) {
    float offset = RDOffset(horizontalScale, verticalScale, verticalGradient);

    return pow(
		smoothstep(vec3(0.5 - offset), vec3(0.5 + offset), sdf),
		vec3(1.0 + 0.2 * verticalGradient * hintAmount)
	);
}

float SDFAlpha(
	in float sdf,
	in float horizontalScale,
	in float verticalScale,
	in float verticalGradient
) {
    float offset = RDOffset(horizontalScale, verticalScale, verticalGradient);

    return pow(
		smoothstep(0.5 - offset, 0.5 + offset, sdf),
		1.0 + 0.2 * verticalGradient * hintAmount
	);
}
