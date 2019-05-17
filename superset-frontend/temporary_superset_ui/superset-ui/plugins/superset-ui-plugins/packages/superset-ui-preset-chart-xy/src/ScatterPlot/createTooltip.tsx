/* eslint-disable no-magic-numbers */

import React from 'react';
import { TooltipFrame, TooltipTable } from '@superset-ui/chart-composition';
import Encoder from './Encoder';
import { isFieldDef } from '../encodeable/types/ChannelDef';
import { EncodedPoint } from './ScatterPlot';

export default function createTooltip(encoder: Encoder) {
  function Tooltip({ datum }: { datum: EncodedPoint }) {
    const { channels, commonChannels } = encoder;
    const { x, y, size, fill, stroke } = channels;

    const tooltipRows = [
      { key: 'x', keyColumn: x.getTitle(), valueColumn: x.format(datum.data) },
      { key: 'y', keyColumn: y.getTitle(), valueColumn: y.format(datum.data) },
    ];

    if (isFieldDef(fill.definition)) {
      tooltipRows.push({
        key: 'fill',
        keyColumn: fill.getTitle(),
        valueColumn: fill.format(datum.data),
      });
    }
    if (isFieldDef(stroke.definition)) {
      tooltipRows.push({
        key: 'stroke',
        keyColumn: stroke.getTitle(),
        valueColumn: stroke.format(datum.data),
      });
    }
    if (isFieldDef(size.definition)) {
      tooltipRows.push({
        key: 'size',
        keyColumn: size.getTitle(),
        valueColumn: size.format(datum.data),
      });
    }
    commonChannels.group.forEach(g => {
      tooltipRows.push({
        key: `${g.name}`,
        keyColumn: g.getTitle(),
        valueColumn: g.format(datum.data),
      });
    });

    return (
      <TooltipFrame>
        <TooltipTable data={tooltipRows} />
      </TooltipFrame>
    );
  }

  return Tooltip;
}
