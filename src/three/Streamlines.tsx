import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import type { CFDataset } from "@/types/cfd";
import { integrateStreamline, generateSeeds } from "@/utils/streamlines";
import { sampleColormap } from "@/utils/colormaps";

interface StreamlinesProps {
  dataset: CFDataset;
  timestep: number;
  density: number;
  colormapName: "jet" | "viridis" | "plasma" | "coolwarm";
  range: { min: number; max: number };
  clippingPlanes?: THREE.Plane[];
}

export default function Streamlines({
  dataset,
  timestep,
  density,
  colormapName,
  range: rng,
  clippingPlanes = [],
}: StreamlinesProps) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const { positions, colors, segCount } = useMemo(() => {
    const seeds = generateSeeds(dataset, { grid: Math.max(3, Math.round(2 + density * 10)) });
    const allPos: number[] = [];
    const allCol: number[] = [];
    const span = Math.max(1e-6, rng.max - rng.min);
    for (const seed of seeds) {
      const { positions, magnitudes, count } = integrateStreamline(dataset, "velocity", timestep, seed, {
        steps: 90,
        stepSize: 0.09,
        direction: "both",
      });
      for (let i = 0; i < count; i++) {
        allPos.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        const t = Math.max(0, Math.min(1, (magnitudes[i] - rng.min) / span));
        const [r, g, b] = sampleColormap(colormapName, t);
        allCol.push(r, g, b);
        if (i < count - 1) {
          allPos.push(positions[(i + 1) * 3], positions[(i + 1) * 3 + 1], positions[(i + 1) * 3 + 2]);
          allCol.push(r, g, b);
        }
      }
    }
    return {
      positions: new Float32Array(allPos),
      colors: new Float32Array(allCol),
      segCount: allPos.length / 3,
    };
  }, [dataset, timestep, density, colormapName, rng]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        clippingPlanes,
        linewidth: 1,
      }),
    [clippingPlanes]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} ref={matRef as never} />
  );
}
