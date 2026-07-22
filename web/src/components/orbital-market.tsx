"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState, useEffect } from "react";
import * as THREE from "three";

/*
  The signature: a ring of candlesticks orbiting the Tars core — a market you
  can hold. Green/red candles (the only place P&L color appears on the page),
  a gold core that breathes, drifting depth particles, and mouse parallax.
  Instanced meshes, capped DPR, no postprocessing: the whole scene stays light.
  Reduced motion: the ring holds still and the scene renders on demand.
*/

const CANDLES = 144;
const RADIUS = 2.35;

type CandleSpec = {
  angle: number;
  height: number;
  up: boolean;
  wobble: number;
};

function seeded(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const cb = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener("change", cb);
    return () => q.removeEventListener("change", cb);
  }, []);
  return reduced;
}

function CandleRing({ reduced }: { reduced: boolean }) {
  const bodies = useRef<THREE.InstancedMesh>(null!);
  const group = useRef<THREE.Group>(null!);
  const target = useRef({ x: 0, y: 0 });

  const specs = useMemo<CandleSpec[]>(
    () =>
      Array.from({ length: CANDLES }, (_, i) => ({
        angle: (i / CANDLES) * Math.PI * 2,
        // A believable tape: heights cluster small with occasional expansions.
        height: 0.12 + Math.pow(seeded(i), 2.2) * 0.55,
        up: seeded(i * 3 + 1) > 0.47,
        wobble: seeded(i * 7 + 2) * Math.PI * 2,
      })),
    [],
  );

  const colors = useMemo(() => {
    const gain = new THREE.Color("#4ade8f");
    const loss = new THREE.Color("#f0625f");
    const arr = new Float32Array(CANDLES * 3);
    specs.forEach((s, i) => {
      const c = s.up ? gain : loss;
      arr.set([c.r, c.g, c.b], i * 3);
    });
    return arr;
  }, [specs]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    specs.forEach((s, i) => {
      const angle = s.angle + (reduced ? 0 : t * 0.055);
      const breathe = reduced ? 0 : Math.sin(t * 0.8 + s.wobble) * 0.045;
      const r = RADIUS + breathe;
      dummy.position.set(Math.cos(angle) * r, Math.sin(angle * 3 + s.wobble) * 0.06, Math.sin(angle) * r);
      dummy.scale.set(0.035, s.height, 0.035);
      dummy.rotation.y = -angle;
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
    });
    bodies.current.instanceMatrix.needsUpdate = true;

    if (group.current && !reduced) {
      group.current.rotation.x = THREE.MathUtils.lerp(
        group.current.rotation.x, -1.05 + target.current.y * 0.08, 0.04);
      group.current.rotation.z = THREE.MathUtils.lerp(
        group.current.rotation.z, target.current.x * 0.1, 0.04);
    } else if (group.current) {
      group.current.rotation.x = -1.05;
    }
  });

  return (
    <group ref={group} rotation={[-1.05, 0, 0]}>
      <instancedMesh ref={bodies} args={[undefined, undefined, CANDLES]}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </boxGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} transparent opacity={0.9} />
      </instancedMesh>

      {/* The tape's rails — two whisper-thin gold rings */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS + 0.28, 0.0035, 8, 220]} />
        <meshBasicMaterial color="#d9b36a" transparent opacity={0.35} toneMapped={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS - 0.3, 0.0028, 8, 220]} />
        <meshBasicMaterial color="#d9b36a" transparent opacity={0.2} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Core({ reduced }: { reduced: boolean }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const halo = useRef<THREE.Sprite>(null!);

  const haloTexture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(233,196,124,0.85)");
    g.addColorStop(0.35, "rgba(222,178,102,0.28)");
    g.addColorStop(1, "rgba(222,178,102,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = reduced ? 1 : 1 + Math.sin(t * 1.15) * 0.05;
    mesh.current.scale.setScalar(0.34 * pulse);
    halo.current.scale.setScalar(2.4 * pulse);
  });

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial color="#ecd39d" toneMapped={false} />
      </mesh>
      <sprite ref={halo}>
        <spriteMaterial map={haloTexture} transparent depthWrite={false}
          blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  );
}

function Dust({ reduced }: { reduced: boolean }) {
  const points = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const n = 420;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 2.2 + seeded(i) * 5.5;
      const theta = seeded(i * 2 + 9) * Math.PI * 2;
      const y = (seeded(i * 5 + 4) - 0.5) * 3.4;
      arr.set([Math.cos(theta) * r, y, Math.sin(theta) * r], i * 3);
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!reduced) points.current.rotation.y = state.clock.elapsedTime * 0.012;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} color="#8f97b8" transparent opacity={0.55}
        sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function OrbitalMarket() {
  const reduced = useReducedMotion();
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={reduced ? "demand" : "always"}
      camera={{ position: [0, 1.15, 5.4], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <CandleRing reduced={reduced} />
      <Core reduced={reduced} />
      <Dust reduced={reduced} />
    </Canvas>
  );
}
