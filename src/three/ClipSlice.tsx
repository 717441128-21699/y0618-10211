import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import type { CFDataset, ClipState, Vec3 } from "@/types/cfd";
import { sliceMesh } from "./geometry";
import { createFieldSurfaceMaterial } from "./fieldMaterial";
import { buildColormapTexture } from "@/utils/colormaps";

interface ClipSliceProps {
  dataset: CFDataset;
  field: string;
  timestep: number;
  clip: ClipState;
  colormapName: "jet" | "viridis" | "plasma" | "coolwarm";
  range: { min: number; max: number };
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function planeFromClip(clip: ClipState, bb: { min: Vec3; max: Vec3 }): { normal: Vec3; point: Vec3 } {
  let normal: Vec3;
  if (clip.axis === "x") normal = [1, 0, 0];
  else if (clip.axis === "y") normal = [0, 1, 0];
  else if (clip.axis === "z") normal = [0, 0, 1];
  else normal = normalize(clip.normal);

  const center: Vec3 = [
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2,
  ];

  if (clip.axis === "x" || clip.axis === "y" || clip.axis === "z") {
    const axisIdx = clip.axis === "x" ? 0 : clip.axis === "y" ? 1 : 2;
    const point: Vec3 = [...center];
    point[axisIdx] = clip.position;
    return { normal, point };
  }

  const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
  const c = new THREE.Vector3(center[0], center[1], center[2]);
  const point = c.clone().addScaledVector(n, clip.position);
  return { normal: [n.x, n.y, n.z], point: [point.x, point.y, point.z] };
}

export function clipPositionRange(clip: ClipState, bb: { min: Vec3; max: Vec3 }): [number, number] {
  if (clip.axis === "x") return [bb.min[0], bb.max[0]];
  if (clip.axis === "y") return [bb.min[1], bb.max[1]];
  if (clip.axis === "z") return [bb.min[2], bb.max[2]];

  const normal = normalize(clip.normal);
  const n = new THREE.Vector3(normal[0], normal[1], normal[2]);
  const corners: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    corners.push(new THREE.Vector3(
      i & 1 ? bb.max[0] : bb.min[0],
      i & 2 ? bb.max[1] : bb.min[1],
      i & 4 ? bb.max[2] : bb.min[2]
    ));
  }
  let minD = Infinity, maxD = -Infinity;
  const center = new THREE.Vector3(
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2
  );
  for (const c of corners) {
    const d = n.dot(c.clone().sub(center));
    if (d < minD) minD = d;
    if (d > maxD) maxD = d;
  }
  return [minD, maxD];
}

export default function ClipSlice({ dataset, field, timestep, clip, colormapName, range }: ClipSliceProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const colormapTex = useMemo(() => buildColormapTexture(colormapName), [colormapName]);
  const bb = dataset.mesh.boundingBox;

  const { geometry, material } = useMemo(() => {
    const { normal, point } = planeFromClip(clip, bb);
    const { positions, values } = sliceMesh(dataset, { normal, point }, 60000, field, timestep);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("fieldValue", new THREE.BufferAttribute(values, 1));
    geo.computeVertexNormals();
    const mat = createFieldSurfaceMaterial({
      colormap: colormapTex,
      min: range.min,
      max: range.max,
      opacity: 0.96,
      emissiveStrength: 0.25,
      side: THREE.DoubleSide,
    });
    mat.depthWrite = false;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -2;
    return { geometry: geo, material: mat };
  }, [dataset, field, timestep, clip.axis, clip.position, clip.normal, colormapTex, range, bb]);

  useEffect(() => {
    material.uniforms.uMin.value = range.min;
    material.uniforms.uMax.value = range.max;
  }, [material, range]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return <mesh geometry={geometry} material={material} ref={matRef as never} frustumCulled={false} />;
}

export function ClipPlaneFrame({ dataset, clip }: { dataset: CFDataset; clip: ClipState }) {
  const bb = dataset.mesh.boundingBox;
  const { normal, point } = useMemo(() => planeFromClip(clip, bb), [clip, bb]);
  const size = Math.max(
    bb.max[0] - bb.min[0],
    bb.max[1] - bb.min[1],
    bb.max[2] - bb.min[2]
  );
  const plane = useMemo(() => new THREE.PlaneGeometry(size * 1.4, size * 1.4), [size]);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#36e2c8"),
        transparent: true,
        opacity: 0.06,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );
  const edgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: new THREE.Color("#36e2c8"), transparent: true, opacity: 0.5 }),
    []
  );
  const edges = useMemo(() => new THREE.EdgesGeometry(plane), [plane]);

  const { quat, pos } = useMemo(() => {
    const n = new THREE.Vector3(normal[0], normal[1], normal[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return { quat: q, pos: new THREE.Vector3(point[0], point[1], point[2]) };
  }, [normal, point]);

  useEffect(() => {
    return () => {
      plane.dispose();
      material.dispose();
      edgeMat.dispose();
      edges.dispose();
    };
  }, [plane, material, edgeMat, edges]);

  return (
    <group quaternion={quat} position={pos}>
      <mesh geometry={plane} material={material} />
      <lineSegments geometry={edges} material={edgeMat} />
    </group>
  );
}
