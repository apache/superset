/* eslint-disable no-magic-numbers */

import React from 'react';
import TooltipFrame from '../components/tooltip/TooltipFrame';
import TooltipTable from '../components/tooltip/TooltipTable';
import { Series, SeriesValue } from './Line';
import Encoder from './Encoder';

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
                .map(({ key, color }) => ({
                  key,
                  keyStyle: {
                    color,
                    fontWeight: series[key] === datum ? 600 : 200,
                  },
                  value: encoder.channels.y.formatValue(series[key].y),
                }))}
            />
          )}
        </>
      </TooltipFrame>
    );
  }

  return LineTooltip;
}
