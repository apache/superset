import { t } from '@superset-ui/translation';
import { BACKGROUND_TRANSPARENT, BACKGROUND_WHITE } from './constants';

export default [
  {
    value: BACKGROUND_TRANSPARENT,
    label: t('Transparent'),
    className: 'background--transparent',
  },
  {
    value: BACKGROUND_WHITE,
    label: t('White'),
    className: 'background--white',
  },
];
