import React from 'react';
import { TooltipFrame, TooltipTable } from '@superset-ui/core';
import { chartTheme } from '@data-ui/theme';
import { TooltipProps } from './Line';

const MARK_STYLE = { marginRight: 4 };

export default function DefaultTooltipRenderer({
  allSeries,
  datum,
  encoder,
  series = {},
  theme = chartTheme,
}: TooltipProps) {
  return (
    <TooltipFrame>
      <>
        <div style={{ fontFamily: theme.labelStyles.fontFamily }}>
          <strong>{encoder.channels.x.formatValue(datum.x)}</strong>
        </div>
        <br />
        {series && (
          <TooltipTable
            data={allSeries
              .filter(({ key }) => series[key])
              .concat()
              .sort((a, b) => series[b.key].y - series[a.key].y)
              .map(({ key, stroke, strokeDasharray, strokeWidth }) => ({
                key,
                keyColumn: (
                  <>
                    <svg width="12" height="8" style={MARK_STYLE}>
                      <line
                        x2="12"
                        y1="3"
                        y2="3"
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDasharray}
                      />
                    </svg>
                    {series[key] === datum ? <b>{key}</b> : key}
                  </>
                ),
                valueColumn: encoder.channels.y.formatValue(series[key].y),
              }))}
          />
        )}
      </>
    </TooltipFrame>
  );
}
