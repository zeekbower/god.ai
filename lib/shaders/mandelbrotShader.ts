import * as THREE from "three";

/**
 * Adapted from "Mandelbrot Smooth" by Inigo Quilez (2013),
 * https://www.shadertoy.com/view/lsX3W4: a classic animated zoom/rotate
 * into the Mandelbrot set with cardioid/bulb early-exit checks, smooth
 * iteration-count coloring that pulses between banded and smooth shading,
 * and 2x2 supersampling. Ported verbatim (only iTime/iResolution renamed)
 * to a screen-space ShaderPass, crossfaded against the underlying scene via
 * uMix.
 */
export const MandelbrotShader = {
  name: "MandelbrotShader",
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

    #define AA 2

    float mandelbrot( in vec2 c )
    {
        float c2 = dot(c, c);
        if( 256.0*c2*c2 - 96.0*c2 + 32.0*c.x - 3.0 < 0.0 ) return 0.0;
        if( 16.0*(c2+2.0*c.x+1.0) - 1.0 < 0.0 ) return 0.0;

        const float B = 256.0;
        float n = 0.0;
        vec2 z  = vec2(0.0);
        for( int i=0; i<512; i++ )
        {
            z = vec2( z.x*z.x-z.y*z.y, 2.0*z.x*z.y ) + c;
            if( dot(z,z)>(B*B) ) break;
            n += 1.0;
        }

        if( n>511.0 ) return 0.0;

        float sn = n - log2(log2(dot(z,z))) + 4.0;

        float al = smoothstep( -0.1, 0.0, sin(3.1415927*uTime ) );
        return mix( n, sn, al );
    }

    void mainImage( out vec4 fragColor, in vec2 fragCoord )
    {
        vec3 col = vec3(0.0);

        for( int m=0; m<AA; m++ )
        for( int n=0; n<AA; n++ )
        {
            vec2 p = (2.0*(fragCoord+vec2(float(m),float(n))/float(AA))-uResolution.xy)/uResolution.y;
            float w = float(AA*m+n);
            float time = uTime + 0.5*(1.0/24.0)*w/float(AA*AA);

            float  ani = 0.62 + 0.38*cos(0.07*time);
            float  zoo = pow(ani,8.0);
            float  ang = 0.15*(1.0-ani)*time;
            float   co = cos(ang);
            float   si = sin(ang);
            mat2x2 rot = mat2x2(co,si,-si,co);
            vec2 c = vec2(-0.745,0.186) + zoo*rot*p;

            float sn = mandelbrot(c);

            if( sn>0.0 )
            {
              float nor = 1.0+log2(1.0/zoo);
              col += 0.5+0.5*cos(0.2*sn/nor+vec3(2.7,3.2,3.7));
            }
        }
        col /= float(AA*AA);

        fragColor = vec4( col, 1.0 );
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 mb;
      mainImage(mb, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, mb.rgb, uMix), original.a);
    }
  `,
};
