import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import type { Probe } from "@/types/cfd";
import { Html } from "@react-three/drei";

interface ProbesProps {
  probes: Probe[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Probes({ probes, selectedId, onSelect }: ProbesProps) {
  return (
    <group>
      {probes.map((probe) => (
        <ProbeMarker
          key={probe.id}
          probe={probe}
          selected={probe.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}

function ProbeMarker({
  probe,
  selected,
  onSelect,
}: {
  probe: Probe;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: probe.color, transparent: true, opacity: selected ? 0.9 : 0.5, side: THREE.DoubleSide }),
    [probe.color, selected]
  );
  const coreMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: probe.color }),
    [probe.color]
  );
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.06, 0.08, 24), []);
  const coreGeo = useMemo(() => new THREE.SphereGeometry(0.035, 12, 12), []);
  const stickGeo = useMemo(() => new THREE.CylinderGeometry(0.005, 0.005, 0.2, 6), []);

  useEffect(() => {
    return () => {
      ringGeo.dispose(); ringMat.dispose(); coreGeo.dispose(); coreMat.dispose(); stickGeo.dispose();
    };
  }, [ringGeo, ringMat, coreGeo, coreMat, stickGeo]);

  return (
    <group
      ref={groupRef}
      position={probe.position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(probe.id);
      }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = "auto"; }}
    >
      <mesh geometry={coreGeo} material={coreMat} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[0, 0, 0]} />
      <mesh geometry={ringGeo} material={ringMat} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={stickGeo} material={coreMat} position={[0, 0.1, 0]} />
      {selected && (
        <Html distanceFactor={8} position={[0, 0.22, 0]} center>
          <div className="px-1.5 py-0.5 bg-ink-900/90 border rounded-[2px] font-mono text-[9px] tracking-wider whitespace-nowrap"
            style={{ borderColor: probe.color, color: probe.color }}>
            {probe.label}
          </div>
        </Html>
      )}
    </group>
  );
}
