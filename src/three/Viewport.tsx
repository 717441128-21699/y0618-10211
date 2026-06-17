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

function CameraRig({
  controlsRef,
  isMaster,
  viewportIndex,
}: {
  controlsRef: React.MutableRefObject<any>;
  isMaster: boolean;
  viewportIndex?: number;
}) {
  const { camera, gl } = useThree();
  const store = useCFDStore();
  const syncingRef = useRef(false);
  const lastSyncTimeRef = useRef(0);

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

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !isMaster) return;

    const onChange = () => {
      if (syncingRef.current) return;
      if (!store.syncCameras) return;
      const now = Date.now();
      if (now - lastSyncTimeRef.current < 16) return;
      lastSyncTimeRef.current = now;
      const target = new THREE.Vector3();
      controls.target.clone(target);
      store.setMasterCamera({
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        up: [camera.up.x, camera.up.y, camera.up.z],
        projection: store.projection,
      });
    };
    controls.addEventListener("change", onChange);
    return () => controls.removeEventListener("change", onChange);
  }, [isMaster, controlsRef, camera, store]);

  useEffect(() => {
    if (!isMaster) return;
    if (!store.syncCameras) return;
    const controls = controlsRef.current;
    if (!controls) return;
    const target = new THREE.Vector3();
    controls.target.clone(target);
    store.setMasterCamera({
      position: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
      up: [camera.up.x, camera.up.y, camera.up.z],
      projection: store.projection,
    });
  }, [store.syncCameras]);

  useEffect(() => {
    if (isMaster) return;
    if (!store.syncCameras) return;
    if (!store.masterCamera) return;
    const controls = controlsRef.current;
    if (!controls) return;

    syncingRef.current = true;
    const [px, py, pz] = store.masterCamera.position;
    const [tx, ty, tz] = store.masterCamera.target;
    const [ux, uy, uz] = store.masterCamera.up;
    camera.position.set(px, py, pz);
    camera.up.set(ux, uy, uz);
    controls.target.set(tx, ty, tz);
    controls.update();
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [store.masterCamera, store.syncCameras, isMaster, controlsRef, camera]);

  useEffect(() => {
    if (isMaster) return;
    if (!store.syncCameras) return;
    const controls = controlsRef.current;
    if (!controls) return;
    if (!store.masterCamera) return;

    syncingRef.current = true;
    const [px, py, pz] = store.masterCamera.position;
    const [tx, ty, tz] = store.masterCamera.target;
    const [ux, uy, uz] = store.masterCamera.up;
    camera.position.set(px, py, pz);
    camera.up.set(ux, uy, uz);
    controls.target.set(tx, ty, tz);
    controls.update();
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [store.syncCameras]);

  void viewportIndex;
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

  void cameraSyncRef;

  const range = activeRange(dataset, store.activeField, store.rangeOverride, store.autoRange);
  const probes: Probe[] = store.probes;
  const timestep = store.getTimestepFor(dataset.id);

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
      <CameraRig controlsRef={localControls} isMaster={isMaster} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[size, size * 1.5, size]} intensity={1.1} />
      <directionalLight position={[-size, -size, size]} intensity={0.3} color="#36e2c8" />
      <hemisphereLight args={["#20283a", "#05070a", 0.4]} />

      <SceneContent
        dataset={dataset}
        mode={store.mode}
        field={store.activeField}
        timestep={timestep}
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
        sectionProbes={store.sectionProbes}
        sectionProbeMode={store.sectionProbeMode}
        onAddSectionProbe={(p) => store.addSectionProbe(p)}
        onUpdateSectionProbe={(id, p) => store.updateSectionProbe(id, p)}
        onRemoveSectionProbe={(id) => store.removeSectionProbe(id)}
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
