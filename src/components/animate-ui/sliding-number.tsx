import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SlidingNumberProps {
  value: number;
}

export function SlidingNumber({ value }: SlidingNumberProps) {
  const [digits, setDigits] = useState<string[]>([]);

  useEffect(() => {
    setDigits(value.toString().split(""));
  }, [value]);

  return (
    <div className="flex overflow-hidden font-mono text-3xl font-bold text-blue-600">
      <AnimatePresence mode="popLayout">
        {digits.map((digit, idx) => (
          <motion.span
            key={`${idx}-${digit}`}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 250, damping: 20 }}
          >
            {digit}
          </motion.span>
        ))}
        /</AnimatePresence>
    </div >
  );
}