import { ChartPlugin, ChartMetadata } from '@superset-ui/core';
import { BigNumber, makeChartPlugin } from 'glyph';
import thumbnail from './thumbnail.png';

export const GlyphBigNumberChartPlugin = makeChartPlugin(
  BigNumber,
  { ChartPlugin, ChartMetadata },
  { thumbnail },
);
