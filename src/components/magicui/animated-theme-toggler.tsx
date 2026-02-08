"use client";

import { MouseEvent, useState } from "react";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const STORAGE_KEY = "mindprint-theme";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void | Promise<void>) => {
    ready: Promise<void>;
  };
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
};

const getCurrentTheme = (): Theme => {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
};

interface AnimatedThemeTogglerProps {
  className?: string;
  duration?: number;
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
}: AnimatedThemeTogglerProps) => {
  const [tick, setTick] = useState(0);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    const next: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const doc = document as ViewTransitionDocument;
    const transitionApi = doc.startViewTransition;

    const commit = () => {
      applyTheme(next);
      setTick((value) => value + 1);
    };

    if (typeof transitionApi !== "function" || prefersReducedMotion) {
      commit();
      return;
    }

    try {
      const transition = transitionApi.call(doc, () => {
        applyTheme(next);
      });

      transition.ready
        .then(() => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const endRadius = Math.hypot(
            Math.max(x, window.innerWidth - x),
            Math.max(y, window.innerHeight - y),
          );

          try {
            const animate = document.documentElement.animate?.bind(
              document.documentElement,
            );
            if (!animate) {
              setTick((value) => value + 1);
              return;
            }

            animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration,
                easing: "ease-in-out",
                pseudoElement: "::view-transition-new(root)",
              },
            );
          } catch {
            // If pseudoElement animation is unavailable (e.g. SES/locked env), theme is still applied.
            setTick((value) => value + 1);
          }
        })
        .catch(() => {
          commit();
        });

      setTick((value) => value + 1);
    } catch {
      commit();
    }
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400",
        className,
      )}
    >
      <motion.span
        key={tick}
        initial={{ rotate: -55, scale: 0.72, opacity: 0.45 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        transition={{ duration: Math.max(0.12, (duration / 1000) * 0.5) }}
        className="relative inline-flex items-center justify-center"
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="hidden h-4 w-4 dark:block" />
      </motion.span>
    </button>
  );
};
