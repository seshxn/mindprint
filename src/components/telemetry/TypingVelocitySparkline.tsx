"use client";

import React, { useMemo } from "react";
import { TelemetryEvent } from "@/types/telemetry";
import { cn } from "@/lib/utils";

type TelemetryInput =
  | TelemetryEvent[]
  | { events: TelemetryEvent[] }
  | string
  | null
  | undefined;

interface TypingVelocitySparklineProps {
  data: TelemetryInput;
  width?: number | string;
  height?: number;
  bucketMs?: number;
  className?: string;
}

type VelocityPoint = {
  x: number;
  y: number;
};

const DEFAULT_WIDTH = 700;
const DEFAULT_HEIGHT = 120;
const DEFAULT_BUCKET_MS = 1000;
const PADDING = 10;

const parseTelemetry = (input: TelemetryInput): TelemetryEvent[] => {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) {
        return parsed as TelemetryEvent[];
      }
      if (parsed && Array.isArray(parsed.events)) {
        return parsed.events as TelemetryEvent[];
      }
    } catch (error) {
      console.error(
        "[TypingVelocitySparkline] Failed to parse telemetry data string:",
        error,
      );
      return [];
    }
  }

  if (typeof input === "object" && Array.isArray(input.events)) {
    return input.events;
  }

  return [];
};

const buildVelocitySeries = (events: TelemetryEvent[], bucketMs: number) => {
  const typingEvents = events.filter(
    (event) =>
      event.type === "keystroke" &&
      (event.action === "char" || event.action === "delete"),
  ) as Extract<TelemetryEvent, { type: "keystroke" }>[];

  if (typingEvents.length === 0) {
    return [];
  }

  const sorted = [...typingEvents].sort((a, b) => a.timestamp - b.timestamp);
  const start = sorted[0].timestamp;
  const end = sorted[sorted.length - 1].timestamp;
  const bucketCount = Math.max(1, Math.ceil((end - start) / bucketMs) + 1);
  const buckets = new Array(bucketCount).fill(0);

  for (const event of sorted) {
    const idx = Math.min(
      bucketCount - 1,
      Math.floor((event.timestamp - start) / bucketMs),
    );
    buckets[idx] += 1;
  }

  const perSecond = bucketMs / 1000;
  return buckets.map((count, index) => {
    const velocity = count / perSecond;
    return {
      time: start + index * bucketMs,
      velocity: Number.isFinite(velocity) ? velocity : 0,
    };
  });
};

const mapToPoints = (
  series: { time: number; velocity: number }[],
  width: number,
  height: number,
): VelocityPoint[] => {
  if (series.length === 0) {
    return [];
  }

  const usableWidth = width - PADDING * 2;
  const usableHeight = height - PADDING * 2;
  const maxVelocity = Math.max(...series.map((item) => item.velocity), 1);
  const minVelocity = 0;

  return series.map((item, index) => {
    const x =
      series.length === 1
        ? width / 2
        : PADDING + (index / (series.length - 1)) * usableWidth;
    const normalized =
      (item.velocity - minVelocity) / (maxVelocity - minVelocity);
    const y = PADDING + (1 - normalized) * usableHeight;
    return { x, y };
  });
};

