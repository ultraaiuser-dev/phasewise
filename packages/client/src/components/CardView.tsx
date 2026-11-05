import React, { memo } from "react";
import { Card, CardColor } from "@phasewise/shared";

interface CardViewProps {
  card: Card;
  isSelected?: boolean;
  isContributing?: boolean;
  isDimmed?: boolean;
  isHittable?: boolean;
  onClick?: () => void;
  small?: boolean;
  mini?: boolean;
  label?: string;
  disabled?: boolean;
  className?: string;
  representedValue?: number;
  representedColor?: CardColor;
}

export const ColorSymbols: Record<
  CardColor,
  { symbol: string; label: string; bg: string; text: string }
> = {
  red: { symbol: "●", label: "Circle", bg: "bg-red-600", text: "text-red-700" },
  blue: {
    symbol: "◆",
    label: "Diamond",
    bg: "bg-blue-600",
    text: "text-blue-700",
  },
  green: {
    symbol: "▲",
    label: "Triangle",
    bg: "bg-emerald-600",
    text: "text-emerald-700",
  },
  yellow: {
    symbol: "★",
    label: "Star",
    bg: "bg-amber-500",
    text: "text-amber-700",
  },
};

export const CardView = memo(function CardView({
  card,
  isSelected,
  isContributing,
  isDimmed,
  isHittable,
  onClick,
  small = false,
  mini = false,
  label,
  disabled = false,
  className = "",
  representedValue,
  representedColor,
}: CardViewProps) {
  const isWild = card.type === "wild";
  const isSkip = card.type === "skip";

  // Effective color & value (if Wild has represented values)
  const displayColor = representedColor || card.color;
  const displayValue =
    representedValue !== undefined ? representedValue : card.value;

  // Build ARIA description
  let ariaLabel = "";
  if (isWild) {
    ariaLabel = representedValue
      ? `Wild card representing ${representedValue}`
      : "Wild card";
  } else if (isSkip) {
    ariaLabel = "Skip card";
  } else {
    const symbolInfo = displayColor ? ColorSymbols[displayColor] : undefined;
    ariaLabel = `${displayValue} of ${displayColor} [${symbolInfo?.label || ""}]`;
  }

  // Base card sizing
  const sizeClasses = mini ? "card-mini" : small ? "card-table" : "card-hand";

  // Border & Glow
  let stateClasses = "border-2 border-slate-300/40 shadow-md";
  if (isSelected) {
    stateClasses =
      "border-amber-400 ring-4 ring-amber-400/60 shadow-xl -translate-y-3";
  } else if (isHittable) {
    stateClasses =
      "border-emerald-400 ring-2 ring-emerald-400/80 animate-pulse";
  } else if (isContributing) {
    stateClasses = "border-amber-300 ring-2 ring-amber-300/50 shadow-lg";
  }

  if (isDimmed) {
    stateClasses += " opacity-65 grayscale-[20%]";
  }

  return (
    <div
      role={onClick ? "button" : "img"}
      tabIndex={onClick && !disabled ? 0 : -1}
      aria-label={ariaLabel}
      aria-pressed={onClick ? !!isSelected : undefined}
      title={label || ariaLabel}
      data-card-id={card.id}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative overflow-hidden select-none flex flex-col justify-between p-1.5 transition-colors duration-150 cursor-pointer focus:outline-none focus:ring-4 focus:ring-white ${sizeClasses} ${stateClasses} ${className} bg-white text-slate-900 font-bold`}
      style={{ touchAction: onClick ? "none" : "manipulation" }}
    >
      {/* Top Corner: Number/Icon */}
      <div className="flex items-center justify-between leading-none">
        <span className="font-mono text-xs sm:text-sm tracking-tight">
          {isWild ? "W" : isSkip ? "S" : displayValue}
        </span>
        {displayColor && (
          <span
            className={`text-[10px] sm:text-xs ${ColorSymbols[displayColor].text}`}
            aria-hidden="true"
          >
            {ColorSymbols[displayColor].symbol}
          </span>
        )}
      </div>

      {/* Center Artwork / Emblem */}
      <div className="my-auto flex flex-col items-center justify-center pointer-events-none">
        {isWild && (
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 sm:w-8 sm:h-8 fill-purple-600 drop-shadow"
            >
              <path d="M12 2l2.4 7.4h7.6l-6.2 4.5 2.4 7.4-6.2-4.5-6.2 4.5 2.4-7.4-6.2-4.5h7.6z" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
              Wild
            </span>
            {representedValue && (
              <span className="text-[9px] font-mono text-purple-900">
                ({representedValue})
              </span>
            )}
          </div>
        )}

        {isSkip && (
          <div className="flex flex-col items-center">
            <svg
              viewBox="0 0 24 24"
              className="w-6 h-6 sm:w-8 sm:h-8 stroke-slate-700 fill-none stroke-[2.5]"
            >
              <circle cx="12" cy="12" r="9" />
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
              Skip
            </span>
          </div>
        )}

        {!isWild && !isSkip && displayColor && (
          <div className="flex flex-col items-center justify-center">
            <span
              className={`text-xl sm:text-3xl font-black font-mono leading-none ${ColorSymbols[displayColor].text}`}
            >
              {displayValue}
            </span>
            <span
              className={`text-sm sm:text-base ${ColorSymbols[displayColor].text}`}
              aria-hidden="true"
            >
              {ColorSymbols[displayColor].symbol}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Corner: Inverted Number/Icon */}
      <div className="flex items-center justify-between leading-none rotate-180">
        <span className="font-mono text-xs sm:text-sm tracking-tight">
          {isWild ? "W" : isSkip ? "S" : displayValue}
        </span>
        {displayColor && (
          <span
            className={`text-[10px] sm:text-xs ${ColorSymbols[displayColor].text}`}
            aria-hidden="true"
          >
            {ColorSymbols[displayColor].symbol}
          </span>
        )}
      </div>

      {/* Assist Mode sparkle badge */}
      {isContributing && !isDimmed && (
        <div
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow text-[10px] text-amber-950 font-bold"
          title="Contributes to your current phase"
        >
          ★
        </div>
      )}
    </div>
  );
});
