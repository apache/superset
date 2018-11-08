import { t } from '@superset-ui/translation';
import { NVD3TimeSeries } from './sections';

export default {
  controlPanelSections: [
    NVD3TimeSeries[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['series_height', 'horizon_color_scale'],
      ],
    },
  ],
};
