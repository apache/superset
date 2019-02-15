/* eslint-disable no-magic-numbers */

import { getTextDimension } from '@superset-ui/dimension';

export default function computeYAxisLayout({
  axisLabelHeight = 20,
  gapBetweenAxisLabelAndBorder = 8,
  gapBetweenTickAndTickLabel = 4,
  gapBetweenTickLabelsAndAxisLabel = 4,
  orientation = 'left',
  tickLabels,
  tickLength,
  tickTextStyle,
}) {
  const labelDimensions = tickLabels.map(text =>
    getTextDimension({
      text,
      style: tickTextStyle,
    }),
  );

  const maxWidth = Math.ceil(Math.max(...labelDimensions.map(d => d.width)));
  let labelOffset = Math.ceil(maxWidth + gapBetweenTickLabelsAndAxisLabel + axisLabelHeight);

  let margin = tickLength + gapBetweenTickAndTickLabel + labelOffset + gapBetweenAxisLabelAndBorder;

  return {
    labelOffset: labelOffset,
    minMargin: {
      [orientation]: margin,
    },
    orientation,
  };
}
