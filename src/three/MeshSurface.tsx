import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { CFDataset } from "@/types/cfd";
import { buildGeometry, fieldAttribute } from "./geometry";
import { createFieldSurfaceMaterial } from "./fieldMaterial";
import { buildColormapTexture } from "@/utils/colormaps";

interface MeshSurfaceProps {
  dataset: CFDataset;
  field: string;
  timestep: number;
  colormapName: "jet" | "viridis" | "plasma" | "coolwarm";
  range: { min: number; max: number };
  clippingPlanes?: THREE.Plane[];
  opacity?: number;
  wireframe?: boolean;
}

export default function MeshSurface({
  dataset,
  field,
  timestep,
  colormapName,
  range,
  clippingPlanes = [],
  opacity = 1,
  wireframe = false,
}: MeshSurfaceProps) {
  const geom = useMemo(() => buildGeometry(dataset.mesh, true), [dataset]);
  const colormapTex = useMemo(() => buildColormapTexture(colormapName), [colormapName]);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const material = useMemo(
    () =>
      createFieldSurfaceMaterial({
        colormap: colormapTex,
        min: range.min,
        max: range.max,
        opacity,
        clippingPlanes,
        side: THREE.DoubleSide,
      }),
    [colormapTex, clippingPlanes]
  );

  useEffect(() => {
    return () => {
      material.dispose();
      geom.dispose();
      colormapTex.dispose();
    };
  }, [material, geom, colormapTex]);

  useEffect(() => {
    material.uniforms.uMin.value = range.min;
    material.uniforms.uMax.value = range.max;
    material.uniforms.uOpacity.value = opacity;
    material.transparent = opacity < 1;
    material.depthWrite = opacity >= 0.99;
    material.wireframe = wireframe;
    material.clippingPlanes = clippingPlanes;
  }, [material, range, opacity, wireframe, clippingPlanes]);

  const fieldValues = useMemo(() => fieldAttribute(dataset, field, timestep), [dataset, field, timestep]);

  useEffect(() => {
    const attr = geom.getAttribute("fieldValue") as THREE.BufferAttribute | undefined;
    if (attr) {
      attr.array = fieldValues;
      attr.needsUpdate = true;
    } else {
      geom.setAttribute("fieldValue", new THREE.BufferAttribute(fieldValues, 1));
    }
  }, [geom, fieldValues]);

  return (
    <mesh geometry={geom} material={material} ref={matRef as never} />
  );
}
