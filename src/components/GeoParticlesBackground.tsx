/**
 * NebulaBackground — Fond nébuleuse inspiré de Gemini "stitch_nebula".
 *
 * Canvas 2D. Des orbes de lumière diffuse (bleu / indigo / violet / cyan)
 * flottent lentement, se fondent les uns dans les autres, créant un effet
 * de nébuleuse cosmique qui "respire". Discret, élégant, jamais distrayant.
 *
 * Props :
 *   isDark — true = dark mode (opacités vives), false = light (très atténué)
 */

import { useEffect, useRef, useCallback } from "react";

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Orb {
  x: number;
  y: number;
  /** Position cible vers laquelle l'orbe dérive */
  tx: number;
  ty: number;
  radius: number;
  /** Couleur HSL — teinte dans la gamme bleu→violet */
  hue: number;
  /** Saturation */
  sat: number;
  /** Phase de pulsation [0, 2π] */
  pulsePhase: number;
  pulseSpeed: number;
  /** Vitesse de déplacement (px/frame) */
  speed: number;
  /** Opacité de base [0, 1] */
  alpha: number;
}

/* ─── Config ──────────────────────────────────────────────────────────── */

const ORB_COUNT      = 7;   // Nombre d'orbes simultanés
const MIN_RADIUS     = 180; // px — rayon du gradient radial
const MAX_RADIUS     = 420;
const MAX_ALPHA_DARK  = 0.22; // opacité max en dark mode
const MAX_ALPHA_LIGHT = 0.09; // opacité max en light mode — très discret
const DRIFT_SPEED_MIN = 0.15; // px/frame
const DRIFT_SPEED_MAX = 0.45;
const PULSE_MIN       = 0.008;
const PULSE_MAX       = 0.018;

/* ─── Palette : teintes bleues/indigo/violet/cyan ─────────────────────── */
//   220 = bleu roi · 240 = indigo · 260 = violet · 200 = cyan-bleu
const HUE_RANGE: [number, number] = [195, 275];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function makeOrb(width: number, height: number): Orb {
  const x = rand(0, width);
  const y = rand(0, height);
  return {
    x,
    y,
    tx: rand(0, width),
    ty: rand(0, height),
    radius:     rand(MIN_RADIUS, MAX_RADIUS),
    hue:        rand(...HUE_RANGE),
    sat:        rand(70, 100),
    pulsePhase: rand(0, Math.PI * 2),
    pulseSpeed: rand(PULSE_MIN, PULSE_MAX),
    speed:      rand(DRIFT_SPEED_MIN, DRIFT_SPEED_MAX),
    alpha:      rand(0.4, 1.0),
  };
}

/* ─── Composant ───────────────────────────────────────────────────────── */

interface NebulaBackgroundProps {
  isDark: boolean;
}

export default function GeoParticlesBackground({ isDark }: NebulaBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const stateRef = useRef<{
    orbs:    Orb[];
    animId:  number;
    width:   number;
    height:  number;
  }>({ orbs: [], animId: 0, width: 0, height: 0 });

  /* ── Rendu d'une frame ─────────────────────────────────────────────── */
  const drawFrame = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const { orbs, width, height } = stateRef.current;
      const maxAlpha = isDark ? MAX_ALPHA_DARK : MAX_ALPHA_LIGHT;

      // Efface avec un fondu très léger pour un effet de traîne douce
      ctx.fillStyle = isDark
        ? "rgba(12, 13, 16, 0.06)"
        : "rgba(240, 244, 248, 0.06)";
      ctx.fillRect(0, 0, width, height);

      for (const orb of orbs) {
        // ── Mise à jour de la position (dérive vers la cible) ──────────
        const dx = orb.tx - orb.x;
        const dy = orb.ty - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
          // Nouvelle cible aléatoire quand l'orbe arrive
          orb.tx = rand(orb.radius * 0.3, width  - orb.radius * 0.3);
          orb.ty = rand(orb.radius * 0.3, height - orb.radius * 0.3);
        } else {
          orb.x += (dx / dist) * orb.speed;
          orb.y += (dy / dist) * orb.speed;
        }

        // ── Pulsation de l'opacité ─────────────────────────────────────
        orb.pulsePhase = (orb.pulsePhase + orb.pulseSpeed) % (Math.PI * 2);
        const pulse = 0.5 + 0.5 * Math.sin(orb.pulsePhase);
        const alpha = orb.alpha * pulse * maxAlpha;

        // ── Dessin : gradient radial (orbe diffus) ─────────────────────
        const gradient = ctx.createRadialGradient(
          orb.x, orb.y, 0,
          orb.x, orb.y, orb.radius,
        );

        // Centre lumineux
        gradient.addColorStop(
          0,
          `hsla(${orb.hue}, ${orb.sat}%, 70%, ${alpha})`,
        );
        // Milieu — teinte légèrement décalée pour un effet nébuleuse
        gradient.addColorStop(
          0.4,
          `hsla(${orb.hue + 15}, ${orb.sat - 10}%, 55%, ${alpha * 0.55})`,
        );
        // Bord — fondu total
        gradient.addColorStop(1, `hsla(${orb.hue}, ${orb.sat}%, 50%, 0)`);

        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    },
    [isDark],
  );

  /* ── Boucle d'animation ────────────────────────────────────────────── */
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    drawFrame(ctx);
    stateRef.current.animId = requestAnimationFrame(animate);
  }, [drawFrame]);

  /* ── Setup et resize ───────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      if (!canvas) return;
      const w = canvas.offsetWidth  || window.innerWidth;
      const h = canvas.offsetHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width  = w * dpr;
      canvas.height = h * dpr;

      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);

      stateRef.current.width  = w;
      stateRef.current.height = h;

      // Initialiser les orbes avec des positions éparpillées
      stateRef.current.orbs = Array.from({ length: ORB_COUNT }, () => makeOrb(w, h));
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
      style={{ mixBlendMode: isDark ? "screen" : "multiply" }}
    />
  );
}
