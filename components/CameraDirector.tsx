"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { wander } from "@/lib/wander";

const BASE_SPIN_SPEED = 0.05; // rad/sec magnitude the horizontal spin settles back to when idle
const SPIN_DECAY_TIME = 4; // seconds for a flick's momentum to settle back to baseline
const MAX_FLICK_SPEED = 3; // rad/sec cap, so a fast drag can't send it spinning absurdly
const VERTICAL_DECAY_TIME = 2.5; // seconds for a vertical flick's momentum to fade out
const WANDER_FRACTION = 0.2; // vertical wander bound: +/-20% of the starting polar angle
const WANDER_SEED = 7.31;

/**
 * Drives the camera's idle auto-orbit:
 *  - Horizontal: after a drag, the spin continues at (and can reverse with)
 *    the velocity of that last drag, then eases back to the baseline speed —
 *    settling into a positive (rightward) or negative (leftward) rest speed
 *    depending on which direction the last drag went.
 *  - Vertical: has no continuous "normal spin" of its own — its normal state
 *    is a gentle wander within +/-20% of wherever it started. A vertical drag
 *    also gets velocity/momentum, which fades out and eases the camera back
 *    onto that wander curve instead of snapping.
 * Only active while the user isn't actively dragging — OrbitControls owns
 * the camera during a drag.
 */
export default function CameraDirector({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  const spinSpeed = useRef(BASE_SPIN_SPEED);
  const verticalSpeed = useRef(0);
  const verticalDrift = useRef(0); // current deviation from the pure wander curve

  const isDragging = useRef(false);
  const lastTheta = useRef(0);
  const lastPhi = useRef(0);
  const lastSampleTime = useRef(0);
  const basePhi = useRef<number | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    basePhi.current = controls.getPolarAngle();
    lastTheta.current = controls.getAzimuthalAngle();
    lastPhi.current = basePhi.current;
    lastSampleTime.current = performance.now() / 1000;

    const handleStart = () => {
      isDragging.current = true;
    };
    const handleEnd = () => {
      isDragging.current = false;
      if (basePhi.current === null) return;
      // Seed the drift offset so vertical motion continues from exactly where the
      // user let go, instead of snapping onto the wander curve's current value.
      const wanderPhiNow = basePhi.current + wander(performance.now() / 1000, WANDER_SEED) * (basePhi.current * WANDER_FRACTION);
      verticalDrift.current = controls.getPolarAngle() - wanderPhiNow;
    };

    controls.addEventListener("start", handleStart);
    controls.addEventListener("end", handleEnd);
    return () => {
      controls.removeEventListener("start", handleStart);
      controls.removeEventListener("end", handleEnd);
    };
  }, [controlsRef]);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (!controls || basePhi.current === null) return;

    if (isDragging.current) {
      // Sample both angles while dragging so we know the velocity of the
      // last mouse input — direction included — the instant the drag ends.
      const theta = controls.getAzimuthalAngle();
      const phi = controls.getPolarAngle();
      const now = performance.now() / 1000;
      const dt = now - lastSampleTime.current;
      if (dt > 0.0005) {
        let dTheta = theta - lastTheta.current;
        if (dTheta > Math.PI) dTheta -= Math.PI * 2;
        if (dTheta < -Math.PI) dTheta += Math.PI * 2;
        spinSpeed.current = THREE.MathUtils.clamp(dTheta / dt, -MAX_FLICK_SPEED, MAX_FLICK_SPEED);
        verticalSpeed.current = THREE.MathUtils.clamp((phi - lastPhi.current) / dt, -MAX_FLICK_SPEED, MAX_FLICK_SPEED);
      }
      lastTheta.current = theta;
      lastPhi.current = phi;
      lastSampleTime.current = now;
      return;
    }

    // Horizontal: ease the momentum back toward the baseline *magnitude*, but
    // keep whichever direction (sign) the last drag left it spinning in.
    const spinDecayAlpha = 1 - Math.exp(-delta / SPIN_DECAY_TIME);
    const spinDirection = spinSpeed.current === 0 ? 1 : Math.sign(spinSpeed.current);
    spinSpeed.current = THREE.MathUtils.lerp(spinSpeed.current, spinDirection * BASE_SPIN_SPEED, spinDecayAlpha);

    // Vertical: momentum fades to zero (there's no "normal" vertical spin),
    // and the resulting drift offset fades out too, easing back onto the wander curve.
    const verticalDecayAlpha = 1 - Math.exp(-delta / VERTICAL_DECAY_TIME);
    verticalDrift.current += verticalSpeed.current * delta;
    verticalSpeed.current = THREE.MathUtils.lerp(verticalSpeed.current, 0, verticalDecayAlpha);
    verticalDrift.current = THREE.MathUtils.lerp(verticalDrift.current, 0, verticalDecayAlpha);

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);

    spherical.theta += spinSpeed.current * delta;

    const wanderOffset = wander(state.clock.elapsedTime, WANDER_SEED) * (basePhi.current * WANDER_FRACTION);
    const maxPhiOffset = Math.abs(basePhi.current * WANDER_FRACTION);
    const boundedDrift = THREE.MathUtils.clamp(verticalDrift.current, -maxPhiOffset, maxPhiOffset);
    spherical.phi = THREE.MathUtils.clamp(
      basePhi.current + wanderOffset + boundedDrift,
      controls.minPolarAngle,
      controls.maxPolarAngle
    );

    offset.setFromSpherical(spherical);
    camera.position.copy(controls.target).add(offset);
    controls.update();
  });

  return null;
}
