import { t } from '@superset-ui/translation';
import * as v from '../explore/validators';

export default {
  forecasting_enable: {
    type: 'CheckboxControl',
    label: t('Enable forecasting'),
    renderTrigger: true,
    description: t('Enable forecasting for the current data'),
    default: false,
  },

  forecasting_horizon: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    renderTrigger: false,
    default: (props) => {
      // this should be computed based on the number of points of the original charts
      return 2;
    },
    label: t('Horizon'),
    description: t('Forecasting horizon step'),
    mapStateToProps: state => state,
  },

  forecasting_interval: {
    type: 'TextControl',
    isInt: true,
    validators: [v.integer, v.nonEmpty],
    renderTrigger: false,
    default: 80,
    label: t('Confidence %'),
    description: t('Forecasting horizon confidence in %'),
  },
};
