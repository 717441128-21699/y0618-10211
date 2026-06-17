import { useMemo, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { CFDataset, ClipState, Probe, Vec3 } from "@/types/cfd";
import { sampleFieldAtPoint } from "@/utils/streamlines";

interface SectionProbesProps {
  dataset: CFDataset;
  clip: ClipState;
  probes: Probe[];
  field: string;
  timestep: number;
  placeMode: boolean;
  onAdd: (p: [number, number, number]) => void;
  onUpdate: (id: string, p: [number, number, number]) => void;
  onRemove: (id: string) => void;
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function computePlane(clip: ClipState, bb: { min: Vec3; max: Vec3 }): { normal: THREE.Vector3; point: THREE.Vector3 } {
  const center: Vec3 = [
    (bb.min[0] + bb.max[0]) / 2,
    (bb.min[1] + bb.max[1]) / 2,
    (bb.min[2] + bb.max[2]) / 2,
  ];
  let normal: Vec3;
  let point: Vec3;
  if (clip.axis === "x" || clip.axis === "y" || clip.axis === "z") {
    const axisIdx = clip.axis === "x" ? 0 : clip.axis === "y" ? 1 : 2;
    normal = clip.axis === "x" ? [1, 0, 0] : clip.axis === "y" ? [0, 1, 0] : [0, 0, 1];
    point = [...center];
    point[axisIdx] = clip.position;
  } else {
    const n = normalize(clip.normal);
    normal = n;
    point = [
      center[0] + n[0] * clip.position,
      center[1] + n[1] * clip.position,
      center[2] + n[2] * clip.position,
    ];
  }
  return {
    normal: new THREE.Vector3(normal[0], normal[1], normal[2]),
    point: new THREE.Vector3(point[0], point[1], point[2]),
  };
}

export default function SectionProbes({
  dataset,
  clip,
  probes,
  field,
  timestep,
  placeMode,
  onAdd,
  onUpdate,
  onRemove,
}: SectionProbesProps) {
  const { camera, raycaster, pointer, gl } = useThree();
  const bb = dataset.mesh.boundingBox;
  const plane = useMemo(() => {
    const { normal, point } = computePlane(clip, bb);
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  }, [clip, bb]);

  const handlePlaneClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!placeMode) return;
      e.stopPropagation();
      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, target);
      if (hit && target) onAdd([target.x, target.y, target.z]);
    },
    [placeMode, raycaster, pointer, camera, plane, onAdd]
  );

  const size = Math.max(
    bb.max[0] - bb.min[0],
    bb.max[1] - bb.min[1],
    bb.max[2] - bb.min[2]
  );

  const planeMesh = useMemo(() => {
    const g = new THREE.PlaneGeometry(size * 1.6, size * 1.6);
    const m = new THREE.MeshBasicMaterial({ visible: false });
    const mesh = new THREE.Mesh(g, m);
    const { normal, point } = computePlane(clip, bb);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.quaternion.copy(q);
    mesh.position.copy(point);
    return mesh;
  }, [size, clip, bb]);

  return (
    <group>
      {placeMode && (
        <primitive object={planeMesh} onClick={handlePlaneClick} onPointerOver={() => { document.body.style.cursor = "crosshair"; }} onPointerOut={() => { document.body.style.cursor = "auto"; }} />
      )}
      {probes.map((probe) => (
        <SectionProbeMarker
          key={probe.id}
          probe={probe}
          dataset={dataset}
          field={field}
          timestep={timestep}
          plane={plane}
          camera={camera}
          raycaster={raycaster}
          pointer={pointer}
          gl={gl}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
    </group>
  );
}

function SectionProbeMarker({
  probe,
  dataset,
  field,
  timestep,
  plane,
  camera,
  raycaster,
  pointer,
  gl,
  onUpdate,
  onRemove,
}: {
  probe: Probe;
  dataset: CFDataset;
  field: string;
  timestep: number;
  plane: THREE.Plane;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  gl: THREE.WebGLRenderer;
  onUpdate: (id: string, p: [number, number, number]) => void;
  onRemove: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: probe.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    [probe.color]
  );
  const coreMat = useMemo(() => new THREE.MeshBasicMaterial({ color: probe.color }), [probe.color]);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.04, 0.055, 24), []);
  const coreGeo = useMemo(() => new THREE.SphereGeometry(0.025, 12, 12), []);

  const value = useMemo(() => {
    const res = sampleFieldAtPoint(dataset, field, timestep, probe.position);
    return res;
  }, [dataset, field, timestep, probe.position]);

  const onPointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element)?.setPointerCapture?.(e.pointerId);
      setDragging(true);
      document.body.style.cursor = "grabbing";
    },
    []
  );

  const onPointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragging) return;
      e.stopPropagation();
      raycaster.setFromCamera(pointer, camera);
      const target = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, target);
      if (hit && target) {
        onUpdate(probe.id, [target.x, target.y, target.z]);
      }
    },
    [dragging, raycaster, pointer, camera, plane, probe.id, onUpdate]
  );

  const onPointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      (e.target as Element)?.releasePointerCapture?.(e.pointerId);
      setDragging(false);
      document.body.style.cursor = "auto";
    },
    []
  );

  void gl;

  const fmt = (v: number) => {
    const a = Math.abs(v);
    if (a >= 1e4 || (a < 1e-3 && a > 0)) return v.toExponential(2);
    if (a >= 100) return v.toFixed(1);
    if (a >= 1) return v.toFixed(3);
    return v.toFixed(4);
  };

  return (
    <group
      position={probe.position}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOver={(e) => { e.stopPropagation(); if (!dragging) document.body.style.cursor = "grab"; }}
      onPointerOut={() => { if (!dragging) document.body.style.cursor = "auto"; }}
    >
      <mesh geometry={coreGeo} material={coreMat} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[0, 0, 0]} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[0, Math.PI / 2, 0]} />
      <Html distanceFactor={8} position={[0, 0.12, 0]} center>
        <div
          className="px-1.5 py-0.5 bg-ink-900/90 border rounded-[2px] font-mono text-[8px] tracking-wider whitespace-nowrap pointer-events-none"
          style={{ borderColor: probe.color, color: probe.color }}
          onDoubleClick={() => onRemove(probe.id)}
          title="双击删除"
        >
          {probe.label} {fmt(value.value)}
        </div>
      </Html>
    </group>
  );
}
