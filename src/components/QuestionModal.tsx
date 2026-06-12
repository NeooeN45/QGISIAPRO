/**
 * Modal QCM pour l'outil ask_user (pause/reprise agent).
 * Affiche une question avec des options radio + bouton valider.
 */
import React, { useCallback, useEffect, useState } from "react";

export interface QuestionModalProps {
  question: string;
  options: string[];
  onSelect: (selectedOption: string) => void;
  onCancel?: () => void;
}

export default function QuestionModal({
  question,
  options,
  onSelect,
  onCancel,
}: QuestionModalProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = useCallback(
    (option: string) => setSelected(option),
    [],
  );

  const handleSubmit = useCallback(() => {
    if (selected) {
      onSelect(selected);
    }
  }, [selected, onSelect]);

  // Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onCancel) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ask-user-question"
      data-testid="question-modal"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-[#17181b] p-6 shadow-2xl">
        <h2
          id="ask-user-question"
          className="mb-4 text-base font-semibold text-white"
        >
          {question}
        </h2>

        <div className="mb-6 space-y-2">
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06] has-[:checked]:border-white/20 has-[:checked]:bg-white/[0.08]"
            >
              <input
                type="radio"
                name="ask-user-option"
                value={option}
                checked={selected === option}
                onChange={() => handleSelect(option)}
                className="h-4 w-4 accent-white"
                data-testid={`option-${option}`}
              />
              <span className="text-sm text-white/80">{option}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            disabled={!selected}
            onClick={handleSubmit}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="submit-answer"
          >
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
