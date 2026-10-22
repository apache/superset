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
import { styled, useTheme } from '@apache-superset/core/theme';
import type {
  TimeseriesLegendIcon as TimeseriesLegendIconData,
  TimeseriesLegendLineType,
} from './types';

// ECharts legend defaults: itemWidth 25, itemHeight 14, and a line icon's
// symbol at 80% of the item height.
const WIDTH = 25;
const HEIGHT = 14;
const HOLLOW_STROKE_WIDTH = 2;

const round = (value: number) => Math.round(value * 100) / 100;

const LINE_SYMBOL_SIZE = round(HEIGHT * 0.8);

// Same expansion zrender applies to a dashed or dotted line of this width.
function getDashArray(
  lineType: TimeseriesLegendLineType,
  lineWidth: number,
): string | undefined {
  if (lineType === 'dashed') {
    return `${4 * lineWidth} ${2 * lineWidth}`;
  }
  if (lineType === 'dotted') {
    return `${lineWidth}`;
  }
  return Array.isArray(lineType) ? lineType.join(' ') : undefined;
}

type PaintProps = {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
};

function Symbol({
  hollowFill,
  paint,
  size,
  symbol,
}: {
  hollowFill: string;
  paint: string;
  size: number;
  symbol: string;
}) {
  const hollow = symbol.startsWith('empty');
  const shape = hollow
    ? symbol.charAt(5).toLowerCase() + symbol.slice(6)
    : symbol;
  const paintProps: PaintProps = hollow
    ? { fill: hollowFill, stroke: paint, strokeWidth: HOLLOW_STROKE_WIDTH }
    : { fill: paint };
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const half = size / 2;
  const x = round(cx - half);
  const y = round(cy - half);
  const right = round(cx + half);
  const bottom = round(cy + half);

  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={round(half)} {...paintProps} />;
    case 'roundRect':
      return (
        <rect
          x={x}
          y={y}
          width={size}
          height={size}
          rx={round(size / 4)}
          {...paintProps}
        />
      );
    case 'triangle':
      return (
        <polygon
          points={`${cx},${y} ${right},${bottom} ${x},${bottom}`}
          {...paintProps}
        />
      );
    case 'diamond':
      return (
        <polygon
          points={`${cx},${y} ${right},${cy} ${cx},${bottom} ${x},${cy}`}
          {...paintProps}
        />
      );
    case 'pin': {
      // ECharts' pin: a circle 3/5 of the box wide whose tangents meet at the tip.
      const r = (size * 3) / 10;
      const dy = (r * r) / (size - r);
      const dx = Math.cos(Math.asin(dy / r)) * r;
      const tangentY = round(y + r + dy);
      return (
        <path
          d={`M${cx},${bottom} L${round(cx - dx)},${tangentY} A${round(r)},${round(r)} 0 1 1 ${round(cx + dx)},${tangentY} Z`}
          {...paintProps}
        />
      );
    }
    default:
      // `rect`, and ECharts' fallback for any symbol it does not know.
      return <rect x={x} y={y} width={size} height={size} {...paintProps} />;
  }
}

const Icon = styled.svg`
  flex: 0 0 auto;
  margin-top: 3px;
`;

export type TimeseriesLegendIconProps = {
  color: string;
  icon: TimeseriesLegendIconData;
  selected: boolean;
};

export default function TimeseriesLegendIcon({
  color,
  icon,
  selected,
}: TimeseriesLegendIconProps) {
  const theme = useTheme();
  const paint = selected ? color : theme.colorTextDisabled;
  const hollowFill = theme.colorBgContainer;

  return (
    <Icon
      aria-hidden
      focusable="false"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
    >
      {icon.shape === 'box' && (
        <rect width={WIDTH} height={HEIGHT} rx={HEIGHT / 4} fill={paint} />
      )}
      {icon.shape === 'symbol' && (
        <Symbol
          hollowFill={hollowFill}
          paint={paint}
          size={HEIGHT}
          symbol={icon.symbol}
        />
      )}
      {icon.shape === 'line' && (
        <>
          {icon.lineWidth > 0 && (
            <line
              x1={0}
              y1={HEIGHT / 2}
              x2={WIDTH}
              y2={HEIGHT / 2}
              stroke={paint}
              strokeWidth={icon.lineWidth}
              strokeDasharray={getDashArray(icon.lineType, icon.lineWidth)}
            />
          )}
          <Symbol
            hollowFill={hollowFill}
            paint={paint}
            size={LINE_SYMBOL_SIZE}
            symbol={icon.symbol}
          />
        </>
      )}
    </Icon>
  );
}
