import * as THREE from "three";

/**
 * Adapted from a golfed Shadertoy collab (-41 FabriceNeyret2, -13
 * GregRostami, -7 coyote): a raymarched reflective/spherically-inverted
 * voxel lattice — reflect across a slowly rotating axis, invert through a
 * sphere, snap to a voxel grid, then measure distance to a tiled thin-tube
 * pattern for the glow. As with other golfed entries, O/i/t rely on
 * uninitialized locals starting at zero (undefined but conventional on
 * Shadertoy) — made explicit here for portable behavior. Crossfaded
 * against the underlying scene via uMix.
 */
export const MirrorCageShader = {
  name: "MirrorCageShader",
  uniforms: {
    tDiffuse: { value: null },
    uMix: { value: 0 },
    uTime: { value: 0 },
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
    uniform vec2 uResolution;
    varying vec2 vUv;

    void mainImage(out vec4 O, vec2 I){
        vec3 p, V=vec3(3,2,0);
        float i=0.0,t=0.0,v,l;
        O = vec4(0.0);
        for(; i++<50.;
            O += exp(t-=v*l*.8)/v/(abs(sin(p.z*.5-uTime+vec4(0,.2,.4,0)))+.1))
            p = t*normalize(vec3(I+I,0)-uResolution.xyy),
            p.z -= .1,
            l = dot(p = reflect(p,normalize(sin(uTime*.05+V))),p),
            v = abs(length(1.-abs(mod(p = round(p/l*24.)/24.,4.).xy -2.)
                + .6*cos(p.z/V.xy))-.2)+.01;
        O = tanh(O/2e3);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 cage;
      mainImage(cage, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, cage.rgb, uMix), original.a);
    }
  `,
};
