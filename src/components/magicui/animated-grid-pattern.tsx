"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  className?: string;
}

export const AnimatedGridPattern = ({
  className,
}: AnimatedGridPatternProps) => {
  return (
    <motion.div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px)",
        backgroundSize: "38px 38px",
      }}
      animate={{ backgroundPosition: ["0px 0px", "38px 38px"] }}
      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
    />
  );
};
