/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * The "balloons" widget (Chart Framework v2 POC) — viz only.
 *
 * A playful field of balloons: one balloon per query row, colored by the first
 * grouping dimension's value (the "series") and sized by the metric, rising on
 * a wavy string and looping from the bottom once they drift out the top.
 *
 * Controls live in the dashboard Inspector, driven by a backend JSON Schema
 * (see `SchemaControlPanel`). This widget only reads its `node.props`
 * (`dataBinding` + `customize`) and renders from the query rows fetched via the
 * v1 chart-data path (`fetchQueryData`) — the same generic interface every
 * other data-backed widget uses.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Flex, Typography } from '@superset-ui/core/components';
import { keyframes, css, styled, useTheme } from '@apache-superset/core/theme';
import type { dashboard as dashboardApi } from '@apache-superset/core';
import { provider, useDashboardRevision } from '../store';
import { fetchQueryData } from '../chartData';

type DataBindingSpec = dashboardApi.DataBindingSpec;

// A categorical palette of distinct, playful colors — one per series. The
// literal hex is intentional (and must match the backend palette in
// superset/widgets/widgets.py so a series' default color is stable
// before the author touches the customize control), so the theme-color rule is
// disabled per entry, as the TimeTable palette does.
const PALETTE = [
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#e74c3c',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#3498db',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#2ecc71',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#f1c40f',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#9b59b6',
  // eslint-disable-next-line theme-colors/no-literal-colors
  '#1abc9c',
];
// Balloon diameter is derived from the metric value — sqrt(value / max) mapped
// into this px range — so tiny values never go microscopic and huge ones never
// go gargantuan, while relative sizes still read. A per-series `sizeScale`
// multiplies it, and the final diameter is clamped.
const BASE_MIN_PX = 18;
const BASE_MAX_PX = 72;
const MIN_FINAL_PX = 10;
const MAX_FINAL_PX = 160;
// One balloon per query row (bounded by the query's row limit); MAX_BALLOONS is
// only a safety ceiling so an unusually large limit can't spawn a runaway
// number of animated nodes.
const MAX_BALLOONS = 500;

// Deterministic, well-distributed pseudo-randoms per balloon, seeded by its
// stable key. Index-modulo arithmetic repeats every N balloons, so many rise at
// the same pace and wave in the same phase (a visible synchronized ripple);
// hashing the key decorrelates neighbours while staying stable across
// re-renders (unlike Math.random, which would reshuffle every time rows change).
function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0; // eslint-disable-line unicorn/prefer-math-trunc
}

function makeRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    // `| 0` / `>>> 0` are deliberate 32-bit (signed/unsigned) coercions the
    // PRNG relies on — not truncation, so the Math.trunc suggestion is wrong.
    // eslint-disable-next-line unicorn/prefer-math-trunc
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    // eslint-disable-next-line unicorn/prefer-math-trunc
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The climb: transform-only (GPU-composited, no per-frame layout) so a whole
// field of balloons stays smooth. `cqh` is 1% of the container's height, so the
// travel adapts to the widget size without measuring it in JS.
const rise = keyframes`
  from { transform: translateY(20cqh); }
  to   { transform: translateY(-120cqh); }
`;

// The wave: a full there-and-back sway with a gentle tilt, run on its own
// element so it composes with the vertical rise into an S-shaped ascent.
const sway = keyframes`
  0%   { transform: translateX(-16px) rotate(-5deg); }
  50%  { transform: translateX(16px) rotate(5deg); }
  100% { transform: translateX(-16px) rotate(-5deg); }
`;

// The string trailing the balloon, waving out of phase with the body.
const waggle = keyframes`
  0%,
  100% { transform: rotate(-12deg); }
  50%  { transform: rotate(12deg); }
`;

const Floater = styled.div`
  position: absolute;
  bottom: 0;
  animation-name: ${rise};
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  /* Hold a balloon still while hovered so its tooltip is catchable. */
  &:hover {
    animation-play-state: paused;
  }
`;

const Sway = styled.div`
  animation-name: ${sway};
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  &:hover {
    animation-play-state: paused;
  }
`;

