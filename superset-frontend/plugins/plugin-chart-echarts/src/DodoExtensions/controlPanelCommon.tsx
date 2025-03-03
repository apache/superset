// DODO was here
// DODO created 45525377
import { t } from '@superset-ui/core';
import { LabelPositionDodo } from './types';

const chartOptionValuePositionDodo = (controlSuffix: string) => ({
  name: `value_align${controlSuffix}`,
  config: {
    type: 'SelectControl',
    label: t('Values align'),
    renderTrigger: true,
    clearable: false,
    default: LabelPositionDodo.Top,
    options: [
      {
        label: t(LabelPositionDodo.Left),
        value: LabelPositionDodo.Left,
      },
      {
        label: t(LabelPositionDodo.Right),
        value: LabelPositionDodo.Right,
      },
      {
        label: t(LabelPositionDodo.Top),
        value: LabelPositionDodo.Top,
      },
      {
        label: t(LabelPositionDodo.Bottom),
        value: LabelPositionDodo.Bottom,
      },
      {
        label: t(LabelPositionDodo.Inside),
        value: LabelPositionDodo.Inside,
      },
      {
        label: t(LabelPositionDodo.InsideTop),
        value: LabelPositionDodo.InsideTop,
      },
      {
        label: t(LabelPositionDodo.InsideLeft),
        value: LabelPositionDodo.InsideLeft,
      },
      {
        label: t(LabelPositionDodo.InsideRight),
        value: LabelPositionDodo.InsideRight,
      },
      {
        label: t(LabelPositionDodo.InsideBottom),
        value: LabelPositionDodo.InsideBottom,
      },
      {
        label: t(LabelPositionDodo.InsideTopLeft),
        value: LabelPositionDodo.InsideTopLeft,
      },
      {
        label: t(LabelPositionDodo.InsideTopRight),
        value: LabelPositionDodo.InsideTopRight,
      },
      {
        label: t(LabelPositionDodo.InsideBottomLeft),
        value: LabelPositionDodo.InsideBottomLeft,
      },
      {
        label: t(LabelPositionDodo.InsideBottomRight),
        value: LabelPositionDodo.InsideBottomRight,
      },
    ],
  },
});

export { chartOptionValuePositionDodo };
