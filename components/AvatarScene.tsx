'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function AvatarModel({ url, isSpeaking, speechPulse }: { url: string; isSpeaking?: boolean; speechPulse?: number }) {
  const groupRef = useRef<THREE.Group>(null!);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const expressionManagerRef = useRef<any>(null);
  const mouthShapeNames = useMemo(() => ['aa', 'ih', 'oh', 'ou', 'ee'], []);
  const mouthPhase = useRef(0);
  const mouthSmoothing = useRef(0);

  useEffect(() => {
    let mounted = true;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      url,
      (gltf) => {
        if (!mounted) return;

        const loadedVrm = (gltf.userData?.vrm as VRM | undefined) ?? undefined;
        const sceneRoot = loadedVrm?.scene ?? gltf.scene;
        console.log('GLTF loaded: scene children', gltf.scene.children.length, 'userData', Object.keys(gltf.userData));
        if (!sceneRoot) {
          console.warn('No scene root found in VRM/gltf load.');
          return;
        }

        // Set orientation and center the loaded scene or VRM root
        sceneRoot.rotation.set(0, Math.PI, 0);
        sceneRoot.updateMatrixWorld(true);

        const bbox = new THREE.Box3().setFromObject(sceneRoot);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);

        const cameraDistance = 1.6;
        const cameraFov = 35;
        const fovRad = (cameraFov * Math.PI) / 180;
        const frustumHeight = 2 * cameraDistance * Math.tan(fovRad / 2);
        const desiredFraction = 0.95;
        let scale = (frustumHeight * desiredFraction) / maxDim;
        scale = Math.min(Math.max(scale, 0.4), 25);

        sceneRoot.scale.setScalar(scale);
        sceneRoot.position.set(-center.x * scale, -center.y * scale + 0.12, -center.z * scale);
        sceneRoot.updateMatrixWorld(true);

        let meshCount = 0;
        sceneRoot.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.frustumCulled = false;
            mesh.visible = true;
            meshCount += 1;
          }
        });

        console.log('Scene root centered and scaled:', { scale, size, center, meshCount, position: sceneRoot.position });
        groupRef.current?.add(sceneRoot);
        if (loadedVrm) {
          setVrm(loadedVrm);
          expressionManagerRef.current = loadedVrm.expressionManager;
        }
      },
      undefined,
      (error) => console.error('Failed to load VRM:', error)
    );

    return () => {
      mounted = false;
    };
  }, [url]);

  useFrame(() => {
    if (vrm) {
      vrm.update(0.016);
    }

    const expressionManager = expressionManagerRef.current;
    if (!expressionManager) {
      return;
    }

    const isSpeakingActive = Boolean(isSpeaking);
    expressionManager.resetValues();
    if (isSpeakingActive) {
      const pulse = speechPulse ?? 0;
      mouthPhase.current += 0.05;
      const smoothedPhase = mouthPhase.current * 0.75 + pulse * 0.25;
      const rawValue = Math.sin(smoothedPhase * 0.9) * 0.8;
      mouthSmoothing.current = mouthSmoothing.current * 0.8 + rawValue * 0.2;
      const normalized = Math.max(0, Math.min(1, (mouthSmoothing.current + 1) / 2));
      const activeShape = mouthShapeNames[Math.floor(normalized * mouthShapeNames.length) % mouthShapeNames.length];
      const mouthWeight = 0.25 + 0.5 * normalized;

      mouthShapeNames.forEach((shape) => {
        expressionManager.setValue(shape, shape === activeShape ? mouthWeight : 0);
      });
      expressionManager.setValue('neutral', 0);
    } else {
      mouthPhase.current = 0;
      mouthSmoothing.current = 0;
      expressionManager.setValue('neutral', 1);
    }
    expressionManager.update();
  });

  return <group ref={groupRef} />;
}

export default function AvatarScene({ isSpeaking, speechPulse }: { isSpeaking?: boolean; speechPulse?: number }) {
  const vrmUrl = useMemo(() => '/allo21.vrm', []);
  // Render avatar inside a small rectangular box located at a corner of the parent card.
  // This keeps the rest of the card free and the avatar visually pinned to a corner.
  const cornerBoxStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 520,
    borderRadius: 20,
    overflow: 'hidden',
    background: '#02050a'
  };

  const innerBoxStyle: React.CSSProperties = {
    position: 'absolute',
    // default to top-right corner; adjust right/top to place in corner
    right: 16,
    top: 16,
    width: 320,
    height: 320,
    borderRadius: 14,
    overflow: 'hidden',
    background: '#000'
  };

  return (
    <div style={cornerBoxStyle}>
      <div style={innerBoxStyle}>
        <Canvas shadows style={{ width: '100%', height: '100%' }}>
          <PerspectiveCamera makeDefault position={[0, 0.45, 1.6]} fov={35} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[0.5, 1.5, 1.5]} intensity={1.2} />
          <directionalLight position={[-0.3, 0.8, -1]} intensity={0.6} />
          <hemisphereLight args={[0xffffff, 0x222222, 0.55]} />
          <AvatarModel url={vrmUrl} isSpeaking={isSpeaking} speechPulse={speechPulse} />
          <OrbitControls enablePan={false} enableZoom enableRotate={true} />
        </Canvas>
      </div>
    </div>
  );
}
