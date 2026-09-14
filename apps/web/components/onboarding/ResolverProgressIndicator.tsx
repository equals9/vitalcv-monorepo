'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Check, Loader2 } from 'lucide-react';

/**
 * ResolverProgressIndicator — the paced hand-off sequence shown while the
 * flow moves to its next step.
 *
 * REGISTER (design-only, 2026-08-16): recomposed from the dark emerald
 * treatment into the Direction A `.oba` island (mono step words in ink, a
 * signal-indigo pacing hairline, no green fills — green means
 * source-confirmed only, and these steps are pacing, not source results).
 * The step timer contract is unchanged: same default duration, same
 * `onComplete` timing, same four steps.
 *
 * Truth posture (pre-existing, unchanged by the register pass): the sequence
 * advances on a timer — it paces a transition and does not report per-source
 * results. The words are deliberately process words ("Recognizing",
 * "Reading"), never state words, and no glyph here is a state marker.
 */

export interface ResolverStep {
  id: string;
  label: string;
}

const DEFAULT_STEPS: ResolverStep[] = [
  { id: 'npi', label: 'Recognizing' },
  { id: 'safety', label: 'Reading' },
  { id: 'readiness', label: 'Building' },
  { id: 'handoff', label: 'Opening' },
];

export function ResolverProgressIndicator({
  onComplete,
  durationPerStep = 540,
}: {
  onComplete?: () => void;
  durationPerStep?: number;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex >= DEFAULT_STEPS.length) {
      setTimeout(() => {
        onComplete?.();
      }, 300); // short delay before transition
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStepIndex((prev) => prev + 1);
    }, durationPerStep);

    return () => clearTimeout(timer);
  }, [currentStepIndex, durationPerStep, onComplete]);

  return (
    <div className="oba-resolver w-full max-w-md" role="status" aria-live="polite">
      {DEFAULT_STEPS.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;

        return (
          <div
            key={step.id}
            className={`oba-res-row${index > currentStepIndex ? ' is-pending' : ''}`}
          >
            <span className="oba-res-g" aria-hidden>
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : isCurrent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
            </span>
            <span className="oba-res-label">
              {step.label}
              {isCompleted ? <span className="sr-only"> — done</span> : null}
              {isCurrent ? <span className="sr-only"> — in progress</span> : null}
            </span>
            {isCurrent ? (
              <PaceLine key={`pace-${step.id}`} durationMs={durationPerStep} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The current row's pacing hairline: grows once over the step duration.
 * Decorative — the row's word + glyph carry the state (EC-4); reduced motion
 * kills the transition and the finished row stands.
 */
function PaceLine({ durationMs }: { durationMs: number }) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setGrown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  return (
    <span
      className="oba-res-pace"
      aria-hidden
      style={{
        transform: grown ? 'scaleX(1)' : 'scaleX(0)',
        transition: `transform ${Math.max(0, durationMs)}ms linear`,
      }}
    />
  );
}
