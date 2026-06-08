/**
 * GeoParticlesBackground — Fond de particules géospatiales animées.
 *
 * Canvas 2D, sans dépendance externe.
 * Représente un réseau de nœuds SIG (satellite, vecteur, raster) connectés
 * par des arêtes dynamiques, avec coordonnées flottantes et anneaux de scan.
 *
 * Props :
 *   isDark — si true, palette sombre ; si false, palette claire atténuée.
 */

import { useEffect, useRef, useCallback } from "react";

/* ─── Types internes ─────────────────────────────────────────── */

type NodeKind = "satellite" | "vector" | "raster";

interface GeoNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  kind: NodeKind;
  /** Phase du clignotement [0, 2π] */
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
  /** Durée de vie totale en frames */
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
  satellite: "#60a5fa", // bleu
  vector:    "#34d399", // émeraude
  raster:    "#a78bfa", // violet
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

/* ─── Constantes ─────────────────────────────────────────────── */
const NODE_KINDS: NodeKind[]     = ["satellite", "vector", "raster"];
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

export default function GeoParticlesBackground({ isDark }: GeoParticlesBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* Toutes les données d'état mutable du canvas dans un ref unique
     pour éviter les re-renders React */
  const stateRef = useRef({
    nodes:       [] as GeoNode[],
    coords:      [] as FloatingCoord[],
    rings:        [] as ScanRing[],
    frameCount:   0,
    animId:       0,
    lastTime:     0,
    width:        0,
    height:       0,
  });

  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D, config: ParticleConfig, palette: Record<NodeKind, string>, ringColors: string[]) => {
      const state  = stateRef.current;
      const { width, height } = state;

      ctx.clearRect(0, 0, width, height);

      /* ── Arêtes entre nœuds proches ── */
      const maxDistSq = config.maxEdgeDistance * config.maxEdgeDistance;

      for (let i = 0; i < state.nodes.length; i++) {
        for (let j = i + 1; j < state.nodes.length; j++) {
          const nodeA = state.nodes[i];
          const nodeB = state.nodes[j];
          const dSq   = distanceSq(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
          if (dSq > maxDistSq) continue;

          const ratio   = 1 - Math.sqrt(dSq) / config.maxEdgeDistance;
          const opacity = Math.max(MIN_EDGE_OPACITY, config.maxEdgeOpacity * ratio);

          ctx.beginPath();
          ctx.moveTo(nodeA.x, nodeA.y);
          ctx.lineTo(nodeB.x, nodeB.y);
          ctx.strokeStyle = isDark
            ? `rgba(96, 165, 250, ${opacity})`
            : `rgba(37, 99, 235, ${opacity})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      /* ── Nœuds ── */
      for (const node of state.nodes) {
        node.blinkPhase = (node.blinkPhase + node.blinkSpeed) % (Math.PI * 2);
        const blinkFactor = 0.55 + 0.45 * Math.sin(node.blinkPhase);
        const finalOpacity = node.opacity * blinkFactor * config.maxNodeOpacity;
        const color        = palette[node.kind];

        /* Halo externe */
        const gradient = ctx.createRadialGradient(
          node.x, node.y, 0,
          node.x, node.y, node.radius * 3.5,
        );
        gradient.addColorStop(0, `${color}${Math.round(finalOpacity * 80).toString(16).padStart(2, "0")}`);
        gradient.addColorStop(1, `${color}00`);

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        /* Point central */
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = color + Math.round(finalOpacity * 255).toString(16).padStart(2, "0");
        ctx.fill();

        /* Mise à jour de la position */
        node.x += node.vx;
        node.y += node.vy;

        /* Rebond sur les bords */
        if (node.x < 0)       { node.x = width;  }
        if (node.x > width)   { node.x = 0;       }
        if (node.y < 0)       { node.y = height;  }
        if (node.y > height)  { node.y = 0;       }
      }

      /* ── Anneaux de scan ── */
      for (let i = state.rings.length - 1; i >= 0; i--) {
        const ring = state.rings[i];
        ring.radius  += ring.speed;
        ring.opacity  = config.maxRingOpacity * (1 - ring.radius / ring.maxRadius);

        if (ring.opacity <= 0.005 || ring.radius >= ring.maxRadius) {
          state.rings.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = ring.color + Math.round(ring.opacity * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      /* ── Coordonnées flottantes ── */
      ctx.font = `${12}px ${COORD_FONT_FAMILY}`;
      for (let i = state.coords.length - 1; i >= 0; i--) {
        const coord = state.coords[i];
        coord.age++;
        coord.y += coord.vy;

        /* Fade-in / fade-out */
        const fadeFrames = 25;
        if (coord.age < fadeFrames) {
          coord.opacity = (coord.age / fadeFrames) * config.maxCoordOpacity;
        } else if (coord.age > coord.lifetime - fadeFrames) {
          coord.opacity = ((coord.lifetime - coord.age) / fadeFrames) * config.maxCoordOpacity;
        } else {
          coord.opacity = config.maxCoordOpacity;
        }

        if (coord.age >= coord.lifetime) {
          state.coords.splice(i, 1);
          continue;
        }

        const textColor = isDark
          ? `rgba(103, 232, 249, ${coord.opacity})`
          : `rgba(8, 145, 178, ${coord.opacity})`;

        ctx.font = `${coord.fontSize}px ${COORD_FONT_FAMILY}`;
        ctx.fillStyle = textColor;
        ctx.fillText(formatCoord(coord.lat, coord.lon), coord.x, coord.y);
      }

      /* ── Spawn périodique ── */
      state.frameCount++;

      if (state.frameCount % config.ringSpawnInterval === 0 && state.nodes.length > 0) {
        const sourceNode = state.nodes[randomInt(0, state.nodes.length - 1)];
        const ringColor  = ringColors[randomInt(0, ringColors.length - 1)];
        state.rings.push({
          x:         sourceNode.x,
          y:         sourceNode.y,
          radius:    sourceNode.radius,
          maxRadius: randomBetween(60, 130),
          speed:     randomBetween(0.7, 1.4),
          opacity:   config.maxRingOpacity,
          color:     ringColor,
        });
      }

      if (state.frameCount % config.coordSpawnInterval === 0) {
        state.coords.push(makeCoord(width, height));
      }
    },
    [isDark],
  );

  const startLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const config     = isDark ? DARK_CONFIG  : LIGHT_CONFIG;
    const palette    = isDark ? DARK_PALETTE : LIGHT_PALETTE;
    const ringColors = isDark ? DARK_RING_COLORS : LIGHT_RING_COLORS;
    const state      = stateRef.current;

    const loop = (timestamp: number) => {
      /* Cap 60fps via delta time */
      const delta = timestamp - state.lastTime;
      if (delta >= 14) {
        state.lastTime = timestamp;
        drawFrame(ctx, config, palette, ringColors);
      }
      state.animId = requestAnimationFrame(loop);
    };

    state.animId = requestAnimationFrame(loop);
  }, [isDark, drawFrame]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state  = stateRef.current;
    const dpr    = window.devicePixelRatio || 1;
    const width  = window.innerWidth;
    const height = window.innerHeight;

    canvas.width  = width  * dpr;
    canvas.height = height * dpr;
    canvas.style.width  = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);

    state.width  = width;
    state.height = height;

    const config = isDark ? DARK_CONFIG : LIGHT_CONFIG;

    state.nodes  = Array.from({ length: config.nodeCount }, () => makeNode(width, height));
    state.coords = Array.from({ length: 3 }, () => makeCoord(width, height));
    state.rings  = [];
    state.frameCount = 0;
    state.lastTime   = 0;
  }, [isDark]);

  useEffect(() => {
    /* Arrêt propre d'une éventuelle boucle précédente */
    cancelAnimationFrame(stateRef.current.animId);

    initCanvas();
    startLoop();

    const handleResize = () => {
      cancelAnimationFrame(stateRef.current.animId);
      initCanvas();
      startLoop();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(stateRef.current.animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [isDark, initCanvas, startLoop]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      "fixed",
        inset:         0,
        zIndex:        0,
        pointerEvents: "none",
        display:       "block",
      }}
    />
  );
}
