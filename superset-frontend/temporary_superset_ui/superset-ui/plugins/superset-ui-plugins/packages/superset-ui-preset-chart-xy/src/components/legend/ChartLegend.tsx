import React, { CSSProperties, PureComponent } from 'react';
import AbstractEncoder from '../../encodeable/AbstractEncoder';
import { Dataset } from '../../encodeable/types/Data';
import {
  LegendItemRendererType,
  LegendGroupRendererType,
  LegendItemLabelRendererType,
  LegendItemMarkRendererType,
} from './types';
import DefaultLegendGroup from './DefaultLegendGroup';

const LEGEND_CONTAINER_STYLE: CSSProperties = {
  display: 'flex',
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  maxHeight: 100,
  overflowY: 'auto',
  position: 'relative',
};

export type Hooks<Encoding> = {
  LegendGroupRenderer?: LegendGroupRendererType<Encoding>;
  LegendItemRenderer?: LegendItemRendererType<Encoding>;
  LegendItemMarkRenderer?: LegendItemMarkRendererType<Encoding>;
  LegendItemLabelRenderer?: LegendItemLabelRendererType<Encoding>;
};

export type Props<Encoder> = {
  data: Dataset;
  encoder: Encoder;
  style?: CSSProperties;
} & Hooks<Encoder extends AbstractEncoder<any, infer Encoding> ? Encoding : never>;

export default class ChartLegend<Encoder extends AbstractEncoder<any, any>> extends PureComponent<
  Props<Encoder>
> {
  render() {
    const {
      data,
      encoder,
      LegendGroupRenderer,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style,
    } = this.props;

    const LegendGroup =
      typeof LegendGroupRenderer === 'undefined' ? DefaultLegendGroup : LegendGroupRenderer;
    const combinedStyle =
      typeof style === 'undefined'
        ? LEGEND_CONTAINER_STYLE
        : { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      <div style={combinedStyle}>
        {encoder.getLegendInfos(data).map(items => (
          <LegendGroup
            key={items[0].field}
            items={items}
            ItemRenderer={LegendItemRenderer}
            ItemMarkRenderer={LegendItemMarkRenderer}
            ItemLabelRenderer={LegendItemLabelRenderer}
          />
        ))}
      </div>
    );
  }
}
