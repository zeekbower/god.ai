import * as THREE from "three";

/**
 * Adapted from Shadertoy "Mandala" by Noztol (https://www.shadertoy.com/view/7fG3Rw):
 * a radially-folded (12-petal) glowing fractal mandala rendered inside a
 * traced polygon silhouette, with a separate warped-wave pattern rendered
 * outside it. Ported from mainImage's fragCoord/iTime/iResolution convention
 * to a screen-space ShaderPass, crossfaded against the underlying scene via
 * uMix instead of being drawn fully opaque.
 */
export const MandalaShader = {
  name: "MandalaShader",
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
    #define PI 3.14159265359

    uniform sampler2D tDiffuse;
    uniform float uMix;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    vec3 palette(in float t) {
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.263, 0.416, 0.557);
      return a + b * cos(6.28318 * (c * t + d));
    }

    void renderInterior(out vec4 fragColor, in vec2 fragCoord) {
      vec2 uv = (fragCoord * 2.0 - uResolution.xy) / uResolution.y;

      float time = uTime * 0.15;
      mat2 globalRot = mat2(cos(time), -sin(time), sin(time), cos(time));
      uv *= globalRot;

      float petals = 12.0;
      float angle = atan(uv.y, uv.x);
      float radius = length(uv);

      float sector = 2.0 * PI / petals;
      angle = mod(angle, sector);
      angle = abs(angle - sector / 2.0);

      uv = radius * vec2(cos(angle), sin(angle));

      vec3 finalColor = vec3(0.0);
      mat2 fractalRot = mat2(cos(time), -sin(time), sin(time), cos(time));

      for (float i = 0.0; i < 4.0; i++) {
        uv = abs(uv) - 0.25;
        uv *= fractalRot;
        uv *= 1.2;

        float d = length(uv);
        vec3 col = palette(length(uv) + uTime * 0.4 + i * 0.15);

        d = sin(d * 12.0 + uTime) / 12.0;
        d = abs(d);
        d = 0.01 / d;
        d = pow(d, 1.2);

        finalColor += col * d;
      }

      fragColor = vec4(finalColor, 1.0);
    }

    vec3 getWaveExterior(vec2 fragCoord, vec2 uv, float d, vec3 baseColor) {
      vec2 warpUV = uv * 1.5;
      float turbulence = 2.5;
      float amplitude = 1.5;

      for (int i = 0; i < 4; i++) {
        float newX = warpUV.x + sin(warpUV.y * 2.0 + uTime * 0.7) * 0.3;
        float newY = warpUV.y + cos(warpUV.x * 2.0 + uTime * 0.5) * 0.3;
        warpUV = vec2(newX, newY);
        turbulence += sin(warpUV.x + warpUV.y) * amplitude;
        warpUV *= 3.5;
        amplitude *= 1.6;
      }

      float distortionStrength = 0.12;
      float warpedD = d + (turbulence * d * distortionStrength);

      float rippleFreq = 1.0;
      float rippleSpeed = 0.6;
      float fadeFalloff = 4.0;

      float wavePhase = warpedD * rippleFreq - uTime * rippleSpeed;
      float wave = abs(fract(wavePhase) - 0.5) * 2.0;

      float blurAmount = max(0.0, d * 1.5);
      float edgeSharpness = max(0.0, 1.01 - blurAmount);
      float outlines = smoothstep(edgeSharpness, 1.0, wave);

      float fade = exp(-max(0.0, d) * fadeFalloff);

      vec2 screenUV = fragCoord / uResolution.xy;
      float edgeFade = smoothstep(0.0, 0.1, screenUV.x) * smoothstep(1.0, 0.9, screenUV.x) *
                       smoothstep(0.0, 0.1, screenUV.y) * smoothstep(1.0, 0.9, screenUV.y);

      float echoes = outlines * fade * step(0.0, d) * edgeFade;

      vec3 bgColor = vec3(0.02, 0.02, 0.05);
      vec3 waveTint = mix(vec3(0.2, 0.6, 1.0), baseColor, 0.6);

      return bgColor + (waveTint * echoes * 1.5);
    }

    const int NUM_POLYS = 1;
    const int N = 200;

    vec2 poly0[N] = vec2[](
      vec2(0.82095, -0.77311), vec2(0.81036, -0.72884), vec2(0.79880, -0.69946), vec2(0.78454, -0.67772),
      vec2(0.76585, -0.65642), vec2(0.74283, -0.63200), vec2(0.72143, -0.61426), vec2(0.69168, -0.59656),
      vec2(0.65682, -0.57698), vec2(0.63039, -0.56359), vec2(0.59026, -0.54629), vec2(0.56799, -0.53514),
      vec2(0.53588, -0.52115), vec2(0.49921, -0.49962), vec2(0.47285, -0.47612), vec2(0.45567, -0.45202),
      vec2(0.44654, -0.42867), vec2(0.44395, -0.39552), vec2(0.44827, -0.35060), vec2(0.45898, -0.32276),
      vec2(0.47312, -0.30311), vec2(0.48771, -0.28273), vec2(0.50052, -0.25083), vec2(0.50302, -0.22330),
      vec2(0.49779, -0.17192), vec2(0.49376, -0.15425), vec2(0.48741, -0.13021), vec2(0.48200, -0.10236),
      vec2(0.47589, -0.07277), vec2(0.46747, -0.03427), vec2(0.45794, 0.00638), vec2(0.44849, 0.04245),
      vec2(0.44023, 0.06727), vec2(0.43016, 0.09554), vec2(0.42369, 0.11918), vec2(0.41507, 0.14376),
      vec2(0.39859, 0.17482), vec2(0.37242, 0.21276), vec2(0.35885, 0.23087), vec2(0.33707, 0.25586),
      vec2(0.30719, 0.28239), vec2(0.26804, 0.30616), vec2(0.22703, 0.32255), vec2(0.18863, 0.33231),
      vec2(0.15383, 0.33842), vec2(0.12360, 0.34383), vec2(0.09892, 0.35149), vec2(0.08077, 0.36437),
      vec2(0.06963, 0.38687), vec2(0.08305, 0.42029), vec2(0.08939, 0.40769), vec2(0.10779, 0.38544),
      vec2(0.12007, 0.40825), vec2(0.12605, 0.44270), vec2(0.13680, 0.47507), vec2(0.14712, 0.50209),
      vec2(0.15777, 0.53957), vec2(0.16271, 0.57506), vec2(0.16168, 0.60570), vec2(0.16980, 0.64284),
      vec2(0.17241, 0.67053), vec2(0.16853, 0.69663), vec2(0.15561, 0.73556), vec2(0.13666, 0.76745),
      vec2(0.11839, 0.78389), vec2(0.09133, 0.80177), vec2(0.07420, 0.83220), vec2(0.05342, 0.85270),
      vec2(0.03605, 0.87888), vec2(0.03340, 0.90774), vec2(0.02664, 0.93483), vec2(0.01325, 0.97197),
      vec2(0.00015, 1.00000), vec2(-0.02478, 0.98048), vec2(-0.04364, 0.95621), vec2(-0.05458, 0.92883),
      vec2(-0.06845, 0.90166), vec2(-0.08157, 0.87168), vec2(-0.10163, 0.83879), vec2(-0.11526, 0.81361),
      vec2(-0.13745, 0.79973), vec2(-0.17164, 0.77211), vec2(-0.19106, 0.74706), vec2(-0.20423, 0.71919),
      vec2(-0.21203, 0.68867), vec2(-0.21532, 0.65564), vec2(-0.21497, 0.62027), vec2(-0.21952, 0.59346),
      vec2(-0.22399, 0.56355), vec2(-0.21243, 0.52519), vec2(-0.20380, 0.49100), vec2(-0.19226, 0.46919),
      vec2(-0.17969, 0.44019), vec2(-0.17323, 0.39650), vec2(-0.17032, 0.36613), vec2(-0.14867, 0.38959),
      vec2(-0.13207, 0.40347), vec2(-0.13456, 0.37209), vec2(-0.15756, 0.33856), vec2(-0.18485, 0.32480),
      vec2(-0.20715, 0.31969), vec2(-0.24107, 0.30893), vec2(-0.27870, 0.29643), vec2(-0.30421, 0.28843),
      vec2(-0.33682, 0.27491), vec2(-0.36415, 0.26310), vec2(-0.39007, 0.24206), vec2(-0.41205, 0.21502),
      vec2(-0.42834, 0.18983), vec2(-0.44061, 0.16895), vec2(-0.45115, 0.12511), vec2(-0.45751, 0.08709),
      vec2(-0.46235, 0.04794), vec2(-0.46588, 0.00832), vec2(-0.46830, -0.03115), vec2(-0.46982, -0.06982),
      vec2(-0.47064, -0.10704), vec2(-0.47097, -0.14218), vec2(-0.47100, -0.17461), vec2(-0.47096, -0.20367),
      vec2(-0.47103, -0.22873), vec2(-0.47143, -0.24914), vec2(-0.47241, -0.26470), vec2(-0.47475, -0.27850),
      vec2(-0.47925, -0.28753), vec2(-0.48768, -0.29809), vec2(-0.50178, -0.31648), vec2(-0.52333, -0.34902),
      vec2(-0.55408, -0.40201), vec2(-0.58882, -0.46808), vec2(-0.59857, -0.49213), vec2(-0.60888, -0.52663),
      vec2(-0.62758, -0.55256), vec2(-0.65604, -0.56800), vec2(-0.68549, -0.58574), vec2(-0.71388, -0.60280),
      vec2(-0.74025, -0.62082), vec2(-0.76366, -0.64141), vec2(-0.78317, -0.66622), vec2(-0.79784, -0.69686),
      vec2(-0.81122, -0.73366), vec2(-0.81990, -0.76009), vec2(-0.82130, -0.79122), vec2(-0.81671, -0.82572),
      vec2(-0.80731, -0.85391), vec2(-0.78892, -0.88736), vec2(-0.76829, -0.91422), vec2(-0.74593, -0.93174),
      vec2(-0.71796, -0.94526), vec2(-0.68691, -0.96019), vec2(-0.65912, -0.97746), vec2(-0.63373, -0.98145),
      vec2(-0.60136, -0.97107), vec2(-0.56804, -0.96907), vec2(-0.53952, -0.97433), vec2(-0.50903, -0.98195),
      vec2(-0.47609, -0.98801), vec2(-0.44017, -0.98860), vec2(-0.40165, -0.98014), vec2(-0.37449, -0.97125),
      vec2(-0.34465, -0.97712), vec2(-0.31469, -0.99155), vec2(-0.28168, -0.99872), vec2(-0.24483, -1.00000),
      vec2(-0.20316, -0.98940), vec2(-0.17777, -0.97720), vec2(-0.15071, -0.98083), vec2(-0.11775, -0.98000),
      vec2(-0.08624, -0.96676), vec2(-0.05683, -0.95192), vec2(-0.02834, -0.94657), vec2(0.00217, -0.96376),
      vec2(0.03497, -0.97548), vec2(0.06529, -0.97905), vec2(0.10228, -0.96665), vec2(0.12801, -0.95936),
      vec2(0.14884, -0.96562), vec2(0.18015, -0.97630), vec2(0.21911, -0.98163), vec2(0.25768, -0.97407),
      vec2(0.28645, -0.96527), vec2(0.31153, -0.96733), vec2(0.34320, -0.97743), vec2(0.39095, -0.98732),
      vec2(0.42876, -0.98583), vec2(0.45562, -0.97925), vec2(0.47861, -0.97373), vec2(0.49935, -0.96901),
      vec2(0.52079, -0.96912), vec2(0.54776, -0.97126), vec2(0.57909, -0.97348), vec2(0.61358, -0.97382),
      vec2(0.65006, -0.97029), vec2(0.68734, -0.96095), vec2(0.72424, -0.94383), vec2(0.75854, -0.91796),
      vec2(0.77746, -0.90146), vec2(0.79572, -0.87825), vec2(0.81337, -0.83782), vec2(0.82130, -0.80560)
    );

    vec2 getPoint(int polyIdx, int ptIdx) {
      if (polyIdx == 0) return poly0[ptIdx];
      return poly0[ptIdx];
    }

    vec2 getMorphedPoint(int idx, float t, int polyA, int polyB) {
      vec2 pA = getPoint(polyA, idx);
      vec2 pB = getPoint(polyB, idx);

      float rA = length(pA), aA = atan(pA.y, pA.x);
      float rB = length(pB), aB = atan(pB.y, pB.x);

      if (abs(aA - aB) > 3.1415926) {
        if (aA < aB) aA += 6.2831853;
        else aB += 6.2831853;
      }

      float aM = mix(aA, aB, t);
      return vec2(cos(aM), sin(aM)) * mix(rA, rB, t);
    }

    float sdMorphedPolygon(vec2 p, float t, int polyA, int polyB) {
      vec2 q = abs(p) - vec2(1.05, 1.05);
      float dBox = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);

      bool isGlowZone = dBox > 0.1;
      int stride = isGlowZone ? 10 : 1;

      vec2 v_j = getMorphedPoint(N - 1, t, polyA, polyB);
      float d = dot(p - v_j, p - v_j);
      float s = 1.0;

      for (int i = 0; i < N; i += stride) {
        vec2 v_i = getMorphedPoint(i, t, polyA, polyB);

        vec2 e = v_j - v_i;
        vec2 w = p - v_i;
        vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
        d = min(d, dot(b, b));

        if (!isGlowZone) {
          bvec3 c = bvec3(p.y >= v_i.y, p.y < v_j.y, e.x * w.y > e.y * w.x);
          if (all(c) || all(not(c))) s *= -1.0;
        }
        v_j = v_i;
      }
      return s * sqrt(d);
    }

    void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);
      uv *= 1.1;

      float speed = 0.5;
      float globalT = uTime * speed;
      int polyA = int(mod(globalT, float(NUM_POLYS)));
      int polyB = int(mod(globalT + 1.0, float(NUM_POLYS)));
      float localT = smoothstep(0.1, 0.9, fract(globalT));

      float d = sdMorphedPolygon(uv, localT, polyA, polyB);

      vec4 colIn = vec4(0.0);
      renderInterior(colIn, fragCoord);

      vec4 colOut = vec4(getWaveExterior(fragCoord, uv, d, colIn.rgb), 1.0);

      float aaThreshold = 2.0 / min(uResolution.x, uResolution.y);
      float isOutside = smoothstep(0.0, aaThreshold * 2.0, d);

      vec3 col = mix(colIn.rgb, colOut.rgb, isOutside);
      col = mix(col, vec3(1.0), smoothstep(aaThreshold, 0.0, abs(d)));

      fragColor = vec4(col, 1.0);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.0001) {
        gl_FragColor = original;
        return;
      }

      vec4 mandala;
      mainImage(mandala, vUv * uResolution);

      gl_FragColor = vec4(mix(original.rgb, mandala.rgb, uMix), original.a);
    }
  `,
};