const Body = styled.div`
  position: relative;
  /* Rounder at the top, tapering to a knot at the bottom — a balloon. */
  border-radius: 48% 48% 47% 47% / 58% 58% 42% 42%;
  box-shadow:
    inset -6px -8px 12px rgba(0, 0, 0, 0.22),
    inset 5px 5px 10px rgba(255, 255, 255, 0.35);
  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    width: 6px;
    height: 6px;
    transform: translate(-50%, -45%) rotate(45deg);
    background: inherit;
    filter: brightness(0.85);
  }
`;

const StringTail = styled.div`
  ${({ theme }) => css`
    position: absolute;
    top: 100%;
    left: 50%;
    width: 1.5px;
    background: ${theme.colorSplit};
    transform-origin: top center;
    animation-name: ${waggle};
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  `}
`;

// A custom tooltip driven by hover state (native `title` doesn't show reliably
// on transformed, overlapping, animated elements). Non-interactive so it never
// steals the hover from the balloon under it.
const Tooltip = styled.div`
  ${({ theme }) => css`
    position: absolute;
    transform: translate(-50%, calc(-100% - 12px));
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    pointer-events: none;
    background: ${theme.colorBgSpotlight};
    color: ${theme.colorTextLightSolid};
    z-index: 5;
  `}
`;

interface SeriesStyle {
  color?: string;
  sizeScale?: number;
}
interface Customization {
  series?: Record<string, SeriesStyle>;
}
type Row = { series: string; label: string; value: number };

/** Map controls -> DataBindingSpec, run the query, normalize to rows. */
async function loadRows(
  binding: DataBindingSpec,
  dimensions: string[],
  colorDim: string,
): Promise<Row[]> {
  const { columns, rows } = await fetchQueryData(binding);
  const dimensionSet = new Set(dimensions);
  // The metric column is whichever result column is NOT one of the grouping
  // dimensions (the query returns [...dimensions, <metric>]). Finding it by
  // exclusion is what makes multi-dimension bindings size correctly instead of
  // mistaking a second dimension for the metric.
  const metricColumn =
    columns.find(column => !dimensionSet.has(column)) ??
    columns[columns.length - 1];
  return rows.map(row => ({
    // `series` groups/colors the balloons (the color dimension); `label` joins
    // every grouping dimension's value so the tooltip identifies the balloon in
    // full (e.g. "Aaron · boy") regardless of which dimension drives color;
    // `value` sizes each balloon.
    series: String(row[colorDim] ?? ''),
    label:
      dimensions.map(dimension => String(row[dimension] ?? '')).join(' · ') ||
      String(row[colorDim] ?? ''),
    value: Number((metricColumn && row[metricColumn]) ?? 0),
  }));
}

