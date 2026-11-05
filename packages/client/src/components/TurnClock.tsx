import { motion } from "framer-motion";
export function TurnClock({
  seconds,
  turn,
}: {
  seconds: number;
  turn: string;
}) {
  if (!seconds) return null;
  return (
    <motion.span
      key={turn}
      className="turn-clock"
      aria-label={`${seconds} second turn timer`}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: seconds, ease: "linear" }}
    >
      <svg viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="42 15"
        />
      </svg>
    </motion.span>
  );
}
