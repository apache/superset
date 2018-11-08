import { t } from '@superset-ui/translation';
import { NVD3TimeSeries } from './sections';

export default {
  requiresTime: true,
  controlPanelSections: [
    NVD3TimeSeries[0],
    {
      label: t('Paired t-test'),
      expanded: false,
      controlSetRows: [
        ['significance_level'],
        ['pvalue_precision'],
        ['liftvalue_precision'],
      ],
    },
  ],
};
