"use client";

// ARC's pet — a 12×14 pixel sprite drawn as SVG rects, corner companion.
// States: fire (overdue money / critical alert), alert, happy, sleeping.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PetState } from "@/types/ops";

const PX = 4; // pixel size

// palette
const C = {
  helmet: "#e8734a", // orange helmet/hood
  helmetDark: "#c2502c",
  face: "#f6e2c8", // skin
  body: "#f2ead9", // cream body
  eye: "#2b2320",
  mouth: "#b8452f",
  belly: "#e8734a",
  fire1: "#ff9a2e",
  fire2: "#ffd23e",
  fire3: "#ff5722",
  zzz: "#8b8577",
  shadow: "rgba(0,0,0,0.25)",
};

// 12-wide grids. "." = empty. Body sprite shared; hair zone differs per state.
const BODY: string[] = [
  // helmet band + face (rows 0-5 reserved for hair/fire per state)
  "..hhhhhhhh..",
  ".hhffffffhh.",
  ".hfeffffefh.",
  ".hffffffffh.",
  ".hfffmmfffh.",
  "..hffffffh..",
  "...bbbbbb...",
  "..bbbbbbbb..",
  "..bbbLLbbb..",
  "..bbbLLbbb..",
  "..bbbbbbbb..",
  "...bb..bb...",
  "..dbb..bbd..",
];

const FIRE_FRAMES: string[][] = [
  [
    "....23......",
    "...2332.....",
    "..233332....",
    "..133331....",
    "...1331.....",
  ],
  [
    "......32....",
    "....2333....",
    "...233332...",
    "..1333331...",
    "...13331....",
  ],
];

const CHAR_COLOR: Record<string, string> = {
  h: C.helmet,
  d: C.helmetDark,
  f: C.face,
  e: C.eye,
  m: C.mouth,
  b: C.body,
  L: C.belly,
  "1": C.fire3,
  "2": C.fire1,
  "3": C.fire2,
};

function Grid({ rows, yOffset = 0 }: { rows: string[]; yOffset?: number }) {
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      const color = CHAR_COLOR[ch];
      if (!color) return;
      rects.push(
        <rect key={`${x}-${y}`} x={x * PX} y={(y + yOffset) * PX} width={PX} height={PX} fill={color} />
      );
    });
  });
  return <>{rects}</>;
}

export function Pet() {
  const router = useRouter();
  const [state, setState] = useState<PetState>("happy");
  const [frame, setFrame] = useState(0);
  const [blink, setBlink] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/pet-state");
      if (!res.ok) return;
      const data = await res.json();
      if (data.state) setState(data.state);
    } catch {
      /* pet stays calm on network errors */
    }
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(poll);
  }, [load]);

  // fire flicker
  useEffect(() => {
    if (state !== "fire") return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 2), 350);
    return () => clearInterval(t);
  }, [state]);

  // idle blink
  useEffect(() => {
    const t = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const eyesClosed = blink || state === "sleeping";
  const body = BODY.map((row, i) => {
    if (eyesClosed && i === 2) return row.replaceAll("e", "m");
    return row;
  });

  const title =
    state === "fire"
      ? "Something's on fire — overdue money or a critical alert"
      : state === "alert"
        ? "Heads up — overdue tasks or a high alert"
        : state === "happy"
          ? "All clear"
          : "Quiet day";

  const width = 12 * PX;
  const height = (5 + 13) * PX;

  return (
    <button
      onClick={() => router.push("/dashboard/ops")}
      title={title}
      aria-label={`ARC pet: ${title}`}
      className={`fixed bottom-20 right-4 z-50 select-none transition-transform hover:scale-110 lg:bottom-5 lg:right-5 ${
        state === "alert" ? "animate-bounce" : ""
      } motion-reduce:animate-none`}
      style={{ imageRendering: "pixelated" }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} shapeRendering="crispEdges">
        {state === "fire" && <Grid rows={FIRE_FRAMES[frame]} />}
        {state === "alert" && (
          <text x={width - 10} y={12} fontSize="13" fill={C.fire1} fontWeight="bold">
            !
          </text>
        )}
        {state === "sleeping" && (
          <text x={width - 14} y={14} fontSize="10" fill={C.zzz} className="animate-pulse">
            z z
          </text>
        )}
        <Grid rows={body} yOffset={5} />
        <ellipse cx={width / 2} cy={height - 2} rx={width / 3} ry={2} fill={C.shadow} />
      </svg>
    </button>
  );
}
