import { CustomControlItem } from '@superset-ui/chart-controls';
import { t } from '@superset-ui/core';

// DODO added #20704667
export const xAxisBounds: CustomControlItem = {
  name: 'x_axis_bounds',
  config: {
    type: 'BoundsControl',
    label: t('X Axis Bounds'),
    renderTrigger: true,
    default: [null, null],
    description: t(
      'Bounds for the X-axis. When left empty, the bounds are ' +
        'dynamically defined based on the min/max of the data. Note that ' +
        "this feature will only expand the axis range. It won't " +
        "narrow the data's extent.",
    ),
  },
};
