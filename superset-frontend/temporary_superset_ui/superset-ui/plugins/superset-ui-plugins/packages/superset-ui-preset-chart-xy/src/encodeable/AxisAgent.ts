/* eslint-disable no-magic-numbers */
import { CSSProperties } from 'react';
import { Value } from 'vega-lite/build/src/channeldef';
import { getTextDimension } from '@superset-ui/dimension';
import { CategoricalColorScale } from '@superset-ui/color';
import { extractFormatFromTypeAndFormat } from './parsers/extractFormat';
import { CoreAxis, LabelOverlapStrategy } from './types/Axis';
import { PositionFieldDef, ChannelDef } from './types/ChannelDef';
import ChannelEncoder from './ChannelEncoder';
import { DEFAULT_LABEL_ANGLE } from '../utils/constants';

const DEFAULT_BASE_CONFIG: {
  labelOverlap: LabelOverlapStrategy;
  labelPadding: number;
  tickCount: number;
} = {
  labelOverlap: 'auto',
  labelPadding: 4,
  tickCount: 5,
};

const DEFAULT_X_CONFIG: CoreAxis = {
  ...DEFAULT_BASE_CONFIG,
  labelAngle: DEFAULT_LABEL_ANGLE,
  orient: 'bottom',
};

const DEFAULT_Y_CONFIG: CoreAxis = {
  ...DEFAULT_BASE_CONFIG,
  labelAngle: 0,
  orient: 'left',
};

export default class AxisAgent<Def extends ChannelDef<Output>, Output extends Value = Value> {
  private readonly channelEncoder: ChannelEncoder<Def, Output>;
  private readonly format?: (value: any) => string;
  readonly config: CoreAxis;

  constructor(channelEncoder: ChannelEncoder<Def, Output>) {
    this.channelEncoder = channelEncoder;
    const definition = channelEncoder.definition as PositionFieldDef;
    const { type, axis = {} } = definition;

    this.config = this.channelEncoder.isX()
      ? { ...DEFAULT_X_CONFIG, ...axis }
      : { ...DEFAULT_Y_CONFIG, ...axis };

    if (typeof axis.format !== 'undefined') {
      this.format = extractFormatFromTypeAndFormat(type, axis.format);
    }
  }

  getFormat() {
    return this.format || this.channelEncoder.formatValue;
  }

  getTitle() {
    return this.config.title || this.channelEncoder.getTitle();
  }

  getTickLabels() {
    const { tickCount, values } = this.config;

    const format = this.getFormat();
    if (typeof values !== 'undefined') {
      return (values as any[]).map(format);
    }

    if (typeof this.channelEncoder.scale !== 'undefined') {
      const { scale } = this.channelEncoder.scale;
      if (typeof scale !== 'undefined' && !(scale instanceof CategoricalColorScale)) {
        return ('ticks' in scale && typeof scale.ticks !== 'undefined'
          ? scale.ticks(tickCount)
          : scale.domain()
        ).map(format);
      }
    }

    return [];
  }

  computeLayout({
    axisLabelHeight = 20,
    axisWidth,
    gapBetweenAxisLabelAndBorder = 8,
    gapBetweenTickAndTickLabel = 4,
    labelAngle = this.config.labelAngle,
    tickLength,
    tickTextStyle,
  }: {
    axisLabelHeight?: number;
    axisWidth: number;
    gapBetweenAxisLabelAndBorder?: number;
    gapBetweenTickAndTickLabel?: number;
    labelAngle?: number;
    tickLength: number;
    tickTextStyle: CSSProperties;
  }) {
    const tickLabels = this.getTickLabels();

    const labelDimensions = tickLabels.map((text: string) =>
      getTextDimension({
        style: tickTextStyle,
        text,
      }),
    );

    const { labelOverlap, labelPadding, orient } = this.config;

    const maxWidth = Math.max(...labelDimensions.map(d => d.width));

    // TODO: Add other strategies: stagger, chop, wrap.
    let strategy = labelOverlap;
    if (strategy === 'auto') {
      // cheap heuristic, can improve
      const widthPerTick = axisWidth / tickLabels.length;
      if (this.channelEncoder.isY() || maxWidth <= widthPerTick) {
        strategy = 'flat';
      } else {
        strategy = 'rotate';
      }
    }

    if (this.channelEncoder.isX()) {
      let labelOffset = 0;
      let layout: {
        labelAngle: number;
        tickTextAnchor?: string;
      } = { labelAngle };

      if (strategy === 'flat') {
        labelOffset = labelDimensions[0].height + labelPadding;
        layout = { labelAngle: 0 };
      } else if (strategy === 'rotate') {
        const labelHeight = Math.ceil(Math.abs(maxWidth * Math.sin((labelAngle * Math.PI) / 180)));
        labelOffset = labelHeight + labelPadding;
        layout = {
          labelAngle,
          tickTextAnchor:
            (orient === 'top' && labelAngle > 0) || (orient === 'bottom' && labelAngle < 0)
              ? 'end'
              : 'start',
        };
      }

      return {
        ...layout,
        labelOffset,
        labelOverlap: strategy,
        minMargin: {
          [orient]: Math.ceil(
            tickLength +
              gapBetweenTickAndTickLabel +
              labelOffset +
              axisLabelHeight +
              gapBetweenAxisLabelAndBorder +
              8,
          ),
        },
        orient,
      };
    }

    const labelOffset = Math.ceil(maxWidth + labelPadding + axisLabelHeight);

    return {
      labelAngle,
      labelOffset,
      labelOverlap,
      minMargin: {
        [orient]:
          tickLength + gapBetweenTickAndTickLabel + labelOffset + gapBetweenAxisLabelAndBorder,
      },
      orient,
    };
  }
}
