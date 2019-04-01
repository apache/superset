/* eslint-disable no-magic-numbers */

import React from 'react';
import TooltipFrame from '../components/tooltip/TooltipFrame';
import TooltipTable from '../components/tooltip/TooltipTable';
import { Series, SeriesValue } from './Line';
import Encoder from './Encoder';

const MARK_STYLE = { marginRight: 4 };

export default function createTooltip(encoder: Encoder, allSeries: Series[]) {
  function LineTooltip({
    datum,
    series = {},
  }: {
    datum: SeriesValue;
    series: {
      [key: string]: {
        y: number;
      };
    };
  }) {
    return (
      <TooltipFrame>
        <>
          <div>
            <strong>{encoder.channels.x.formatValue(datum.x)}</strong>
          </div>
          <br />
          {series && (
            <TooltipTable
              data={allSeries
                .filter(({ key }) => series[key])
                .concat()
                .sort((a, b) => series[b.key].y - series[a.key].y)
                .map(({ key, color, strokeDasharray }) => ({
                  key,
                  keyColumn: (
                    <>
                      <svg width="12" height="8" style={MARK_STYLE}>
                        <line
                          x2="12"
                          y1="3"
                          y2="3"
                          stroke={color}
                          strokeWidth="2"
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

  return LineTooltip;
}
