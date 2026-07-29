import * as THREE from "three";

/**
 * Adapted from a golfed Shadertoy fractal by @Frostbyte (golfed further by
 * Diatribes, https://fragcoord.xyz/s/fg2f9rre): a raymarched box-fold
 * tunnel with a rotating fractal fold driven by depth and time. As with
 * other golfed Shadertoy entries, the original relies on O/i/z being
 * implicitly zero-initialized as uninitialized locals (an undefined but
 * widely-relied-upon Shadertoy convention) — made explicit here for
 * portable, deterministic behavior. Crossfaded against the underlying
 * scene via uMix.
 */
export const FoldTunnelShader = {
  name: "FoldTunnelShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uSpin: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uMix;
    uniform float uTime;
    uniform float uSpin;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // No native camera-orbit angle in this shader (the tunnel is a straight
    // flythrough) — spin instead rolls the view around the tunnel's forward
    // axis, like turning your head while flying through it.
    vec2 spinRotate(vec2 p, float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c) * p;
    }

    void mainImage(out vec4 O, vec2 C) {
        float i = 0.0, d, z = 0.0;
        vec3 p, r = vec3(uResolution, 1.0);
        C.xy = spinRotate(C.xy - .5*r.xy, uSpin) + .5*r.xy;
        O = vec4(0.0);
        for(; i++<1e2; O+=1./d){
            p=z*normalize(vec3(C.xy-.5*r.xy,r.y));
            p=abs(fract(vec3(mat2(cos(cos(z*.5)+vec4(0,11,33,0)))*p.xy*2.,p.z-uTime))-.5)-.5;
            z+=(d=abs(length(max(p,.25))+max(p.x,max(p.y,p.z*3.)))/3.+abs(sin(z*.7-uTime))*.001)*.8;
        }
        O*=vec4(p+.8,0)*z/7e4;
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 tunnel;
      mainImage(tunnel, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, tunnel.rgb, uMix), original.a);
    }
  `,
};
