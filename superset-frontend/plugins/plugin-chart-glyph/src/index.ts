import { ChartPlugin, ChartMetadata, buildQueryContext } from '@superset-ui/core';
import { BigNumber, FancyBigNumber, LineChart, makeChartPlugin } from 'glyph';
import thumbnail from './thumbnail.png';

export const GlyphBigNumberChartPlugin = makeChartPlugin(
  BigNumber,
  { ChartPlugin, ChartMetadata, buildQueryContext },
  { thumbnail },
);

export const GlyphFancyBigNumberChartPlugin = makeChartPlugin(
  FancyBigNumber,
  { ChartPlugin, ChartMetadata, buildQueryContext },
  { thumbnail },
);

export const GlyphLineChartPlugin = makeChartPlugin(
  LineChart,
  { ChartPlugin, ChartMetadata, buildQueryContext },
  { thumbnail },
);
