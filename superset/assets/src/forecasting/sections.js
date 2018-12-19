import { t } from '@superset-ui/translation';

export default {
  label: t('Forecasting options'),
  expanded: false,
  controlSetRows: [
    ['forecasting_enable'],
    ['forecasting_horizon'],
    ['forecasting_interval'],
  ],
};
