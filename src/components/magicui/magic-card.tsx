"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MagicCardProps {
  className?: string;
  children: React.ReactNode;
}

export const MagicCard = ({ className, children }: MagicCardProps) => {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 240, damping: 20 }}
      className={cn(
        "group relative overflow-hidden rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/75 dark:shadow-[0_18px_45px_rgba(2,6,23,0.45)]",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl border border-transparent bg-gradient-to-br from-sky-100/0 via-sky-100/0 to-blue-200/0 transition duration-300 group-hover:from-sky-200/45 group-hover:via-cyan-100/15 group-hover:to-blue-200/40 dark:group-hover:from-sky-500/25 dark:group-hover:via-cyan-400/10 dark:group-hover:to-indigo-500/20" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