const buildSmoothPath = (points: VelocityPoint[]) => {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M${points[0].x} ${points[0].y}`;
  }
  if (points.length === 2) {
    return `M${points[0].x} ${points[0].y} L${points[1].x} ${points[1].y}`;
  }

  let path = `M${points[0].x} ${points[0].y}`;

  // Use Catmull-Rom spline for smooth curves that pass through all points
  // For each segment, calculate control points using surrounding points
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Calculate control points for cubic bezier curve
    // This creates a smooth curve that passes through p1 and p2
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
};

const buildAreaPath = (points: VelocityPoint[], height: number) => {
  if (points.length === 0) {
    return "";
  }

  const linePath = buildSmoothPath(points);
  const bottomRight = `L${points[points.length - 1].x} ${height - PADDING}`;
  const bottomLeft = `L${points[0].x} ${height - PADDING}`;
  const close = "Z";

  return `${linePath} ${bottomRight} ${bottomLeft} ${close}`;
};

export const TypingVelocitySparkline = ({
  data,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  bucketMs = DEFAULT_BUCKET_MS,
  className,
}: TypingVelocitySparklineProps) => {
  const numericWidth = typeof width === "number" ? width : DEFAULT_WIDTH;
  const svgWidth = typeof width === "number" ? width : "100%";
  const {
    path,
    areaPath,
    points,
    maxVelocity,
    avgVelocity,
    currentVelocity,
    durationSeconds,
  } = useMemo(() => {
    try {
      const events = parseTelemetry(data);
      const series = buildVelocitySeries(events, bucketMs);
      const mappedPoints = mapToPoints(series, numericWidth, height);
      const maxValue =
        series.length === 0
          ? 0
          : Math.max(...series.map((item) => item.velocity));
      const avgValue =
        series.length === 0
          ? 0
          : series.reduce((sum, item) => sum + item.velocity, 0) /
            series.length;
      const currentValue =
        series.length === 0 ? 0 : series[series.length - 1].velocity;
      const duration =
        series.length > 1
          ? (series[series.length - 1].time - series[0].time) / 1000
          : 0;

      // Ensure all computed values are finite
      return {
        path: buildSmoothPath(mappedPoints),
        areaPath: buildAreaPath(mappedPoints, height),
        points: mappedPoints,
        maxVelocity: Number.isFinite(maxValue) ? maxValue : 0,
        avgVelocity: Number.isFinite(avgValue) ? avgValue : 0,
        currentVelocity: Number.isFinite(currentValue) ? currentValue : 0,
        durationSeconds: Number.isFinite(duration) ? duration : 0,
      };
    } catch (error) {
      console.error("[TypingVelocitySparkline] Computation error:", error);
      // Return safe fallback values
      return {
        path: "",
        areaPath: "",
        points: [],
        maxVelocity: 0,
        avgVelocity: 0,
        currentVelocity: 0,
        durationSeconds: 0,
      };
    }
  }, [data, bucketMs, height, numericWidth]);

  const hasData = points.length > 0;

  return (
    <div className={cn("w-full", className)}>
      <svg
        width={svgWidth}
        height={height}
        viewBox={`0 0 ${numericWidth} ${height}`}
        className="block"
        role="img"
        aria-label="Typing velocity over time sparkline"
      >
        <defs>
          <linearGradient
            id="typingVelocityNeon"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="45%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient
            id="typingVelocityArea"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.24" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.04" />
          </linearGradient>
          <filter
            id="typingVelocityGlow"
            x="-20%"
            y="-50%"
            width="140%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect
          x="0"
          y="0"
          width={numericWidth}
          height={height}
          fill="transparent"
        />
        <g opacity="0.4" stroke="#94a3b8" strokeWidth="1">
          <line
            x1={PADDING}
            y1={height / 2}
            x2={numericWidth - PADDING}
            y2={height / 2}
          />
          <line
            x1={PADDING}
            y1={PADDING}
            x2={numericWidth - PADDING}
            y2={PADDING}
          />
          <line
            x1={PADDING}
            y1={height - PADDING}
            x2={numericWidth - PADDING}
            y2={height - PADDING}
          />
        </g>
        {hasData ? (
          <>
            <path d={areaPath} fill="url(#typingVelocityArea)" opacity="0.8" />
            <path
              d={path}
              stroke="#0ea5e9"
              strokeOpacity="0.35"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#typingVelocityGlow)"
            />
            <path
              d={path}
              stroke="url(#typingVelocityNeon)"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="3"
                fill="url(#typingVelocityNeon)"
                opacity="0.9"
              />
            ))}
          </>
        ) : (
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#64748b"
            fontSize="12"
            fontFamily="var(--font-geist-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)"
          >
            No typing data
          </text>
        )}
      </svg>
      {hasData && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-y-2 text-[10px] uppercase tracking-[0.15em] font-mono">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <div className="whitespace-nowrap">
              <span className="text-sky-700/60 dark:text-sky-300/60">
                Peak{" "}
              </span>
              <span className="text-sky-700 font-semibold dark:text-sky-300">
                {maxVelocity.toFixed(1)}
              </span>
              <span className="text-sky-700/60 dark:text-sky-300/60">
                {" "}
                keys/s
              </span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-indigo-700/60 dark:text-indigo-300/60">
                Avg{" "}
              </span>
              <span className="text-indigo-700 font-semibold dark:text-indigo-300">
                {avgVelocity.toFixed(1)}
              </span>
              <span className="text-indigo-700/60 dark:text-indigo-300/60">
                {" "}
                keys/s
              </span>
            </div>
            <div className="whitespace-nowrap">
              <span className="text-violet-700/60 dark:text-violet-300/60">
                Current{" "}
              </span>
              <span className="text-violet-700 font-semibold dark:text-violet-300">
                {currentVelocity.toFixed(1)}
              </span>
              <span className="text-violet-700/60 dark:text-violet-300/60">
                {" "}
                keys/s
              </span>
            </div>
          </div>
          {durationSeconds > 0 && (
            <div className="text-slate-500 dark:text-slate-300 whitespace-nowrap">
              {durationSeconds < 60
                ? `${Math.round(durationSeconds)}s`
                : `${Math.floor(durationSeconds / 60)}m ${Math.round(durationSeconds % 60)}s`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TypingVelocitySparkline;
