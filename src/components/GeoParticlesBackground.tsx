/**
 * GeoParticlesBackground — Fond vidéo nébuleuse (dark) ou particules canvas (light).
 *
 * Dark mode  : vidéo nebula-bg.mp4 en fond, loop muted autoplay, légèrement assombrie.
 * Light mode : fond canvas particules géospatiales (comportement original inchangé).
 *
 * Props :
 *   isDark — si true, palette sombre avec vidéo ; si false, canvas particules clair.
 */

import { useEffect, useRef, useCallback } from "react";
import nebulaBg from "../assets/nebula-bg.mp4";

/* ─── Types internes ─────────────────────────────────────────── */

type NodeKind = "satellite" | "vector" | "raster";

interface GeoNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: NodeKind;
  blinkPhase: number;
  blinkSpeed: number;
  opacity: number;
}

interface FloatingCoord {
  x: number;
  y: number;
  vy: number;
  lat: number;
  lon: number;
  age: number;
  lifetime: number;
  opacity: number;
  fontSize: number;
}

interface ScanRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  speed: number;
  opacity: number;
  color: string;
}

interface ParticleConfig {
  nodeCount: number;
  maxEdgeDistance: number;
  maxNodeOpacity: number;
  maxEdgeOpacity: number;
  maxCoordOpacity: number;
  maxRingOpacity: number;
  ringSpawnInterval: number;
  coordSpawnInterval: number;
}

/* ─── Palettes ───────────────────────────────────────────────── */

const DARK_PALETTE: Record<NodeKind, string> = {
  satellite: "#60a5fa",
  vector:    "#34d399",
  raster:    "#a78bfa",
};

const LIGHT_PALETTE: Record<NodeKind, string> = {
  satellite: "#2563eb",
  vector:    "#059669",
  raster:    "#7c3aed",
};

const DARK_RING_COLORS  = ["#60a5fa", "#34d399", "#06b6d4"];
const LIGHT_RING_COLORS = ["#3b82f6", "#10b981", "#0891b2"];

/* ─── Config ─────────────────────────────────────────────────── */

const DARK_CONFIG: ParticleConfig = {
  nodeCount:           55,
  maxEdgeDistance:     160,
  maxNodeOpacity:      0.70,
  maxEdgeOpacity:      0.18,
  maxCoordOpacity:     0.55,
  maxRingOpacity:      0.40,
  ringSpawnInterval:   120,
  coordSpawnInterval:  80,
};

const LIGHT_CONFIG: ParticleConfig = {
  nodeCount:           40,
  maxEdgeDistance:     140,
  maxNodeOpacity:      0.22,
  maxEdgeOpacity:      0.07,
  maxCoordOpacity:     0.20,
  maxRingOpacity:      0.15,
  ringSpawnInterval:   150,
  coordSpawnInterval:  110,
};

const NODE_KINDS: NodeKind[]       = ["satellite", "vector", "raster"];
const NODE_RADII: [number, number] = [2, 5];
const VELOCITY_MAX                 = 0.35;
const MIN_EDGE_OPACITY             = 0.02;
const COORD_FONT_FAMILY            = "'JetBrains Mono', 'Fira Mono', monospace";

/* ─── Helpers ────────────────────────────────────────────────── */

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomNodeKind(): NodeKind {
  return NODE_KINDS[randomInt(0, NODE_KINDS.length - 1)];
}

function makeNode(width: number, height: number): GeoNode {
  return {
    x:          randomBetween(0, width),
    y:          randomBetween(0, height),
    vx:         randomBetween(-VELOCITY_MAX, VELOCITY_MAX),
    vy:         randomBetween(-VELOCITY_MAX, VELOCITY_MAX),
    radius:     randomBetween(NODE_RADII[0], NODE_RADII[1]),
    kind:       randomNodeKind(),
    blinkPhase: randomBetween(0, Math.PI * 2),
    blinkSpeed: randomBetween(0.015, 0.04),
    opacity:    randomBetween(0.4, 1.0),
  };
}

function makeCoord(width: number, height: number): FloatingCoord {
  const lat = randomBetween(-80, 80);
  const lon = randomBetween(-179, 179);
  const lifetime = randomInt(140, 260);
  return {
    x:        randomBetween(width * 0.05, width * 0.95),
    y:        randomBetween(height * 0.1, height * 0.9),
    vy:       randomBetween(-0.30, -0.10),
    lat:      Math.round(lat * 10) / 10,
    lon:      Math.round(lon * 10) / 10,
    age:      0,
    lifetime,
    opacity:  0,
    fontSize: randomBetween(8.5, 11),
  };
}

