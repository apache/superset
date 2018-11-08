import { t } from '@superset-ui/translation';
import { NVD3TimeSeries } from './sections';

export default {
  requiresTime: true,
  controlPanelSections: [
    NVD3TimeSeries[0],
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['number_format', 'date_time_format'],
        ['rich_tooltip', 'rose_area_proportion'],
      ],
    },
    NVD3TimeSeries[1],
  ],
};
