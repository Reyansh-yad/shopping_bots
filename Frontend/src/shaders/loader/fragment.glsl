uniform sampler2D uDisplacement;
uniform sampler2D uVideoTexture;
uniform float uOffset;

varying vec2 vUv;

void main()
{
    vec4 displacementTexture = texture2D(uDisplacement,vUv);
    float displacementForce = (displacementTexture.r - 0.5) * uOffset * 0.3;
    vec2 uvDisplaced = vec2(vUv.x - displacementForce, vUv.y - displacementForce);
    vec4 videoTexture = texture2D(uVideoTexture,uvDisplaced);

    gl_FragColor = vec4(videoTexture.rgb,1.0 - uOffset);
}