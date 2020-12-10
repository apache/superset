import { CSSProperties } from 'react';
import { getTextDimension, Margin, Dimension } from '@superset-ui/core';
import { AxisOrient, ChannelDef, Value } from 'encodable';

import ChannelEncoderAxis from 'encodable/lib/encoders/ChannelEncoderAxis';

export interface AxisLayout {
  axisWidth: number;
  labelAngle: number;
  labelFlush: number | boolean;
  labelOffset: number;
  labelOverlap: 'flat' | 'rotate';
  minMargin: Partial<Margin>;
  orient: AxisOrient;
  tickLabelDimensions: Dimension[];
  tickLabels: string[];
  tickTextAnchor?: string;
}

export default function computeAxisLayout<Def extends ChannelDef<Output>, Output extends Value>(
  axis: ChannelEncoderAxis<Def, Output>,
  {
    axisTitleHeight = 20,
    axisWidth,
    gapBetweenAxisLabelAndBorder = 4,
    gapBetweenTickAndTickLabel = 4,
    defaultTickSize = 8,
    tickTextStyle = {},
  }: {
    axisTitleHeight?: number;
    axisWidth: number;
    gapBetweenAxisLabelAndBorder?: number;
    gapBetweenTickAndTickLabel?: number;
    defaultTickSize?: number;
    tickTextStyle?: CSSProperties;
  },
): AxisLayout {
  const tickLabels = axis.getTickLabels();
  const tickLabelDimensions = tickLabels.map((text: string) =>
    getTextDimension({
      style: tickTextStyle,
      text,
    }),
  );

  const {
    labelAngle,
    labelFlush,
    labelOverlap,
    labelPadding,
    orient,
    tickSize = defaultTickSize,
  } = axis.config;

  const maxWidth = Math.max(...tickLabelDimensions.map(d => d.width), 0);

  // cheap heuristic, can improve
  const widthPerTick = axisWidth / tickLabels.length;
  const isLabelOverlap = maxWidth > widthPerTick;
  const labelAngleIfOverlap = labelOverlap.strategy === 'rotate' ? labelOverlap.labelAngle : 0;
  const labelAngleAfterOverlapCheck = isLabelOverlap ? labelAngleIfOverlap : 0;
  const finalLabelAngle = labelAngle === 0 ? labelAngleAfterOverlapCheck : labelAngle;

  const spaceForAxisTitle = axis.hasTitle() ? labelPadding + axisTitleHeight : 0;
  let tickTextAnchor = 'middle';
  let labelOffset = 0;
  let requiredMargin =
    tickSize + gapBetweenTickAndTickLabel + spaceForAxisTitle + gapBetweenAxisLabelAndBorder;

  if (axis.channelEncoder.isX()) {
    if (finalLabelAngle === 0) {
      const labelHeight = tickLabelDimensions.length > 0 ? tickLabelDimensions[0].height : 0;
      labelOffset = labelHeight + labelPadding;
      requiredMargin += labelHeight;
    } else {
      const labelHeight = Math.ceil(
        Math.abs(maxWidth * Math.sin((finalLabelAngle * Math.PI) / 180)),
      );
      labelOffset = labelHeight + labelPadding;
      requiredMargin += labelHeight;
      tickTextAnchor =
        (orient === 'top' && finalLabelAngle > 0) || (orient === 'bottom' && finalLabelAngle < 0)
          ? 'end'
          : 'start';
    }
    requiredMargin += 8;
  } else {
    labelOffset = maxWidth + spaceForAxisTitle;
    requiredMargin += maxWidth;
  }

  return {
    axisWidth,
    labelAngle: finalLabelAngle,
    labelFlush,
    labelOffset,
    labelOverlap: isLabelOverlap ? labelOverlap.strategy : 'flat',
    minMargin: {
      [orient]: Math.ceil(requiredMargin),
    },
    orient,
    tickLabelDimensions,
    tickLabels,
    tickTextAnchor,
  };
}
