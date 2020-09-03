import React from 'react';
import { isDefined, TooltipFrame, TooltipTable } from '@superset-ui/core';
import { BoxPlotEncoder } from './Encoder';
import { BoxPlotDataRow } from './types';

export default function DefaultTooltipRenderer({
  datum,
  color,
  encoder,
}: {
  datum: BoxPlotDataRow;
  color: string;
  encoder: BoxPlotEncoder;
}) {
  const { label, min, max, median, firstQuartile, thirdQuartile, outliers } = datum;
  const { channels } = encoder;

  const { formatValue } = channels.y;

  const data: { key: string; valueColumn: number | string }[] = [];
  if (isDefined(min)) {
    data.push({ key: 'Min', valueColumn: formatValue(min) });
  }
  if (isDefined(max)) {
    data.push({ key: 'Max', valueColumn: formatValue(max) });
  }
  if (isDefined(median)) {
    data.push({ key: 'Median', valueColumn: formatValue(median) });
  }
  if (isDefined(firstQuartile)) {
    data.push({ key: '1st Quartile', valueColumn: formatValue(firstQuartile) });
  }
  if (isDefined(thirdQuartile)) {
    data.push({ key: '3rd Quartile', valueColumn: formatValue(thirdQuartile) });
  }
  if (isDefined(outliers) && outliers.length > 0) {
    data.push({ key: '# Outliers', valueColumn: outliers.length });
  }

  return (
    <TooltipFrame>
      <div>
        <strong style={{ color }}>{label}</strong>
      </div>
      {data.length > 0 && <br />}
      <TooltipTable data={data} />
    </TooltipFrame>
  );
}
