/* eslint-disable no-magic-numbers */

import { getTextDimension } from '@superset-ui/dimension';

export default function computeXAxisLayout({
  axisLabelHeight = 20,
  axisWidth,
  gapBetweenAxisLabelAndBorder = 8,
  gapBetweenTickAndTickLabel = 4,
  gapBetweenTickLabelsAndAxisLabel = 4,
  labellingStrategy = 'auto',
  orientation = 'bottom',
  rotation = -40,
  tickLabels,
  tickLength,
  tickTextStyle,
}) {
  const labelDimensions = tickLabels.map(text =>
    getTextDimension({
      style: tickTextStyle,
      text,
    }),
  );

  const maxWidth = Math.max(...labelDimensions.map(d => d.width));
  const widthPerTick = axisWidth / (tickLabels.length + 1);

  let finalStrategy;
  if (labellingStrategy !== 'auto') {
    finalStrategy = labellingStrategy;
  } else if (maxWidth <= widthPerTick) {
    finalStrategy = 'flat';
  } else {
    finalStrategy = 'rotate';
  }
  // TODO: Add other strategies: stagger, chop, wrap.

  let layout = { labelOffset: 0 };
  if (finalStrategy === 'flat') {
    const labelHeight = labelDimensions[0].height;
    const labelOffset = labelHeight + gapBetweenTickLabelsAndAxisLabel;
    layout = { labelOffset };
  } else if (finalStrategy === 'rotate') {
    const labelHeight = Math.ceil(Math.abs(maxWidth * Math.sin((rotation * Math.PI) / 180)));
    const labelOffset = labelHeight + gapBetweenTickLabelsAndAxisLabel;
    const tickTextAnchor =
      (orientation === 'top' && rotation > 0) || (orientation === 'bottom' && rotation < 0)
        ? 'end'
        : 'start';
    layout = {
      labelOffset,
      rotation,
      tickTextAnchor,
    };
  }

  const { labelOffset } = layout;

  return {
    ...layout,
    labellingStrategy: finalStrategy,
    minMargin: {
      [orientation]: Math.ceil(
        tickLength +
          gapBetweenTickAndTickLabel +
          labelOffset +
          axisLabelHeight +
          gapBetweenAxisLabelAndBorder +
          8,
      ),
    },
    orientation,
  };
}
