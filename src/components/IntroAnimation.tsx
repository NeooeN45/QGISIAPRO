import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ArrowRight, Sparkles, Zap, Shield, Layers3 } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface IntroAnimationProps {
  onComplete: () => void;
  isFirstTime?: boolean;
}

export default function IntroAnimation({ onComplete, isFirstTime = false }: IntroAnimationProps) {
  const [step, setStep] = useState(0);
  const [isSkipped, setIsSkipped] = useState(false);

  const slides = [
    {
      icon: <Sparkles size={48} className="text-emerald-400" />,
      title: "Bienvenue sur QGISAI+",
      description: "Votre assistant intelligent pour QGIS",
      color: "emerald",
    },
    {
      icon: <Layers3 size={48} className="text-sky-400" />,
      title: "Données géographiques",
      description: "Accédez aux sources officielles IGN, Copernicus, et plus encore",
      color: "sky",
    },
    {
      icon: <Zap size={48} className="text-amber-400" />,
      title: "Automatisation intelligente",
      description: "L'IA génère et exécute automatiquement vos scripts PyQGIS",
      color: "amber",
    },
    {
      icon: <Shield size={48} className="text-violet-400" />,
      title: "Sécurité locale",
      description: "Vos données restent sur votre machine, rien n'est envoyé dans le cloud",
      color: "violet",
    },
  ];

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      if (isFirstTime) {
        localStorage.setItem("qgisia-intro-seen", "true");
      }
      setIsSkipped(true);
      setTimeout(() => onComplete(), 300);
    }
  };

  const handleSkip = () => {
    if (isFirstTime) {
      localStorage.setItem("qgisia-intro-seen", "true");
    }
    setIsSkipped(true);
    setTimeout(() => onComplete(), 300);
  };

  useEffect(() => {
    if (!isFirstTime) {
      // Auto-skip after 2 seconds if not first time
      const timer = setTimeout(() => {
        setIsSkipped(true);
        setTimeout(() => onComplete(), 300);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isFirstTime, onComplete]);

  const colorMap: Record<string, { bg: string; border: string; dot: string }> = {
    emerald: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", dot: "bg-emerald-500" },
    sky:     { bg: "bg-sky-500/15",     border: "border-sky-500/30",     dot: "bg-sky-500"     },
    amber:   { bg: "bg-amber-500/15",   border: "border-amber-500/30",   dot: "bg-amber-500"   },
    violet:  { bg: "bg-violet-500/15",  border: "border-violet-500/30",  dot: "bg-violet-500"  },
  };

  return (
    <AnimatePresence mode="wait">
      {!isSkipped && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#131314] dark:bg-[#131314]"
        >
          <div className="absolute inset-0 bg-mesh" />

          <div className="relative z-10 w-full max-w-lg px-4">
            {/* Logo bar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
                  <Sparkles size={16} className="text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-white/50">QGISAI+</span>
              </div>
              {isFirstTime && (
                <button
                  onClick={handleSkip}
                  className="text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1"
                >
                  Passer
                </button>
              )}
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-xl p-8">
              <AnimatePresence mode="wait">
                {slides.map((slide, index) =>
                  step === index ? (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -16 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="text-center"
                    >
                      <div className="mb-6 flex justify-center">
                        <div className={cn(
                          "flex h-20 w-20 items-center justify-center rounded-2xl border",
                          colorMap[slide.color].bg,
                          colorMap[slide.color].border
                        )}>
                          {slide.icon}
                        </div>
                      </div>
                      <h2 className="mb-3 text-2xl font-bold text-white">
                        {slide.title}
                      </h2>
                      <p className="text-sm text-white/50 leading-relaxed">
                        {slide.description}
                      </p>
                    </motion.div>
                  ) : null
                )}
              </AnimatePresence>

              {/* Progress dots */}
              <div className="mt-8 flex items-center justify-center gap-1.5">
                {slides.map((_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      step === index
                        ? `w-6 ${colorMap[slides[step].color].dot}`
                        : "w-1.5 bg-white/15"
                    )}
                  />
                ))}
              </div>

              {/* Navigation */}
              <div className="mt-6 flex items-center justify-center">
                <button
                  onClick={handleNext}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-6 py-2.5 text-sm font-semibold transition-all",
                    step === slides.length - 1
                      ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/18"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {step === slides.length - 1 ? "Commencer" : "Suivant"}
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
