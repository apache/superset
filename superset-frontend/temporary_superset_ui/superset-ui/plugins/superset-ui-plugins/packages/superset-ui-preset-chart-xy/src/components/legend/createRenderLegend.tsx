import React from 'react';
import { Encoder, EncodingConfig, Dataset } from 'encodable';
import { LegendHooks } from './types';
import DefaultLegend from './DefaultLegend';

export default function createRenderLegend<Config extends EncodingConfig>(
  encoder: Encoder<Config>,
  data: Dataset,
  props: LegendHooks<Config>,
) {
  if (encoder.hasLegend()) {
    const {
      LegendRenderer = DefaultLegend,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemLabelRenderer,
      LegendItemMarkRenderer,
    } = props;

    return () => (
      <LegendRenderer
        groups={encoder.getLegendInformation(data)}
        LegendGroupRenderer={LegendGroupRenderer}
        LegendItemRenderer={LegendItemRenderer}
        LegendItemMarkRenderer={LegendItemMarkRenderer}
        LegendItemLabelRenderer={LegendItemLabelRenderer}
      />
    );
  }

  return undefined;
}
