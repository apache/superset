import { t } from '@superset-ui/core';
import { LabelPositionDoDo } from './types';

const chartOptionValuePositionDoDo = (controlSuffix: string) => ({
  name: `value_align${controlSuffix}`,
  config: {
    type: 'SelectControl',
    label: t('Values align'),
    renderTrigger: true,
    clearable: false,
    default: LabelPositionDoDo.top,
    options: [
      {
        label: t(LabelPositionDoDo.left),
        value: LabelPositionDoDo.left,
      },
      {
        label: t(LabelPositionDoDo.right),
        value: LabelPositionDoDo.right,
      },
      {
        label: t(LabelPositionDoDo.top),
        value: LabelPositionDoDo.top,
      },
      {
        label: t(LabelPositionDoDo.bottom),
        value: LabelPositionDoDo.bottom,
      },
      {
        label: t(LabelPositionDoDo.inside),
        value: LabelPositionDoDo.inside,
      },
      {
        label: t(LabelPositionDoDo.insideTop),
        value: LabelPositionDoDo.insideTop,
      },
      {
        label: t(LabelPositionDoDo.insideLeft),
        value: LabelPositionDoDo.insideLeft,
      },
      {
        label: t(LabelPositionDoDo.insideRight),
        value: LabelPositionDoDo.insideRight,
      },
      {
        label: t(LabelPositionDoDo.insideBottom),
        value: LabelPositionDoDo.insideBottom,
      },
      {
        label: t(LabelPositionDoDo.insideTopLeft),
        value: LabelPositionDoDo.insideTopLeft,
      },
      {
        label: t(LabelPositionDoDo.insideTopRight),
        value: LabelPositionDoDo.insideTopRight,
      },
      {
        label: t(LabelPositionDoDo.insideBottomLeft),
        value: LabelPositionDoDo.insideBottomLeft,
      },
      {
        label: t(LabelPositionDoDo.insideBottomRight),
        value: LabelPositionDoDo.insideBottomRight,
      },
    ],
  },
});

export { chartOptionValuePositionDoDo };
