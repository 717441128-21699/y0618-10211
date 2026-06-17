import { useMemo, useEffect, useRef } from "react";
import * as THREE from "three";
import type { CFDataset, Vec3 } from "@/types/cfd";
import { sampleColormap } from "@/utils/colormaps";

interface VelocityVectorsProps {
  dataset: CFDataset;
  timestep: number;
  density: number;
  scale: number;
  colormapName: "jet" | "viridis" | "plasma" | "coolwarm";
  range: { min: number; max: number };
  clippingPlanes?: THREE.Plane[];
}

function makeArrowGeometry(): THREE.BufferGeometry {
  const shaft = new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6, 1, false);
  shaft.translate(0, 0.35, 0);
  const head = new THREE.ConeGeometry(0.045, 0.3, 8, 1);
  head.translate(0, 0.85, 0);
  const merged = mergeGeometries([shaft, head]);
  return merged;
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  let posCount = 0;
  let normCount = 0;
  let idxCount = 0;
  const positions: ArrayLike<number>[] = [];
  const normals: ArrayLike<number>[] = [];
  const indices: ArrayLike<number>[] = [];
  for (const g of geos) {
    const pos = g.getAttribute("position") as THREE.BufferAttribute;
    const nrm = g.getAttribute("normal") as THREE.BufferAttribute;
    const idx = g.getIndex();
    positions.push(pos.array as Float32Array);
    normals.push(nrm ? (nrm.array as Float32Array) : new Float32Array(pos.array.length));
    indices.push(idx ? (idx.array as ArrayLike<number>) : range(pos.count));
    posCount += pos.count;
    normCount += nrm ? nrm.count : pos.count;
    idxCount += idx ? idx.count : pos.count;
  }
  const pArr = new Float32Array(posCount * 3);
  const nArr = new Float32Array(normCount * 3);
  const iArr = new Uint32Array(idxCount);
  let po = 0, no = 0, io = 0, base = 0;
  for (let k = 0; k < geos.length; k++) {
    pArr.set(positions[k], po); po += positions[k].length;
    nArr.set(normals[k], no); no += normals[k].length;
    const idx = indices[k];
    for (let i = 0; i < idx.length; i++) iArr[io++] = (idx[i] as number) + base;
    base += positions[k].length / 3;
  }
  merged.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(nArr, 3));
  merged.setIndex(new THREE.BufferAttribute(iArr, 1));
  return merged;
}

function range(n: number): number[] {
  const a: number[] = [];
  for (let i = 0; i < n; i++) a.push(i);
  return a;
}

export default function VelocityVectors({
  dataset,
  timestep,
  density,
  scale,
  colormapName,
  range: rng,
  clippingPlanes = [],
}: VelocityVectorsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const arrowGeo = useMemo(() => makeArrowGeometry(), []);

  const { seeds, matrices, colors } = useMemo(() => {
    const mesh = dataset.mesh;
    const npc = mesh.pointCount;
    const stride = Math.max(1, Math.floor(1 / Math.max(0.02, density) / 6));
    const f = dataset.fields["velocity"] || Object.values(dataset.fields).find((x) => x.type === "vector");
    const data = f ? (f.timesteps[Math.min(timestep, f.timesteps.length - 1)] || f.timesteps[0]) : new Float32Array(0);
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const seeds: Vec3[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const col = new THREE.Color();
    const span = Math.max(1e-6, rng.max - rng.min);
    for (let i = 0; i < npc; i += stride) {
      const vx = data[i * 3], vy = data[i * 3 + 1], vz = data[i * 3 + 2];
      const mag = Math.hypot(vx, vy, vz);
      if (mag < 1e-4) continue;
      pos.set(mesh.points[i * 3], mesh.points[i * 3 + 1], mesh.points[i * 3 + 2]);
      dir.set(vx, vy, vz).normalize();
      q.setFromUnitVectors(up, dir);
      const s = scale * (0.2 + 0.8 * (mag - rng.min) / span) * 0.9;
      m.compose(pos, q, new THREE.Vector3(s, s, s));
      matrices.push(m.clone());
      const t = Math.max(0, Math.min(1, (mag - rng.min) / span));
      const [r, g, b] = sampleColormap(colormapName, t);
      col.setRGB(r, g, b);
      colors.push(col.clone());
      seeds.push([pos.x, pos.y, pos.z]);
    }
    return { seeds, matrices, colors };
  }, [dataset, timestep, density, scale, colormapName, rng]);

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.3,
        roughness: 0.4,
        emissive: new THREE.Color(0x1a1f2a),
        emissiveIntensity: 0.4,
        clippingPlanes,
      }),
    [clippingPlanes]
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = matrices.length;
  }, [matrices, colors]);

  useEffect(() => {
    return () => {
      arrowGeo.dispose();
      material.dispose();
    };
  }, [arrowGeo, material]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[arrowGeo, material, Math.max(1, matrices.length)]}
      frustumCulled={false}
    />
  );
}
