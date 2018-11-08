import { t } from '@superset-ui/translation';
import { annotations } from './sections';
import { D3_TIME_FORMAT_OPTIONS } from '../controls';

export default {
  requiresTime: true,
  controlPanelSections: [
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['x_axis_format'],
      ],
    },
    {
      label: t('Y Axis 1'),
      expanded: true,
      controlSetRows: [
        ['metric', 'y_axis_format'],
      ],
    },
    {
      label: t('Y Axis 2'),
      expanded: true,
      controlSetRows: [
        ['metric_2', 'y_axis_2_format'],
      ],
    },
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        ['adhoc_filters'],
      ],
    },
    annotations,
  ],
  controlOverrides: {
    metric: {
      label: t('Left Axis Metric'),
      description: t('Choose a metric for left axis'),
    },
    y_axis_format: {
      label: t('Left Axis Format'),
    },
    x_axis_format: {
      choices: D3_TIME_FORMAT_OPTIONS,
      default: 'smart_date',
    },
  },
};