function formatCoord(lat: number, lon: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lonDir = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(1)}°${latDir} ${Math.abs(lon).toFixed(1)}°${lonDir}`;
}

function distanceSq(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/* ─── Composant principal ────────────────────────────────────── */

interface GeoParticlesBackgroundProps {
  isDark: boolean;
}

/* ── Fond vidéo nébuleuse (dark mode) ───────────────────────── */
function NebulaVideoBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <video
        src={nebulaBg}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: 0.55 }}
      />
      {/* Voile sombre pour ne pas écraser le contenu */}
      <div className="absolute inset-0 bg-[#0c0d0f]/55" />
    </div>
  );
}

/* ── Fond canvas particules (light mode) ────────────────────── */
function ParticlesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef({
    nodes:      [] as GeoNode[],
    coords:     [] as FloatingCoord[],
    rings:      [] as ScanRing[],
    frameCount: 0,
    animId:     0,
    width:      0,
    height:     0,
  });

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D) => {
    const config  = LIGHT_CONFIG;
    const palette = LIGHT_PALETTE;
    const ringColors = LIGHT_RING_COLORS;
    const state   = stateRef.current;
    const { width, height } = state;

    ctx.clearRect(0, 0, width, height);

    const maxDistSq = config.maxEdgeDistance * config.maxEdgeDistance;
    for (let i = 0; i < state.nodes.length; i++) {
      for (let j = i + 1; j < state.nodes.length; j++) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        const dSq = distanceSq(a.x, a.y, b.x, b.y);
        if (dSq > maxDistSq) continue;
        const ratio   = 1 - Math.sqrt(dSq) / config.maxEdgeDistance;
        const opacity = Math.max(MIN_EDGE_OPACITY, config.maxEdgeOpacity * ratio);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(37, 99, 235, ${opacity})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    for (const node of state.nodes) {
      node.blinkPhase = (node.blinkPhase + node.blinkSpeed) % (Math.PI * 2);
      const blinkFactor  = 0.55 + 0.45 * Math.sin(node.blinkPhase);
      const finalOpacity = node.opacity * blinkFactor * config.maxNodeOpacity;
      const color        = palette[node.kind];

      const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 3.5);
      gradient.addColorStop(0, `${color}${Math.round(finalOpacity * 80).toString(16).padStart(2, "0")}`);
      gradient.addColorStop(1, `${color}00`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = color + Math.round(finalOpacity * 255).toString(16).padStart(2, "0");
      ctx.fill();

      // Déplacement
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < -node.radius * 4) node.x = width  + node.radius * 4;
      if (node.x > width  + node.radius * 4) node.x = -node.radius * 4;
      if (node.y < -node.radius * 4) node.y = height + node.radius * 4;
      if (node.y > height + node.radius * 4) node.y = -node.radius * 4;
    }

    // Coordonnées flottantes
    state.frameCount++;
    if (state.frameCount % config.coordSpawnInterval === 0 && state.coords.length < 8) {
      state.coords.push(makeCoord(width, height));
    }
    state.coords = state.coords.filter((c) => c.age < c.lifetime);
    for (const coord of state.coords) {
      coord.age++;
      coord.y += coord.vy;
      const progress = coord.age / coord.lifetime;
      coord.opacity = progress < 0.15
        ? (progress / 0.15) * config.maxCoordOpacity
        : progress > 0.75
          ? ((1 - progress) / 0.25) * config.maxCoordOpacity
          : config.maxCoordOpacity;
      ctx.font = `${coord.fontSize}px ${COORD_FONT_FAMILY}`;
      ctx.fillStyle = `rgba(37, 99, 235, ${coord.opacity})`;
      ctx.fillText(formatCoord(coord.lat, coord.lon), coord.x, coord.y);
    }

    // Anneaux de scan
    if (state.frameCount % config.ringSpawnInterval === 0 && state.rings.length < 4) {
      const color = ringColors[randomInt(0, ringColors.length - 1)];
      state.rings.push({
        x: randomBetween(width * 0.1, width * 0.9),
        y: randomBetween(height * 0.1, height * 0.9),
        radius: 0,
        maxRadius: randomBetween(60, 130),
        speed: randomBetween(0.6, 1.2),
        opacity: config.maxRingOpacity,
        color,
      });
    }
    state.rings = state.rings.filter((r) => r.radius < r.maxRadius);
    for (const ring of state.rings) {
      ring.radius += ring.speed;
      ring.opacity = config.maxRingOpacity * (1 - ring.radius / ring.maxRadius);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      ctx.strokeStyle = ring.color + Math.round(ring.opacity * 255).toString(16).padStart(2, "0");
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx);
    stateRef.current.animId = requestAnimationFrame(animate);
  }, [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      if (!canvas) return;
      const w   = canvas.offsetWidth  || window.innerWidth;
      const h   = canvas.offsetHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      stateRef.current.width  = w;
      stateRef.current.height = h;
      stateRef.current.nodes  = Array.from({ length: LIGHT_CONFIG.nodeCount }, () => makeNode(w, h));
      stateRef.current.coords = [];
      stateRef.current.rings  = [];
      stateRef.current.frameCount = 0;
    }

    init();
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(stateRef.current.animId);
      init();
      stateRef.current.animId = requestAnimationFrame(animate);
    });
    observer.observe(canvas);
    stateRef.current.animId = requestAnimationFrame(animate);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(stateRef.current.animId);
    };
  }, [animate]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}

/* ── Export principal ───────────────────────────────────────── */
export default function GeoParticlesBackground({ isDark }: GeoParticlesBackgroundProps) {
  if (isDark) return <NebulaVideoBackground />;
  return <ParticlesBackground />;
}
