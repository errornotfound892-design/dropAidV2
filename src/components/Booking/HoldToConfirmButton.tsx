import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Siren, AlertTriangle, ShieldCheck } from 'lucide-react';
import { emergencyAudio } from '../../services/audioService.ts';

interface HoldToConfirmButtonProps {
  onConfirm: () => void;
  onHoldStart?: () => void;
  disabled?: boolean;
  destinationName?: string;
  className?: string;
  buttonSize?: number;
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
  onConfirm,
  onHoldStart,
  disabled = false,
  destinationName,
  className = '',
  buttonSize = 210,
}) => {
  const HOLD_DURATION_MS = 5000;
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isHolding, setIsHolding] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [justCancelled, setJustCancelled] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tickCounterRef = useRef<number>(0);
  const hasFiredConfirmRef = useRef<boolean>(false);
  const isCompletedRef = useRef<boolean>(false);

  const cancelHold = useCallback(() => {
    if (isCompletedRef.current || hasFiredConfirmRef.current) return;
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (isHolding) {
      setIsHolding(false);
      setProgress(0);
      setElapsedSec(0);
      setJustCancelled(true);
      setTimeout(() => setJustCancelled(false), 2400);
    }
  }, [isHolding]);

  const step = useCallback(
    (timestamp: number) => {
      if (hasFiredConfirmRef.current) return;
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      const seconds = Math.min(5.0, Number((elapsed / 1000).toFixed(1)));

      setProgress(pct);
      setElapsedSec(seconds);

      // Play soft tactile tick every ~400ms
      const currentTick = Math.floor(elapsed / 400);
      if (currentTick > tickCounterRef.current) {
        tickCounterRef.current = currentTick;
        emergencyAudio.playHoldTick(400 + currentTick * 50, 0.05);
      }

      if (elapsed >= HOLD_DURATION_MS) {
        if (!hasFiredConfirmRef.current) {
          hasFiredConfirmRef.current = true;
          isCompletedRef.current = true;
          if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
            requestRef.current = null;
          }
          setIsHolding(false);
          setIsCompleted(true);
          emergencyAudio.playDispatchConfirmed();
          onConfirm();
        }
      } else {
        requestRef.current = requestAnimationFrame(step);
      }
    },
    [onConfirm]
  );

  const startHold = useCallback(
    (e: React.SyntheticEvent) => {
      if (disabled || isCompletedRef.current || hasFiredConfirmRef.current) return;
      e.preventDefault();
      setIsHolding(true);
      setJustCancelled(false);
      startTimeRef.current = null;
      tickCounterRef.current = 0;
      onHoldStart?.();
      requestRef.current = requestAnimationFrame(step);
    },
    [disabled, onHoldStart, step]
  );

  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Reset completion state ONLY if disabled was true and now false AND no completed hold was fired
  useEffect(() => {
    if (!disabled && !hasFiredConfirmRef.current) {
      isCompletedRef.current = false;
      setIsCompleted(false);
      setProgress(0);
      setElapsedSec(0);
      setIsHolding(false);
    }
  }, [disabled]);

  // SVG ring calculations
  const size = buttonSize;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      {/* Outer Glow Wrapper */}
      <div className="relative group">
        {/* Subtle Ambient Pulse when hovering */}
        <div
          className={`absolute -inset-2 rounded-full transition-all duration-300 pointer-events-none ${
            isHolding
              ? 'bg-rose-500/30 scale-105 blur-md'
              : 'bg-rose-500/10 group-hover:bg-rose-500/20 blur-sm'
          }`}
        />

        {/* Circular Progress SVG Canvas */}
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 pointer-events-none z-10"
        >
          {/* Background circle track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e2e8f0"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Animated active progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e11d48"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="transparent"
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
              transition: isHolding ? 'none' : 'stroke-dashoffset 200ms ease-out',
            }}
          />
        </svg>

        {/* Center Circular Button */}
        <button
          type="button"
          disabled={disabled || isCompleted}
          onMouseDown={startHold}
          onMouseUp={cancelHold}
          onMouseLeave={cancelHold}
          onTouchStart={startHold}
          onTouchEnd={cancelHold}
          onTouchCancel={cancelHold}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') startHold(e);
          }}
          onKeyUp={cancelHold}
          aria-label="Hold for 5 seconds to dispatch emergency ambulance"
          className={`absolute inset-3 rounded-full flex flex-col items-center justify-center text-white transition-all transform active:scale-95 shadow-xl cursor-pointer ${
            disabled
              ? 'bg-slate-400 cursor-not-allowed opacity-75'
              : isHolding
              ? 'bg-rose-700 shadow-rose-900/50 scale-98'
              : isCompleted
              ? 'bg-emerald-600 shadow-emerald-900/30'
              : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/40'
          }`}
        >
          {isCompleted ? (
            <>
              <ShieldCheck className="w-10 h-10 mb-1 text-white" />
              <span className="text-xs font-bold uppercase tracking-wider">Dispatched</span>
            </>
          ) : isHolding ? (
            <>
              <span className="text-2xl font-extrabold font-mono tabular-nums leading-none mb-1">
                {(5.0 - elapsedSec).toFixed(1)}s
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-100">
                Hold Firmly
              </span>
            </>
          ) : (
            <>
              <Siren className="w-9 h-9 mb-1 text-white animate-bounce-subtle" />
              <span className="text-sm font-extrabold uppercase tracking-wide text-center px-3 leading-tight">
                Hold 5s
              </span>
              <span className="text-[10px] font-medium text-rose-100 uppercase tracking-wider mt-0.5">
                To Dispatch
              </span>
            </>
          )}
        </button>
      </div>

      {/* Safety Hold Guidance */}
      <div className="mt-3 text-center min-h-[3rem]">
        {justCancelled ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Hold released early. Continuous 5s hold prevents accidental calls.</span>
          </div>
        ) : isHolding ? (
          <div className="text-xs font-semibold text-rose-600 animate-pulse">
            Keep holding to send high-priority alert to Metro Dispatch...
          </div>
        ) : null}
      </div>
    </div>
  );
};
