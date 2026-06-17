import { useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, GizmoHelper, GizmoViewport } from "@react-three/drei";
import * as THREE from "three";
import type { CFDataset, Probe } from "@/types/cfd";
import SceneContent from "./SceneContent";
import { datasetCenter, datasetSize } from "./geometry";
import { useCFDStore } from "@/store/useCFDStore";
import { activeRange } from "@/store/useCFDStore";

interface ViewportProps {
  dataset: CFDataset;
  onPlaceProbe?: (p: [number, number, number]) => void;
  onSelectProbe?: (id: string) => void;
  probePlacement?: boolean;
  registerCanvas?: (el: HTMLCanvasElement | null) => void;
  controlsRef?: React.MutableRefObject<any>;
  cameraSyncRef?: React.MutableRefObject<{
    sync: (cam: THREE.Camera) => void;
    setCamera: (cam: THREE.Camera) => void;
  } | null>;
  isMaster?: boolean;
}

function CameraRig({ controlsRef }: { controlsRef?: React.MutableRefObject<any> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.01;
    cam.far = 1000;
    cam.updateProjectionMatrix();
  }, [camera]);
  useEffect(() => {
    const onCtx = (e: Event) => e.preventDefault();
    gl.domElement.addEventListener("contextmenu", onCtx);
    return () => gl.domElement.removeEventListener("contextmenu", onCtx);
  }, [gl]);
  void controlsRef;
  return null;
}

function ProbePlacer({
  active,
  dataset,
  onPlace,
}: {
  active: boolean;
  dataset: CFDataset;
  onPlace: (p: [number, number, number]) => void;
}) {
  const { raycaster, camera, pointer } = useThree();
  const plane = useMemo(() => {
    const center = datasetCenter(dataset);
    const size = datasetSize(dataset);
    const g = new THREE.PlaneGeometry(size * 2, size * 2);
    const m = new THREE.MeshBasicMaterial({ visible: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(center.x, center.y, center.z);
    return mesh;
  }, [dataset]);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!active) return;
      e.stopPropagation();
      const center = datasetCenter(dataset);
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      const target = new THREE.Vector3();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(
        new THREE.Plane(camDir.clone().negate(), -camDir.dot(new THREE.Vector3(center.x, center.y, center.z))),
        target
      );
      if (hit && target) onPlace([target.x, target.y, target.z]);
    },
    [active, camera, raycaster, pointer, dataset, onPlace]
  );

  if (!active) return null;
  return <primitive object={plane} onClick={handleClick} />;
}

export default function Viewport({
  dataset,
  onPlaceProbe,
  onSelectProbe,
  probePlacement = false,
  registerCanvas,
  controlsRef,
  cameraSyncRef,
  isMaster = true,
}: ViewportProps) {
  const store = useCFDStore();
  const controls = useRef<any>(null);
  const localControls = controlsRef ?? controls;

  const center = useMemo(() => datasetCenter(dataset), [dataset]);
  const size = useMemo(() => datasetSize(dataset), [dataset]);
  const camInit = useMemo<[number, number, number]>(
    () => [center.x + size * 0.9, center.y - size * 0.7, center.z + size * 0.9],
    [center, size]
  );

  useEffect(() => {
    if (cameraSyncRef && isMaster && localControls.current) {
      cameraSyncRef.current = {
        sync: (_cam: THREE.Camera) => {},
        setCamera: (cam: THREE.Camera) => {
          const c = cam as THREE.PerspectiveCamera;
          if (localControls.current) {
            localControls.current.object.position.copy(c.position);
            localControls.current.target.copy((c as any).target ?? new THREE.Vector3());
            localControls.current.update();
          }
        },
      };
    }
  }, [cameraSyncRef, isMaster, localControls]);

  const range = activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange);

  const probes: Probe[] = store.probes;

  return (
    <Canvas
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      camera={{ position: camInit, fov: 45, near: 0.01, far: 1000 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color("#070a0f"), 1);
        scene.fog = new THREE.Fog("#070a0f", size * 1.5, size * 5);
        const canvas = gl.domElement;
        registerCanvas?.(canvas);
      }}
      dpr={[1, 1.8]}
    >
      <CameraRig controlsRef={localControls} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[size, size * 1.5, size]} intensity={1.1} />
      <directionalLight position={[-size, -size, size]} intensity={0.3} color="#36e2c8" />
      <hemisphereLight args={["#20283a", "#05070a", 0.4]} />

      <SceneContent
        dataset={dataset}
        mode={store.mode}
        field={store.activeField}
        timestep={store.timestep}
        colormap={store.colormap}
        range={range}
        clip={store.clip}
        probes={probes}
        selectedProbeId={store.selectedProbeId}
        onSelectProbe={(id) => onSelectProbe?.(id)}
        vectorDensity={store.vectorDensity}
        vectorScale={store.vectorScale}
        streamlineDensity={store.streamlineDensity}
        showGrid={store.showGrid}
        isosurfaceValue={store.isosurfaceValue}
      />

      <ProbePlacer active={probePlacement} dataset={dataset} onPlace={(p) => onPlaceProbe?.(p)} />

      {store.showAxes && (
        <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
          <GizmoViewport axisColors={["#ff4d8d", "#36e2c8", "#ffb347"]} labelColor="white" />
        </GizmoHelper>
      )}

      <OrbitControls
        ref={localControls}
        target={[center.x, center.y, center.z]}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.8}
        minDistance={size * 0.1}
        maxDistance={size * 6}
        makeDefault
      />
    </Canvas>
  );
}
