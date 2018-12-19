import { t } from '@superset-ui/translation';
import * as v from '../explore/validators';

export default {
  forecasting_enable: {
    type: 'CheckboxControl',
    label: t('Enable forecasting'),
    renderTrigger: false,
    description: t('Enable forecasting for the current data'),
    default: false,
  },

  forecasting_horizon: {
    type: 'SliderControl',
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    renderTrigger: false,
    min: 1,
    max: 6,
    label: t('Horizon'),
    description: t('Forecasting horizon step'),
    mapStateToProps: state => state,
  },

  forecasting_interval: {
    type: 'SliderControl',
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    renderTrigger: false,
    min: 1,
    max: 99,
    default: 80,
    label: t('Confidence %'),
    description: t('Forecasting horizon confidence in %'),
  },
};