export default function BalloonsWidget({ nodeId }: { nodeId: string }) {
  useDashboardRevision();
  const theme = useTheme();

  const node = provider.getNode(nodeId);
  const binding = node?.props?.dataBinding as DataBindingSpec | undefined;
  const customize = (node?.props?.customize as Customization | undefined) ?? {};
  const dimensions = binding?.dimensions ?? [];
  // Color by the chosen color dimension, or the last dimension by default; the
  // first dimension identifies each balloon. (One balloon per query row.)
  const explicitColor = node?.props?.colorDimension as string | undefined;
  const colorDim =
    explicitColor && dimensions.includes(explicitColor)
      ? explicitColor
      : dimensions[dimensions.length - 1];
  const bindingKey = JSON.stringify(binding ?? null);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    label: string;
    left: number;
    top: number;
  } | null>(null);

  const needsConfig =
    !binding?.datasetId || !binding.metrics?.length || !colorDim;

  useEffect(() => {
    if (!binding?.datasetId || !binding.metrics?.length || !colorDim) {
      setRows([]);
      return undefined;
    }
    let cancelled = false;
    setError(null);
    loadRows(binding, dimensions, colorDim)
      .then(result => !cancelled && setRows(result))
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
    // dataBinding is a fresh object every render — bindingKey is its stable,
    // value-equality-comparable proxy; colorDim changes the series mapping.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey, colorDim]);

  const rowsKey = JSON.stringify(rows);

  // One balloon per query row, each with a stable-but-varied flight so the field
  // looks organic. Negative delays pre-distribute the balloons along the climb,
  // so the frame is full on first paint rather than filling from the bottom.
  const balloons = useMemo(() => {
    const seriesOrder: string[] = [];
    rows.forEach(row => {
      if (!seriesOrder.includes(row.series)) seriesOrder.push(row.series);
    });
    const shown = rows.slice(0, MAX_BALLOONS);
    const maxValue = Math.max(0, ...shown.map(row => row.value));
    const basePxOf = (value: number) => {
      if (maxValue <= 0) return (BASE_MIN_PX + BASE_MAX_PX) / 2;
      const ratio = Math.sqrt(Math.max(0, value) / maxValue);
      return BASE_MIN_PX + ratio * (BASE_MAX_PX - BASE_MIN_PX);
    };
    return shown.map((row, index) => {
      const key = `${row.series}-${index}`;
      // Each balloon gets its own pace and phase from its key, so the field
      // rises organically rather than in synchronized bands.
      const rand = makeRandom(hashSeed(key));
      const riseSecs = 9 + rand() * 9; // 9–18s ascent
      const swaySecs = 2.2 + rand() * 2.8; // 2.2–5s wave
      return {
        key,
        series: row.series,
        label: row.label,
        value: row.value,
        basePx: basePxOf(row.value),
        colorIndex: Math.max(0, seriesOrder.indexOf(row.series)),
        left: 3 + rand() * 92,
        rise: riseSecs,
        // Continuous negative offsets across the full cycle pre-distribute the
        // balloons along the climb and spread their wave phases, so nothing
        // starts in lockstep.
        riseDelay: -rand() * riseSecs,
        sway: swaySecs,
        swayDelay: -rand() * swaySecs,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsKey]);

  if (!node) return null;

  const seriesStyle = (
    series: string,
    colorIndex: number,
  ): { color: string; sizeScale: number } => {
    const custom = customize.series?.[series] ?? {};
    return {
      color: custom.color ?? PALETTE[colorIndex % PALETTE.length],
      sizeScale: custom.sizeScale ?? 1,
    };
  };

  if (error || needsConfig) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{ width: '100%', height: '100%', padding: theme.padding }}
      >
        <Typography.Text type={error ? 'danger' : 'secondary'}>
          {error ??
            t(
              'Set a dataset, a metric, and a grouping dimension to release the balloons.',
            )}
        </Typography.Text>
      </Flex>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 220,
        overflow: 'hidden',
        // Establishes the query container the balloons' `cqh` rise resolves
        // against, so the travel tracks the widget's height.
        containerType: 'size',
      }}
    >
      {balloons.map(balloon => {
        const { color, sizeScale } = seriesStyle(
          balloon.series,
          balloon.colorIndex,
        );
        const width = Math.max(
          MIN_FINAL_PX,
          Math.min(MAX_FINAL_PX, balloon.basePx * sizeScale),
        );
        const height = width * 1.2;
        // `label` already joins every grouping dimension (e.g. "Aaron · boy").
        const label = `${balloon.label}: ${balloon.value.toLocaleString()}`;
        return (
          <Floater
            key={balloon.key}
            style={{
              left: `${balloon.left}%`,
              animationDuration: `${balloon.rise}s`,
              animationDelay: `${balloon.riseDelay}s`,
            }}
          >
            <Sway
              style={{
                animationDuration: `${balloon.sway}s`,
                animationDelay: `${balloon.swayDelay}s`,
              }}
            >
              <Body
                onMouseEnter={event => {
                  const host = containerRef.current;
                  if (!host) return;
                  const rect = host.getBoundingClientRect();
                  setTip({
                    label,
                    left: event.clientX - rect.left,
                    top: event.clientY - rect.top,
                  });
                }}
                onMouseLeave={() => setTip(null)}
                style={{
                  width,
                  height,
                  cursor: 'pointer',
                  background: `radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.55), ${color} 62%)`,
                }}
              >
                <StringTail
                  style={{
                    height: height * 0.85,
                    animationDuration: `${balloon.sway}s`,
                    animationDelay: `${balloon.swayDelay}s`,
                  }}
                />
              </Body>
            </Sway>
          </Floater>
        );
      })}
      {tip && (
        <Tooltip style={{ left: tip.left, top: tip.top }}>{tip.label}</Tooltip>
      )}
    </div>
  );
}
