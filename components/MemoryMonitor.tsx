"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

const LOG_INTERVAL_S = 5;

/**
 * Dev-only diagnostic: logs the renderer's live GPU resource counts
 * (geometries, textures, programs) every few seconds. There is no web API to
 * force a real garbage collection from page content — the actual fix for
 * leaked GPU memory is calling .dispose() on textures/geometries/materials
 * once they're no longer used (see the cleanup effects throughout this
 * scene). This just makes it visible whether that's working: watch the
 * console while interacting with the page — counts should stay flat once
 * everything has mounted, not climb indefinitely.
 */
export default function MemoryMonitor() {
  const { gl } = useThree();
  const lastLog = useRef(0);
  const peak = useRef({ geometries: 0, textures: 0 });

  useFrame((state) => {
    if (process.env.NODE_ENV !== "development") return;
    const t = state.clock.elapsedTime;
    if (t - lastLog.current < LOG_INTERVAL_S) return;
    lastLog.current = t;

    const { geometries, textures } = gl.info.memory;
    const programCount = gl.info.programs?.length ?? 0;

    const grew = geometries > peak.current.geometries || textures > peak.current.textures;
    peak.current = {
      geometries: Math.max(geometries, peak.current.geometries),
      textures: Math.max(textures, peak.current.textures),
    };

    console.log(
      `%c[memory] geometries=${geometries} textures=${textures} programs=${programCount}${
        grew ? " (new peak)" : ""
      }`,
      grew ? "color: orange" : "color: gray"
    );
  });

  return null;
}
