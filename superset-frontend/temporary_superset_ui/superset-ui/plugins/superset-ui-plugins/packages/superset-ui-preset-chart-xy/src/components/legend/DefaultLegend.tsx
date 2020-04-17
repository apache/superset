import React, { CSSProperties, PureComponent } from 'react';
import { EncodingConfig } from 'encodable';
import { LegendRendererProps } from './types';
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

export type Props<Config extends EncodingConfig> = LegendRendererProps<Config>;

export default class DefaultLegend<Config extends EncodingConfig> extends PureComponent<
  Props<Config>
> {
  render() {
    const {
      groups,
      LegendGroupRenderer = DefaultLegendGroup,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style,
    } = this.props;

    const combinedStyle =
      typeof style === 'undefined'
        ? LEGEND_CONTAINER_STYLE
        : { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      <div style={combinedStyle}>
        {groups
          .filter(group => 'items' in group && group.items.length > 0)
          .map(group => (
            <LegendGroupRenderer
              key={group.field}
              group={group}
              ItemRenderer={LegendItemRenderer}
              ItemMarkRenderer={LegendItemMarkRenderer}
              ItemLabelRenderer={LegendItemLabelRenderer}
            />
          ))}
      </div>
    );
  }
}
