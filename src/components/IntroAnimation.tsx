import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence, useAnimationControls } from "motion/react";
import { ArrowRight, Sparkles, Zap, Shield, Layers3 } from "lucide-react";
import { cn } from "@/src/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntroAnimationProps {
  onComplete: () => void;
  isFirstTime?: boolean;
}

interface GeoCoordParticle {
  id: number;
  label: string;
  left: number;   // vw %
  delay: number;  // seconds
  duration: number;
  size: number;   // rem
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_LABELS = [
  "48.8°N", "2.3°E", "WGS84", "EPSG:4326",
  "45.7°N", "4.8°E", "EPSG:2154", "Lambert 93",
  "51.5°N", "0.1°W", "GRS80", "NAD83",
  "UTM 31N", "43.3°N", "1.4°E", "EPSG:32631",
  "IGNF:LAMB93", "RGF93", "90°W", "12°S",
];

const COLOR_MAP = {
  emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-500", ring: "border-emerald-500/25", glow: "shadow-emerald-500/20" },
  sky:     { bg: "bg-sky-500/15",     border: "border-sky-500/30",     dot: "bg-sky-500",     ring: "border-sky-500/25",     glow: "shadow-sky-500/20"     },
  amber:   { bg: "bg-amber-500/15",   border: "border-amber-500/30",   dot: "bg-amber-500",   ring: "border-amber-500/25",   glow: "shadow-amber-500/20"   },
  violet:  { bg: "bg-violet-500/15",  border: "border-violet-500/30",  dot: "bg-violet-500",  ring: "border-violet-500/25",  glow: "shadow-violet-500/20"  },
} as const;

type SlideColor = keyof typeof COLOR_MAP;

// ─── Sub-components ───────────────────────────────────────────────────────────

function buildParticles(): GeoCoordParticle[] {
  return GEO_LABELS.map((label, index) => ({
    id: index,
    label,
    left: 4 + (index * 4.7) % 92,
    delay: (index * 0.8) % 6,
    duration: 14 + (index * 1.3) % 10,
    size: 0.6 + (index % 3) * 0.1,
  }));
}

function GeoCoordBackground() {
  const particles = useRef<GeoCoordParticle[]>(buildParticles());

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.current.map((p) => (
        <motion.span
          key={p.id}
          className="absolute font-mono text-white select-none"
          style={{
            left: `${p.left}%`,
            bottom: "-2rem",
            fontSize: `${p.size}rem`,
            opacity: 0.04,
            letterSpacing: "0.05em",
          }}
          animate={{ y: [0, -800] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        >
          {p.label}
        </motion.span>
      ))}
    </div>
  );
}

interface SlideIconProps {
  icon: ReactNode;
  color: SlideColor;
}

function SlideIcon({ icon, color }: SlideIconProps) {
  const colors = COLOR_MAP[color];

  return (
    <div className="relative flex justify-center mb-6">
      {/* Outer rotating ring */}
      <motion.div
        className={cn(
          "absolute top-1/2 left-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 opacity-30",
          colors.ring,
        )}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />

      {/* Icon container with entrance animation */}
      <motion.div
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-2xl border",
          colors.bg,
          colors.border,
        )}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: [0.5, 1.1, 1], opacity: [0, 1, 1] }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.7, 1] }}
      >
        {icon}
      </motion.div>
    </div>
  );
}

interface ProgressDotsProps {
  total: number;
  current: number;
  colorKey: SlideColor;
}

function ProgressDots({ total, current, colorKey }: ProgressDotsProps) {
  const colors = COLOR_MAP[colorKey];

  return (
    <div className="mt-8 flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={cn(
            "h-1.5 rounded-full",
            current === index ? colors.dot : "bg-white/15",
          )}
          animate={
            current === index
              ? { width: 24, scale: [1, 1.3, 1] }
              : { width: 6, scale: 1 }
          }
          transition={
            current === index
              ? { duration: 0.35, ease: "easeOut", scale: { duration: 0.4, times: [0, 0.5, 1] } }
              : { duration: 0.3, ease: "easeOut" }
          }
        />
      ))}
    </div>
  );
}

interface NextButtonProps {
  isLast: boolean;
  onClick: () => void;
}

function NextButton({ isLast, onClick }: NextButtonProps) {
  const glowControls = useAnimationControls();

  // Trigger a glow pulse loop on the last slide
  useEffect(() => {
    if (isLast) {
      void glowControls.start({
        boxShadow: [
          "0 0 0px 0px rgba(16,185,129,0)",
          "0 0 18px 4px rgba(16,185,129,0.35)",
          "0 0 0px 0px rgba(16,185,129,0)",
        ],
        transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
      });
    } else {
      glowControls.stop();
    }
  }, [isLast, glowControls]);

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold",
        isLast
          ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/60",
      )}
      animate={glowControls}
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {isLast ? "Commencer" : "Suivant"}
      <ArrowRight size={14} />
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IntroAnimation({ onComplete, isFirstTime = false }: IntroAnimationProps) {
  const [step, setStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  const slides = [
    {
      icon: <Sparkles size={48} className="text-emerald-400" />,
      title: "Bienvenue sur QGISAI+",
      description: "Votre assistant intelligent pour QGIS",
      color: "emerald" as SlideColor,
    },
    {
      icon: <Layers3 size={48} className="text-sky-400" />,
      title: "Données géographiques",
      description: "Accédez aux sources officielles IGN, Copernicus, et plus encore",
      color: "sky" as SlideColor,
    },
    {
      icon: <Zap size={48} className="text-amber-400" />,
      title: "Automatisation intelligente",
      description: "L'IA génère et exécute automatiquement vos scripts PyQGIS",
      color: "amber" as SlideColor,
    },
    {
      icon: <Shield size={48} className="text-violet-400" />,
      title: "Sécurité locale",
      description: "Vos données restent sur votre machine, rien n'est envoyé dans le cloud",
      color: "violet" as SlideColor,
    },
  ];

  const triggerExit = () => {
    if (isFirstTime) {
      localStorage.setItem("qgisia-intro-seen", "true");
    }
    setIsExiting(true);
    setTimeout(() => onComplete(), 400);
  };

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      triggerExit();
    }
  };

  const handleSkip = () => {
    triggerExit();
  };

  useEffect(() => {
    if (!isFirstTime) {
      const timer = setTimeout(() => triggerExit(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime]);

  const currentSlide = slides[step];

  return (
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div
          key="intro-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#131314]"
        >
          {/* Floating geo coordinates background */}
          <GeoCoordBackground />

          {/* Subtle radial gradient overlay for depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />

          <div className="relative z-10 w-full max-w-lg px-4">
            {/* Logo bar */}
            <motion.div
              className="flex items-center justify-between mb-6"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.35 }}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                  <Sparkles size={16} className="text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-white/50">QGISAI+</span>
              </div>

              {isFirstTime && (
                <motion.button
                  onClick={handleSkip}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1"
                  whileHover={{ opacity: 1 }}
                >
                  Passer
                </motion.button>
              )}
            </motion.div>

            {/* Card */}
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
            >
              {/* Slide content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -18 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="text-center"
                >
                  <SlideIcon icon={currentSlide.icon} color={currentSlide.color} />

                  <h2 className="mb-3 text-2xl font-bold text-white">
                    {currentSlide.title}
                  </h2>
                  <p className="text-sm text-white/50 leading-relaxed">
                    {currentSlide.description}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress dots */}
              <ProgressDots total={slides.length} current={step} colorKey={currentSlide.color} />

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-center">
                <NextButton isLast={step === slides.length - 1} onClick={handleNext} />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
