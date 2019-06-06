import React from 'react';
import AbstractEncoder from '../../encodeable/AbstractEncoder';
import { LegendHooks } from './types';
import DefaultLegend from './DefaultLegend';
import { Dataset } from '../../encodeable/types/Data';

export default function createRenderLegend<Encoder extends AbstractEncoder<any, any, any>>(
  encoder: Encoder,
  data: Dataset,
  props: LegendHooks<Encoder>,
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
        groups={encoder.getLegendInfos(data)}
        LegendGroupRenderer={LegendGroupRenderer}
        LegendItemRenderer={LegendItemRenderer}
        LegendItemMarkRenderer={LegendItemMarkRenderer}
        LegendItemLabelRenderer={LegendItemLabelRenderer}
      />
    );
  }

  return undefined;
}
