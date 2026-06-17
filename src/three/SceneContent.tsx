import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { CFDataset, ClipState, VisualizationMode, ColormapName, Probe } from "@/types/cfd";
import MeshSurface from "./MeshSurface";
import VelocityVectors from "./VelocityVectors";
import Streamlines from "./Streamlines";
import ClipSlice, { ClipPlaneFrame } from "./ClipSlice";
import Probes from "./Probes";
import { buildColormapTexture } from "@/utils/colormaps";
import { createFieldSurfaceMaterial } from "./fieldMaterial";
import { buildGeometry, fieldAttribute } from "./geometry";

export interface SceneContentProps {
  dataset: CFDataset;
  mode: VisualizationMode;
  field: string;
  timestep: number;
  colormap: ColormapName;
  range: { min: number; max: number };
  clip: ClipState;
  probes: Probe[];
  selectedProbeId: string | null;
  onSelectProbe: (id: string) => void;
  vectorDensity: number;
  vectorScale: number;
  streamlineDensity: number;
  showGrid: boolean;
  isosurfaceValue: number;
}

export default function SceneContent(props: SceneContentProps) {
  const {
    dataset, mode, field, timestep, colormap, range, clip,
    probes, selectedProbeId, onSelectProbe,
    vectorDensity, vectorScale, streamlineDensity, showGrid, isosurfaceValue,
  } = props;

  const clippingPlanes = useMemo<THREE.Plane[]>(() => {
    if (!clip.enabled) return [];
    const normal = new THREE.Vector3(clip.normal[0], clip.normal[1], clip.normal[2]).normalize();
    const axisIdx = clip.axis === "x" ? 0 : clip.axis === "y" ? 1 : 2;
    const bb = dataset.mesh.boundingBox;
    const point: [number, number, number] = [
      (bb.min[0] + bb.max[0]) / 2,
      (bb.min[1] + bb.max[1]) / 2,
      (bb.min[2] + bb.max[2]) / 2,
    ];
    point[axisIdx] = clip.position;
    const p = new THREE.Vector3(point[0], point[1], point[2]);
    return [new THREE.Plane().setFromNormalAndCoplanarPoint(normal.negate(), p)];
  }, [clip.enabled, clip.axis, clip.position, clip.normal, dataset]);

  const showSurface = mode === "pressure" || mode === "velocity" || mode === "mesh";
  const showVectors = mode === "vectors";
  const showStreamlines = mode === "streamlines";

  return (
    <group>
      {showSurface && (
        <MeshSurface
          dataset={dataset}
          field={field}
          timestep={timestep}
          colormapName={colormap}
          range={range}
          clippingPlanes={clippingPlanes}
          opacity={mode === "mesh" ? 0.12 : 0.9}
          wireframe={mode === "mesh"}
        />
      )}
      {(mode === "vectors" || mode === "streamlines" || mode === "isosurface") && (
        <MeshSurface
          dataset={dataset}
          field={field}
          timestep={timestep}
          colormapName={colormap}
          range={range}
          clippingPlanes={clippingPlanes}
          opacity={0.16}
        />
      )}
      {showVectors && (
        <VelocityVectors
          dataset={dataset}
          timestep={timestep}
          density={vectorDensity}
          scale={vectorScale}
          colormapName={colormap}
          range={range}
          clippingPlanes={clippingPlanes}
        />
      )}
      {showStreamlines && (
        <Streamlines
          dataset={dataset}
          timestep={timestep}
          density={streamlineDensity}
          colormapName={colormap}
          range={range}
          clippingPlanes={clippingPlanes}
        />
      )}
      {mode === "isosurface" && (
        <IsosurfaceProxy
          dataset={dataset}
          field={field}
          timestep={timestep}
          value={isosurfaceValue}
          colormap={colormap}
          range={range}
          clippingPlanes={clippingPlanes}
        />
      )}
      {clip.enabled && (
        <ClipSlice
          dataset={dataset}
          field={field}
          timestep={timestep}
          clip={clip}
          colormapName={colormap}
          range={range}
        />
      )}
      {clip.enabled && <ClipPlaneFrame dataset={dataset} clip={clip} />}
      {showGrid && <BoundaryGrid dataset={dataset} />}
      <Probes probes={probes} selectedId={selectedProbeId} onSelect={onSelectProbe} />
    </group>
  );
}

function IsosurfaceProxy({
  dataset,
  field,
  timestep,
  range,
  colormap,
  clippingPlanes,
}: {
  dataset: CFDataset;
  field: string;
  timestep: number;
  value: number;
  colormap: ColormapName;
  range: { min: number; max: number };
  clippingPlanes?: THREE.Plane[];
}) {
  const colormapTex = useMemo(() => buildColormapTexture(colormap), [colormap]);
  const geom = useMemo(() => buildGeometry(dataset.mesh, true), [dataset]);
  const values = useMemo(() => fieldAttribute(dataset, field, timestep), [dataset, field, timestep]);
  const material = useMemo(
    () =>
      createFieldSurfaceMaterial({
        colormap: colormapTex,
        min: range.min,
        max: range.max,
        opacity: 0.5,
        clippingPlanes,
        side: THREE.DoubleSide,
      }),
    [colormapTex, clippingPlanes]
  );
  useEffect(() => {
    const attr = geom.getAttribute("fieldValue") as THREE.BufferAttribute | undefined;
    if (attr) {
      attr.array = values;
      attr.needsUpdate = true;
    } else {
      geom.setAttribute("fieldValue", new THREE.BufferAttribute(values, 1));
    }
  }, [geom, values]);
  return <mesh geometry={geom} material={material} />;
}

function BoundaryGrid({ dataset }: { dataset: CFDataset }) {
  const bb = dataset.mesh.boundingBox;
  const size = Math.max(bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]);
  const grid = useMemo(() => {
    const geo = new THREE.BoxGeometry(size, size, size, 8, 8, 8);
    return new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x36e2c8, transparent: true, opacity: 0.15 })
    );
  }, [size]);
  const center: [number, number, number] = [
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2,
  ];
  useEffect(() => {
    return () => {
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
    };
  }, [grid]);
  return <primitive object={grid} position={center} />;
}
