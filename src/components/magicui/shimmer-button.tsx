"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
}

export const ShimmerButton = ({
  className,
  children,
  ...props
}: ShimmerButtonProps) => {
  return (
    <button
      {...props}
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full border border-sky-300/40 bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_22px_rgba(14,165,233,0.35)] transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400",
        className,
      )}
    >
      <motion.span
        aria-hidden="true"
        className="absolute inset-y-0 -left-20 w-20 bg-gradient-to-r from-transparent via-white/45 to-transparent"
        animate={{ x: [0, 260] }}
        transition={{
          duration: 1.3,
          repeat: Infinity,
          repeatDelay: 1.2,
          ease: "easeInOut",
        }}
      />
      <span className="relative z-10">{children}</span>
    </button>
  );
};
